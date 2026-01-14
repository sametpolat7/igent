import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  validateArray,
  validateArrayNotEmpty,
  validateString,
  validateNonEmpty,
} from '../../utils/validator.js';
import {
  logStart,
  logSuccess,
  logError,
  logWarn,
  logDebug,
  logInfo,
} from '../../utils/logger.js';
import { ProgressTracker } from '../../utils/progressTracker.js';
import { buildSafeSSHCommand } from '../../utils/securityHandler.js';
import { QUEUE_ACTIONS } from './planner.js';

const execAsync = promisify(exec);
const EXECUTION_TIMEOUT_MS = 60000;
const MAX_BUFFER_SIZE = 1024 * 1024 * 5;

const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
const MAX_POLL_ATTEMPTS = 12; // Maximum 12 attempts (60 seconds total)

export async function executeQueueControl({
  commands,
  sshHost,
  directory,
  action,
  progressCallback,
}) {
  validateArray(commands, 'Commands');
  validateArrayNotEmpty(commands, 'Commands');
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');
  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateString(action, 'Action');
  validateNonEmpty(action, 'Action');

  const progress = new ProgressTracker(
    'queueControl',
    commands.length,
    progressCallback
  );

  logStart(
    'queueControl',
    `Executing ${action} on ${sshHost}/${directory} (${commands.length} steps)`
  );

  progress.start(`Starting queue ${action} on ${sshHost}/${directory}`);

  let sidekiqPid = null;
  let queueStatus = null;
  let failedStep = null;
  let chainedCommands = [];

  const isCheckCommand = (cmd) => cmd.includes('ps aux | grep');
  const isKillCommand = (cmd) => cmd.includes('kill -');
  const isStartCommand = (cmd) => cmd.includes('bundle exec sidekiq');
  const isCdCommand = (cmd) => cmd.trim().startsWith('cd ');
  const isVerifyStoppedCommand = (cmd) => cmd === '{{VERIFY_STOPPED}}';
  const isVerifyStartedCommand = (cmd) => cmd === '{{VERIFY_STARTED}}';

  try {
    for (let i = 0; i < commands.length; i++) {
      let command = commands[i];

      if (command.includes('{{PID}}')) {
        command = command.replace('{{PID}}', sidekiqPid || '<PID>');
      }

      if (isVerifyStoppedCommand(command) || isVerifyStartedCommand(command)) {
        const expectedRunning = isVerifyStartedCommand(command);

        if (
          !sidekiqPid &&
          isVerifyStoppedCommand(command) &&
          action === QUEUE_ACTIONS.RESTART
        ) {
          progress.stepStart('Server verification');
          progress.stepComplete(
            'Server verification',
            'Skipped: No process was running',
            ''
          );
          chainedCommands = [];
          continue;
        }

        progress.stepStart('Server verification');

        const verifyResult = await pollForStatus({
          sshHost,
          directory,
          expectedRunning,
          progress,
        });

        if (verifyResult.success) {
          queueStatus = verifyResult.status;
          if (!expectedRunning) {
            sidekiqPid = null;
          }
          progress.stepComplete(
            'Server verification',
            verifyResult.message,
            ''
          );
          chainedCommands = [];
        } else {
          const actionName = expectedRunning ? 'start' : 'stop';
          throw new Error(
            `Queue failed to ${actionName} after ${MAX_POLL_ATTEMPTS * (POLL_INTERVAL_MS / 1000)} seconds`
          );
        }
        continue;
      }

      chainedCommands.push(command);
      const commandToExecute = isCdCommand(command)
        ? null
        : chainedCommands.join(' && ');

      if (isCdCommand(command)) {
        progress.stepStart(command);
        progress.stepComplete(command, 'Chained with next command', '');
        continue;
      }

      progress.stepStart(command);

      try {
        if (action === QUEUE_ACTIONS.START && i === 0) {
          const checkResult = await executeCheckCommand(sshHost, command);
          if (checkResult.isRunning) {
            progress.stepComplete(command, checkResult.stdout, '');
            queueStatus = {
              isRunning: true,
              pid: checkResult.pid,
              processInfo: checkResult.processInfo,
            };

            const msg = `Sidekiq is already running (PID: ${checkResult.pid})`;
            logInfo('queueControl', msg);
            progress.complete();

            return {
              success: true,
              action,
              directory,
              sshHost,
              queueStatus,
              alreadyRunning: true,
              message: msg,
              totalSteps: commands.length,
              totalDuration: progress.getTotalDuration(),
              executedAt: new Date().toISOString(),
            };
          }
          progress.stepComplete(command, 'No Sidekiq process found', '');
          chainedCommands = [];
          continue;
        }

        if (
          (action === QUEUE_ACTIONS.STOP || action === QUEUE_ACTIONS.RESTART) &&
          i === 0 &&
          isCheckCommand(command)
        ) {
          const checkResult = await executeCheckCommand(sshHost, command);
          sidekiqPid = checkResult.pid;
          queueStatus = {
            isRunning: checkResult.isRunning,
            pid: checkResult.pid,
            processInfo: checkResult.processInfo,
          };

          progress.stepComplete(command, checkResult.stdout, '');

          if (!checkResult.isRunning && action === QUEUE_ACTIONS.STOP) {
            logInfo('queueControl', 'Sidekiq is not running, nothing to stop');
            progress.complete();

            return {
              success: true,
              action,
              directory,
              sshHost,
              queueStatus,
              alreadyStopped: true,
              message: 'Sidekiq is not running',
              totalSteps: commands.length,
              totalDuration: progress.getTotalDuration(),
              executedAt: new Date().toISOString(),
            };
          }
          chainedCommands = [];
          continue;
        }

        if (isKillCommand(command) && !sidekiqPid) {
          progress.stepComplete(command, 'Skipped: No running process', '');
          chainedCommands = [];
          continue;
        }

        const timeout = isStartCommand(command) ? 10000 : EXECUTION_TIMEOUT_MS;
        const { stdout, stderr } = await executeSSHCommand(
          sshHost,
          commandToExecute,
          timeout
        );

        if (isCheckCommand(command)) {
          const statusResult = parseSidekiqStatus(stdout);
          queueStatus = statusResult;
        }

        progress.stepComplete(command, stdout, stderr);
        chainedCommands = [];
      } catch (stepError) {
        if (isCheckCommand(command) && stepError.code === 1) {
          logDebug('queueControl', `Check command found no process`);
          queueStatus = { isRunning: false, pid: null, processInfo: null };
          progress.stepComplete(
            command,
            stepError.stdout || 'No Sidekiq process found',
            stepError.stderr || ''
          );
          chainedCommands = [];
          continue;
        }

        if (isStartCommand(command) && stepError.killed) {
          logInfo(
            'queueControl',
            'Start command timed out, process may be starting...'
          );
          progress.stepComplete(
            command,
            'Process initiated, verification pending',
            ''
          );
          chainedCommands = [];
          continue;
        }

        failedStep = {
          step: progress.currentStep,
          command: command,
          stdout: stepError.stdout?.trim() || '',
          stderr: stepError.stderr?.trim() || '',
          failureReason: stepError.message,
          exitCode: stepError.code,
        };

        progress.stepFailed(
          command,
          stepError.message,
          stepError.stdout?.trim() || '',
          stepError.stderr?.trim() || '',
          stepError.code
        );

        throw stepError;
      }
    }

    const totalDuration = progress.getTotalDuration();
    progress.complete();

    logSuccess('queueControl', `${action} completed in ${totalDuration}s`);

    return {
      success: true,
      action,
      directory,
      sshHost,
      queueStatus,
      totalSteps: commands.length,
      totalDuration,
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    const totalDuration = progress.getTotalDuration();
    progress.failed();

    logError(
      'queueControl',
      `${action} failed at step ${failedStep?.step || progress.currentStep}`,
      {
        command: failedStep?.command || commands[progress.currentStep - 1],
        failureReason: failedStep?.failureReason || error.message,
        stderr: failedStep?.stderr || '',
      }
    );

    const enhancedError = new Error(`Queue ${action} failed`);
    Object.assign(enhancedError, {
      success: false,
      action,
      directory,
      sshHost,
      queueStatus,
      totalSteps: commands.length,
      failedAtStep: failedStep?.step || progress.currentStep,
      failedCommand: failedStep?.command || commands[progress.currentStep - 1],
      stdout: failedStep?.stdout || '',
      stderr: failedStep?.stderr || '',
      failureReason: failedStep?.failureReason || error.message,
      exitCode: failedStep?.exitCode || error.code,
      totalDuration,
      executedAt: new Date().toISOString(),
    });
    throw enhancedError;
  }
}

async function executeSSHCommand(
  host,
  command,
  timeout = EXECUTION_TIMEOUT_MS
) {
  const sshCommand = buildSSHCommand(host, command);
  return await execAsync(sshCommand, {
    timeout,
    maxBuffer: MAX_BUFFER_SIZE,
    killSignal: 'SIGTERM',
  });
}

async function executeCheckCommand(sshHost, command) {
  try {
    const { stdout } = await executeSSHCommand(sshHost, command);
    return parseSidekiqStatus(stdout);
  } catch (error) {
    if (error.code === 1) {
      return { isRunning: false, pid: null, processInfo: null, stdout: '' };
    }
    throw error;
  }
}

function parseSidekiqStatus(stdout) {
  const lines = stdout
    .trim()
    .split('\n')
    .filter((line) => {
      return line.trim() && !line.includes('grep') && line.includes('sidekiq');
    });

  if (lines.length === 0) {
    return { isRunning: false, pid: null, processInfo: null, stdout };
  }

  const line = lines[0];
  const parts = line.trim().split(/\s+/);

  const pid = parts[1] ? parseInt(parts[1], 10) : null;

  const sidekiqMatch = line.match(
    /sidekiq\s+[\d.]+\s+\S+\s+\[(\d+)\s+of\s+(\d+)\s+busy\]/
  );
  const processInfo = sidekiqMatch
    ? {
        busyWorkers: parseInt(sidekiqMatch[1], 10),
        totalWorkers: parseInt(sidekiqMatch[2], 10),
        fullLine: line.trim(),
      }
    : {
        fullLine: line.trim(),
      };

  return {
    isRunning: true,
    pid: pid && !isNaN(pid) ? pid : null,
    processInfo,
    stdout,
  };
}

function buildSSHCommand(host, commandSequence) {
  const bashCommand = `bash -l -c '${commandSequence}'`;
  return buildSafeSSHCommand(host, bashCommand);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForStatus({
  sshHost,
  directory,
  expectedRunning,
  progress,
}) {
  const checkCommand = `ps aux | grep -E "sidekiq.*${directory}" | grep -v grep`;
  const expectedState = expectedRunning ? 'started' : 'stopped';
  const maxWaitSeconds = MAX_POLL_ATTEMPTS * (POLL_INTERVAL_MS / 1000);

  progress.stepUpdate(
    `Connecting to server to verify queue status (may take up to ${maxWaitSeconds}s)`
  );

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const elapsedSeconds = (POLL_INTERVAL_MS / 1000) * attempt;

    await sleep(POLL_INTERVAL_MS);

    progress.stepUpdate(
      `Checking process status on ${sshHost}... (${elapsedSeconds}s / ${maxWaitSeconds}s)`
    );

    try {
      const status = await executeCheckCommand(sshHost, checkCommand);

      if (status.isRunning === expectedRunning) {
        const resultMsg = expectedRunning
          ? `Confirmed: Queue process is running on server (PID: ${status.pid})`
          : `Confirmed: Queue process has stopped on server`;

        logSuccess('queueControl', resultMsg);
        return { success: true, status, message: resultMsg };
      }

      logDebug(
        'queueControl',
        `Attempt ${attempt}/${MAX_POLL_ATTEMPTS}: still ${status.isRunning ? 'running' : 'stopped'}`
      );
    } catch (error) {
      if (!expectedRunning && error.code === 1) {
        const resultMsg = 'Confirmed: Queue process has stopped on server';
        logSuccess('queueControl', resultMsg);
        return {
          success: true,
          status: { isRunning: false, pid: null, processInfo: null },
          message: resultMsg,
        };
      }

      logWarn(
        'queueControl',
        `Poll attempt ${attempt} failed: ${error.message}`
      );
    }
  }

  const timeoutMsg = `Server did not confirm queue ${expectedState} within ${maxWaitSeconds}s. Please check manually.`;
  logWarn('queueControl', timeoutMsg);

  return { success: false, status: null, message: timeoutMsg };
}

export async function checkQueueStatus({ sshHost, directory }) {
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');
  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');

  const checkCommand = `ps aux | grep -E "sidekiq.*${directory}" | grep -v grep`;

  logDebug('queueControl', `Checking queue status for ${sshHost}/${directory}`);

  try {
    const result = await executeCheckCommand(sshHost, checkCommand);
    logDebug(
      'queueControl',
      `Status check result: ${result.isRunning ? 'RUNNING' : 'STOPPED'}`
    );
    return result;
  } catch (error) {
    logWarn('queueControl', `Status check failed: ${error.message}`);
    return {
      isRunning: false,
      pid: null,
      processInfo: null,
      error: error.message,
    };
  }
}
