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
import {
  SecurityContext,
  validateOperationParams,
  buildSafeSSHCommand,
  validateAndNormalizePath,
} from '../../utils/securityHandler.js';

const execAsync = promisify(exec);
const EXECUTION_TIMEOUT_MS = 120000;
const MAX_BUFFER_SIZE = 1024 * 1024 * 10;
const BASE_DIRECTORY = '/var/webs';

export async function executeFileEdit({
  commands,
  sshHost,
  directory,
  functionId,
  functionName,
  targetFile,
  inputs,
  progressCallback,
}) {
  validateExecuteParams({
    commands,
    sshHost,
    directory,
    functionId,
    targetFile,
  });

  const sanitized = validateOperationParams({
    sshHost,
    directory,
    userInputs: inputs,
  });

  validateAndNormalizePath(BASE_DIRECTORY, sanitized.directory);

  const securityContext = new SecurityContext(
    'file-edit',
    `${sanitized.sshHost}:${sanitized.directory}`
  );

  const progress = new ProgressTracker(
    'fileEdit',
    commands.length,
    progressCallback
  );
  const fullCommandChain = commands.join(' && ');

  logStart(
    'fileEdit',
    `Executing ${functionName} on ${sanitized.sshHost}/${sanitized.directory}`
  );
  progress.start(
    `Starting ${functionName} on ${sanitized.sshHost}/${sanitized.directory}`
  );

  try {
    const result = await securityContext.execute(async () => {
      return await executeCommandChain({
        commands,
        fullCommandChain,
        sshHost: sanitized.sshHost,
        progress,
      });
    });

    if (!result.success) {
      await attemptBackupRestore(
        sanitized.sshHost,
        sanitized.directory,
        targetFile
      );
      progress.failed();

      return buildFailureResult({
        functionId,
        functionName,
        directory: sanitized.directory,
        targetFile,
        progress,
        ...result,
      });
    }

    await cleanupBackup(sanitized.sshHost, sanitized.directory, targetFile);
    progress.complete();

    logSuccess('fileEdit', `${functionName} completed successfully`);

    return buildSuccessResult({
      functionId,
      functionName,
      directory: sanitized.directory,
      targetFile,
      inputs: sanitized.userInputs,
      progress,
      output: result.output,
    });
  } catch (error) {
    logError('fileEdit', 'Unexpected error during execution', error);
    progress.failed();
    return buildFailureResult({
      functionId,
      functionName,
      directory,
      targetFile,
      progress,
      failureReason: error.message,
    });
  }
}

function validateExecuteParams({
  commands,
  sshHost,
  directory,
  functionId,
  targetFile,
}) {
  validateArray(commands, 'Commands');
  validateArrayNotEmpty(commands, 'Commands');
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');
  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateString(functionId, 'Function ID');
  validateNonEmpty(functionId, 'Function ID');
  validateString(targetFile, 'Target file');
  validateNonEmpty(targetFile, 'Target file');
}

async function executeCommandChain({
  commands,
  fullCommandChain,
  sshHost,
  progress,
}) {
  let lastOutput = '';

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const isLastStep = i === commands.length - 1;
    const isRestartCommand = command.includes('systemctl restart');

    progress.stepStart(command);

    if (isRestartCommand) {
      progress.stepUpdate(
        'Restarting Rails service (this may take 30-40 seconds)...'
      );
    }

    if (!isLastStep) {
      progress.stepComplete(command, 'Queued', '');
      continue;
    }

    try {
      const sshCommand = buildSSHCommand(sshHost, fullCommandChain);
      logDebug('fileEdit', `Executing: ${sshCommand}`);

      const { stdout, stderr } = await execAsync(sshCommand, {
        timeout: EXECUTION_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_SIZE,
        killSignal: 'SIGTERM',
      });

      lastOutput = stdout.trim();
      progress.stepComplete(command, stdout, stderr);

      if (stderr?.includes('Error')) {
        logWarn('fileEdit', `Warning in stderr: ${stderr}`);
      }
    } catch (error) {
      logError(
        'fileEdit',
        `Step ${progress.currentStep} failed: ${command}`,
        error
      );

      return {
        success: false,
        step: progress.currentStep,
        command,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
        failureReason: error.message,
        exitCode: error.code,
      };
    }
  }

  return { success: true, output: lastOutput };
}

async function attemptBackupRestore(sshHost, directory, targetFile) {
  try {
    await restoreBackup(sshHost, directory, targetFile);
    logWarn('fileEdit', 'Backup restored after failure');
  } catch (error) {
    logError('fileEdit', 'Failed to restore backup', error);
  }
}

function buildSuccessResult({
  functionId,
  functionName,
  directory,
  targetFile,
  inputs,
  progress,
  output,
}) {
  return {
    success: true,
    functionId,
    functionName,
    directory,
    targetFile,
    inputs,
    totalSteps: progress.totalSteps,
    totalDuration: progress.getTotalDuration(),
    output,
  };
}

