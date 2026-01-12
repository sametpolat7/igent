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
} from '../../utils/logger.js';
import { ProgressTracker } from '../../utils/progressTracker.js';
import {
  detectConflict,
  executeConflictCleanup,
  createConflictError,
} from '../../utils/conflictResolver.js';
import {
  SecurityContext,
  validateOperationParams,
  buildSafeSSHCommand,
  validateAndNormalizePath,
} from '../../utils/securityHandler.js';

const execAsync = promisify(exec);
const EXECUTION_TIMEOUT_MS = 300000;
const MAX_BUFFER_SIZE = 1024 * 1024 * 10;

export async function executeServerUpdate({
  commands,
  sshHost,
  directory,
  branch,
  progressCallback,
}) {
  validateArray(commands, 'Commands');
  validateArrayNotEmpty(commands, 'Commands');
  for (const cmd of commands) {
    validateString(cmd, 'Command');
    validateNonEmpty(cmd, 'Command');
  }
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');
  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateString(branch, 'Branch name');
  validateNonEmpty(branch, 'Branch name');

  // Security: Validate and sanitize all inputs
  const sanitized = validateOperationParams({
    sshHost,
    directory,
    branch,
  });

  // Security: Path validation
  const appPath = validateAndNormalizePath('/var/webs', sanitized.directory);

  const securityContext = new SecurityContext(
    'server-update',
    `${sanitized.sshHost}:${sanitized.directory}`
  );

  const progress = new ProgressTracker(
    'serverUpdate',
    commands.length,
    progressCallback
  );

  logStart(
    'serverUpdate',
    `Executing update to ${sanitized.sshHost} (${commands.length} steps)`
  );

  progress.start(`Starting update to ${sanitized.sshHost}`);

  const executedCommands = [];
  let failedStep = null;
  let originalHead = null;

  try {
    // Security: Start rate-limited context
    securityContext.start();

    const getHeadCommand = `cd ${appPath} && git rev-parse HEAD`;
    const sshCommand = buildSSHCommand(sanitized.sshHost, getHeadCommand);
    const { stdout } = await execAsync(sshCommand, {
      timeout: EXECUTION_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_SIZE,
      killSignal: 'SIGTERM',
    });
    originalHead = stdout.trim();
    logDebug('serverUpdate', `Captured original HEAD: ${originalHead}`);
  } catch (error) {
    logWarn('serverUpdate', 'Could not capture original HEAD', error);
  }

  try {
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

        const { hasConflict, conflictType } = detectConflict(stdout, stderr);

        if (hasConflict) {
          logWarn('serverUpdate', `Git conflict detected: ${conflictType}`);

          await executeConflictCleanup({
            sshHost,
            directory,
            conflictType,
            originalHead,
            progressCallback,
            currentStep: progress.currentStep,
            totalSteps: progress.totalSteps,
            buildSSHCommand,
          });

          throw createConflictError(branch, directory, conflictType);
        }

        progress.stepComplete(command, stdout, stderr);
      } catch (stepError) {
        if (stepError.isConflict) {
          throw stepError;
        }

        const { hasConflict, conflictType } = detectConflict(
          stepError.stdout || '',
          stepError.stderr || ''
        );

        if (hasConflict) {
          logWarn(
            'serverUpdate',
            `Git conflict detected in failed command: ${conflictType}`
          );

          await executeConflictCleanup({
            sshHost: sanitized.sshHost,
            directory: sanitized.directory,
            conflictType,
            originalHead,
            progressCallback,
            currentStep: progress.currentStep,
            totalSteps: progress.totalSteps,
            buildSSHCommand,
          });

          throw createConflictError(
            sanitized.branch,
            sanitized.directory,
            conflictType
          );
        }

        failedStep = {
          step: progress.currentStep,
          command,
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

    // Security: Release rate limit
    securityContext.release();

    logSuccess('serverUpdate', `Update completed in ${totalDuration}s`);
    return {
      success: true,
      commands,
      sshHost: sanitized.sshHost,
      totalSteps: commands.length,
      totalDuration,
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Security: Always release rate limit
    securityContext.release();

    const totalDuration = progress.getTotalDuration();

    if (error.isConflict) {
      logWarn(
        'serverUpdate',
        `Update aborted at step ${progress.currentStep}/${commands.length} due to ${error.conflictType} | Total: ${totalDuration}s`
      );

      const conflictError = new Error(error.message);
      Object.assign(conflictError, {
        success: false,
        isConflict: true,
        conflictType: error.conflictType,
        directory: error.directory,
        branch: error.branch,
        totalSteps: commands.length,
        failedAtStep: progress.currentStep,
        totalDuration,
      });
      throw conflictError;
    }

    progress.failed();

    logError(
      'serverUpdate',
      `Update failed at step ${failedStep?.step || progress.currentStep}`,
      {
        command: failedStep?.command || commands[progress.currentStep - 1],
        failureReason: failedStep?.failureReason || error.message,
        stderr: failedStep?.stderr || '',
      }
    );

    const enhancedError = new Error('Execution failed.');
    Object.assign(enhancedError, {
      success: false,
      commands,
      sshHost,
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

function buildSSHCommand(host, commandSequence) {
  // Security: Use safe SSH command builder with bash login shell.
  // The command sequence is passed unescaped here; buildSafeSSHCommand
  // is responsible for performing the necessary shell escaping.
  const bashCommand = `bash -l -c "${commandSequence}"`;
  return buildSafeSSHCommand(host, bashCommand);
}
