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

      // Substitute PID in kill commands
      if (command.includes('{{PID}}')) {
        command = command.replace('{{PID}}', sidekiqPid || '<PID>');
      }

      // Handle verification marker commands BEFORE adding to chain
      // These are not real commands - they trigger polling verification
      if (isVerifyStoppedCommand(command) || isVerifyStartedCommand(command)) {
        const expectedRunning = isVerifyStartedCommand(command);

        // Skip verification if no PID was found during RESTART
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
          // Clear any pending chained commands
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
            sidekiqPid = null; // Clear PID after successful stop
          }
          progress.stepComplete(
            'Server verification',
            verifyResult.message,
            ''
          );
          // Clear chain after verification for clean state
          chainedCommands = [];
        } else {
          const actionName = expectedRunning ? 'start' : 'stop';
          throw new Error(
            `Queue failed to ${actionName} after ${MAX_POLL_ATTEMPTS * (POLL_INTERVAL_MS / 1000)} seconds`
          );
        }
        continue;
      }

      // Build command chain: cd commands chain with the next command
      chainedCommands.push(command);
      const commandToExecute = isCdCommand(command)
        ? null // Don't execute cd alone, wait for next command
        : chainedCommands.join(' && ');

      // Skip cd command execution - it will be chained with next command
      if (isCdCommand(command)) {
        progress.stepStart(command);
        progress.stepComplete(command, 'Chained with next command', '');
        continue;
      }

      progress.stepStart(command);

      try {
        // Handle START action pre-check (first command)
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

        // Handle STOP/RESTART PID extraction (first check command)
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

        // Skip kill commands if no PID (for RESTART when not running)
        if (isKillCommand(command) && !sidekiqPid) {
          progress.stepComplete(command, 'Skipped: No running process', '');
          chainedCommands = [];
          continue;
        }

        // Execute command (start commands use shorter timeout since they detach)
        const timeout = isStartCommand(command) ? 10000 : EXECUTION_TIMEOUT_MS;
        const { stdout, stderr } = await executeSSHCommand(
          sshHost,
          commandToExecute,
          timeout
        );

        // Update queue status on check commands
        if (isCheckCommand(command)) {
          const statusResult = parseSidekiqStatus(stdout);
          queueStatus = statusResult;
        }

        progress.stepComplete(command, stdout, stderr);
        chainedCommands = [];
      } catch (stepError) {
        // Allow failures for check commands (grep returns exit 1 when no match)
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

        // Handle start command timeout - treat as initiated, not failure
        // Background process may have started but SSH didn't fully detach
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
    // grep returns exit code 1 when no matches found
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
      // Filter out the grep command itself and empty lines
      return line.trim() && !line.includes('grep') && line.includes('sidekiq');
    });

  if (lines.length === 0) {
    return { isRunning: false, pid: null, processInfo: null, stdout };
  }

  // Parse the first matching line
  // Format: user PID ... sidekiq 7.3.1 app-name [x of y busy]
  const line = lines[0];
  const parts = line.trim().split(/\s+/);

  // PID is typically the second field in ps aux output
  const pid = parts[1] ? parseInt(parts[1], 10) : null;

  // Extract the sidekiq info (version, app, status)
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
  const escapedCommands = commandSequence.replace(/'/g, "'\\''");
  return `ssh ${host} "bash -l -c '${escapedCommands}'"`;
}
// Utility to wait for specified milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Poll for expected queue status with progress updates
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

      // Check if we reached the expected state
      if (status.isRunning === expectedRunning) {
        const resultMsg = expectedRunning
          ? `Confirmed: Queue process is running on server (PID: ${status.pid})`
          : `Confirmed: Queue process has stopped on server`;

        logSuccess('queueControl', resultMsg);
        return { success: true, status, message: resultMsg };
      }

      // Not yet in expected state, continue polling
      logDebug(
        'queueControl',
        `Attempt ${attempt}/${MAX_POLL_ATTEMPTS}: still ${status.isRunning ? 'running' : 'stopped'}`
      );
    } catch (error) {
      // For stop operations, grep exit code 1 means process not found (success)
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

  // Timeout - could not verify expected state
  const timeoutMsg = `Server did not confirm queue ${expectedState} within ${maxWaitSeconds}s. Please check manually.`;
  logWarn('queueControl', timeoutMsg);

  return { success: false, status: null, message: timeoutMsg };
}

// Direct status check without full plan execution
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
