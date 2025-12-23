import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  validateArray,
  validateArrayNotEmpty,
  validateString,
  validateNonEmpty,
} from '../../../utils/validators.js';
import { logStart, logSuccess, logError } from '../../../utils/logger.js';
import { ProgressTracker } from '../../../utils/progressTracker.js';

const execAsync = promisify(exec);
const EXECUTION_TIMEOUT_MS = 300000;
const MAX_BUFFER_SIZE = 1024 * 1024 * 10;

export async function executeGitDeployment({
  commands,
  sshHost,
  progressCallback,
}) {
  // Validate inputs
  validateArray(commands, 'Commands');
  validateArrayNotEmpty(commands, 'Commands');
  for (const cmd of commands) {
    validateString(cmd, 'Command');
    validateNonEmpty(cmd, 'Command');
  }
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');

  // Initialize progress tracker
  const progress = new ProgressTracker(
    'GitDeployment',
    commands.length,
    progressCallback
  );

  logStart('GitDeployment', 'Executing deployment', {
    host: sshHost,
    commands: commands.length,
  });

  progress.start(`Starting deployment to ${sshHost}`);

  const executedCommands = [];
  let failedStep = null;

  try {
    // Execute commands sequentially, chaining them to maintain SSH session state
    for (const command of commands) {
      executedCommands.push(command);

      progress.stepStart(command);

      try {
        const commandChain = executedCommands.join(' && ');
        const sshCommand = buildSSHCommand(sshHost, commandChain);

        const { stdout, stderr } = await execAsync(sshCommand, {
          timeout: EXECUTION_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER_SIZE,
          killSignal: 'SIGTERM',
        });

        progress.stepComplete(command, stdout, stderr);
      } catch (stepError) {
        failedStep = {
          step: progress.currentStep,
          command,
          stdout: stepError.stdout?.trim() || '',
          stderr: stepError.stderr?.trim() || '',
          error: stepError.message,
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

    // Success
    const totalDuration = progress.getTotalDuration();
    progress.complete();

    const result = {
      success: true,
      commands,
      sshHost,
      totalSteps: commands.length,
      totalDuration,
      executedAt: new Date().toISOString(),
    };

    logSuccess('GitDeployment', `Deployment completed in ${totalDuration}s`);
    return result;
  } catch (error) {
    // Failure
    const totalDuration = progress.getTotalDuration();
    progress.failed();

    const errorResult = {
      success: false,
      commands,
      sshHost,
      totalSteps: commands.length,
      failedAtStep: failedStep?.step || progress.currentStep,
      failedCommand: failedStep?.command || commands[progress.currentStep - 1],
      stdout: failedStep?.stdout || '',
      stderr: failedStep?.stderr || '',
      error: failedStep?.error || error.message,
      exitCode: failedStep?.exitCode || error.code,
      totalDuration,
      executedAt: new Date().toISOString(),
    };

    logError(
      'GitDeployment',
      `Deployment failed at step ${errorResult.failedAtStep}`,
      {
        command: errorResult.failedCommand,
        error: errorResult.error,
        stderr: errorResult.stderr,
      }
    );

    const enhancedError = new Error('Command execution failed');
    Object.assign(enhancedError, errorResult);
    throw enhancedError;
  }
}

function buildSSHCommand(host, commandSequence) {
  const escapedCommands = commandSequence.replace(/'/g, "'\\''");
  return `ssh ${host} "bash -l -c '${escapedCommands}'"`;
}