function buildFailureResult({
  functionId,
  functionName,
  directory,
  targetFile,
  progress,
  ...errorDetails
}) {
  return {
    success: false,
    functionId,
    functionName,
    directory,
    targetFile,
    totalSteps: progress.totalSteps,
    failedAtStep: progress.currentStep,
    totalDuration: progress.getTotalDuration(),
    ...errorDetails,
  };
}

function buildSSHCommand(host, command) {
  return buildSafeSSHCommand(host, command);
}

async function restoreBackup(sshHost, directory, targetFile) {
  const filePath = `${BASE_DIRECTORY}/${directory}/${targetFile}`;
  const backupPath = `${filePath}.backup`;
  const restoreCommand = `[ -f "${backupPath}" ] && cp "${backupPath}" "${filePath}" && rm "${backupPath}" && echo "Backup restored" || echo "No backup found"`;

  const { stdout } = await execAsync(buildSSHCommand(sshHost, restoreCommand), {
    timeout: 30000,
    maxBuffer: MAX_BUFFER_SIZE,
  });

  return stdout.trim();
}

async function cleanupBackup(sshHost, directory, targetFile) {
  const backupPath = `${BASE_DIRECTORY}/${directory}/${targetFile}.backup`;
  const cleanupCommand = `rm -f "${backupPath}"`;

  try {
    await execAsync(buildSSHCommand(sshHost, cleanupCommand), {
      timeout: 30000,
      maxBuffer: MAX_BUFFER_SIZE,
    });
    logDebug('fileEdit', 'Backup file cleaned up');
  } catch (error) {
    logWarn('fileEdit', 'Could not clean up backup file', error);
  }
}

export async function checkFileChanges({ sshHost, directory, targetFile }) {
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');
  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateString(targetFile, 'Target file');
  validateNonEmpty(targetFile, 'Target file');

  const sanitized = validateOperationParams({ sshHost, directory });
  validateAndNormalizePath(BASE_DIRECTORY, sanitized.directory);

  logDebug(
    'fileEdit',
    `Checking changes for ${targetFile} in ${sanitized.directory}`
  );

  try {
    const appPath = `${BASE_DIRECTORY}/${sanitized.directory}`;
    const diffCommand = `cd ${appPath} && git diff --name-only -- "${targetFile}"`;
    const { stdout } = await execAsync(
      buildSSHCommand(sanitized.sshHost, diffCommand),
      {
        timeout: 30000,
        maxBuffer: MAX_BUFFER_SIZE,
      }
    );

    const hasChanges = stdout.trim().length > 0;
    logInfo(
      'fileEdit',
      `File changes check: ${hasChanges ? 'Changes found' : 'No changes'}`
    );

    return { hasChanges, changedFile: hasChanges ? stdout.trim() : null };
  } catch (error) {
    logError('fileEdit', 'Failed to check file changes', error);
    throw new Error(`Failed to check file changes: ${error.message}`);
  }
}

export async function restoreFile({
  commands,
  sshHost,
  directory,
  targetFile,
  progressCallback,
}) {
  validateArray(commands, 'Commands');
  validateArrayNotEmpty(commands, 'Commands');
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');
  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateString(targetFile, 'Target file');
  validateNonEmpty(targetFile, 'Target file');

  const sanitized = validateOperationParams({ sshHost, directory });
  validateAndNormalizePath(BASE_DIRECTORY, sanitized.directory);

  const progress = new ProgressTracker(
    'fileEdit',
    commands.length,
    progressCallback
  );
  const fullCommandChain = commands.join(' && ');

  logStart('fileEdit', `Restoring ${targetFile} in ${sanitized.directory}`);
  progress.start(`Restoring ${targetFile} in ${sanitized.directory}`);

  try {
    const result = await executeCommandChain({
      commands,
      fullCommandChain,
      sshHost: sanitized.sshHost,
      progress,
    });

    if (!result.success) {
      progress.failed();
      return {
        success: false,
        directory,
        targetFile,
        failedAtStep: progress.currentStep,
        totalSteps: progress.totalSteps,
        totalDuration: progress.getTotalDuration(),
        ...result,
      };
    }

    progress.complete();
    logSuccess(
      'fileEdit',
      `File restored and service restarted: ${targetFile}`
    );

    return {
      success: true,
      directory,
      targetFile,
      message: 'File restored and service restarted',
      totalSteps: progress.totalSteps,
      totalDuration: progress.getTotalDuration(),
    };
  } catch (error) {
    logError('fileEdit', 'Failed to restore file', error);
    progress.failed();
    return {
      success: false,
      directory,
      targetFile,
      message: error.message,
      totalSteps: progress.totalSteps,
      failedAtStep: progress.currentStep,
      totalDuration: progress.getTotalDuration(),
    };
  }
}
