import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logInfo, logWarn, logSuccess } from './logger.js';

const execAsync = promisify(exec);
const EXECUTION_TIMEOUT_MS = 300000;
const MAX_BUFFER_SIZE = 1024 * 1024 * 10;

const CONFLICT_PATTERNS = {
  UNMERGED_INDEX: /cannot stash.*unmerged paths/i,
  STASH_CONFLICT: /stash entry is kept/i,
  MERGE_CONFLICT: /CONFLICT \(content\)|Automatic merge failed/i,
  UNMERGED_FILE: /Your index file is unmerged/i,
};

export function detectConflict(stdout, stderr) {
  const combinedOutput = `${stdout}\n${stderr}`;

  for (const [type, pattern] of Object.entries(CONFLICT_PATTERNS)) {
    if (pattern.test(combinedOutput)) {
      return { hasConflict: true, conflictType: type };
    }
  }

  return { hasConflict: false, conflictType: null };
}

export function generateCleanupCommands(directory, conflictType, originalHead) {
  const appPath = `/var/webs/${directory}`;
  const commands = [`cd ${appPath}`];

  if (conflictType === 'MERGE_CONFLICT' || conflictType === 'UNMERGED_INDEX') {
    commands.push('git merge --abort || true');
  } else if (
    conflictType === 'STASH_CONFLICT' ||
    conflictType === 'UNMERGED_FILE'
  ) {
    commands.push('git reset --hard');
  }

  if (originalHead) {
    commands.push(`git reset --hard ${originalHead}`);
  }

  commands.push('git stash pop || true');

  return commands;
}

export function createConflictError(branch, directory, conflictType) {
  const error = new Error(
    `A conflict was encountered while pulling the ${branch} development branch to the ${directory} server. Please contact the developer.`
  );
  error.isConflict = true;
  error.conflictType = conflictType;
  error.directory = directory;
  error.branch = branch;
  return error;
}

export async function executeConflictCleanup({
  sshHost,
  directory,
  conflictType,
  originalHead,
  progressCallback,
  currentStep,
  totalSteps,
  buildSSHCommand,
}) {
  const cleanupCommands = generateCleanupCommands(
    directory,
    conflictType,
    originalHead
  );

  const rollbackSteps = cleanupCommands.slice(1);
  const totalRollbackSteps = rollbackSteps.length;
  const rollbackStartTime = Date.now();

  logWarn(
    'conflictResolver',
    `Starting rollback for ${conflictType} (${totalRollbackSteps} steps)`
  );

  if (progressCallback) {
    progressCallback({
      status: 'conflict-detected',
      conflictType,
      currentStep,
      totalSteps,
      message: `Git conflict detected: ${conflictType}`,
      timestamp: new Date().toISOString(),
    });
  }

  for (let i = 0; i < rollbackSteps.length; i++) {
    const rollbackCommand = rollbackSteps[i];
    const rollbackStepNumber = i + 1;
    const stepStartTime = Date.now();

    logInfo(
      'conflictResolver',
      `[${rollbackStepNumber}/${totalRollbackSteps}] Running: ${rollbackCommand}`
    );

    if (progressCallback) {
      progressCallback({
        status: 'rollback-running',
        rollbackStep: rollbackStepNumber,
        totalRollbackSteps,
        command: rollbackCommand,
        message: `Rolling back: ${rollbackCommand}`,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const appPath = `/var/webs/${directory}`;
      const commandChain = `cd ${appPath} && ${rollbackCommand}`;
      const sshCommand = buildSSHCommand(sshHost, commandChain);

      await execAsync(sshCommand, {
        timeout: EXECUTION_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_SIZE,
        killSignal: 'SIGTERM',
      });

      const duration = ((Date.now() - stepStartTime) / 1000).toFixed(2);

      logInfo(
        'conflictResolver',
        `[${rollbackStepNumber}/${totalRollbackSteps}] Completed in ${duration}s`
      );

      if (progressCallback) {
        progressCallback({
          status: 'rollback-step-complete',
          rollbackStep: rollbackStepNumber,
          totalRollbackSteps,
          command: rollbackCommand,
          duration,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      const duration = ((Date.now() - stepStartTime) / 1000).toFixed(2);

      logWarn(
        'conflictResolver',
        `[${rollbackStepNumber}/${totalRollbackSteps}] Warning after ${duration}s (non-critical)`
      );

      if (progressCallback) {
        progressCallback({
          status: 'rollback-step-warning',
          rollbackStep: rollbackStepNumber,
          totalRollbackSteps,
          command: rollbackCommand,
          duration,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  const totalRollbackDuration = (
    (Date.now() - rollbackStartTime) /
    1000
  ).toFixed(2);

  logSuccess(
    'conflictResolver',
    `Rollback completed in ${totalRollbackDuration}s - server restored to previous state`
  );

  if (progressCallback) {
    progressCallback({
      status: 'rollback-completed',
      message:
        'All rollback operations completed. Server restored to stable state.',
      timestamp: new Date().toISOString(),
    });
  }
}
