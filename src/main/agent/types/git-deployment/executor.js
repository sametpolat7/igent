import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  validateArray,
  validateArrayNotEmpty,
  validateString,
  validateNonEmpty,
} from '../../../utils/validators.js';
import { logStart, logSuccess, logError } from '../../../utils/logger.js';

const execAsync = promisify(exec);
const EXECUTION_TIMEOUT_MS = 300000;
const MAX_BUFFER_SIZE = 1024 * 1024 * 10;

export async function executeGitDeployment({ commands, sshHost }) {
  validateArray(commands, 'Commands');
  validateArrayNotEmpty(commands, 'Commands');
  for (const cmd of commands) {
    validateString(cmd, 'Command');
    validateNonEmpty(cmd, 'Command');
  }

  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');

  const commandSequence = commands.join(' && ');
  const sshCommand = buildSSHCommand(sshHost, commandSequence);

  logStart('GitDeployment', 'Executing deployment', {
    host: sshHost,
    commands: commands.length,
  });

  try {
    const { stdout, stderr } = await execAsync(sshCommand, {
      timeout: EXECUTION_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_SIZE,
      killSignal: 'SIGTERM',
    });

    const result = {
      success: true,
      commands,
      sshHost: sshHost,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      executedAt: new Date().toISOString(),
    };

    logSuccess('GitDeployment', 'Deployment completed successfully');
    return result;
  } catch (error) {
    const errorResult = {
      success: false,
      commands,
      sshHost: sshHost,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      error: error.message,
      exitCode: error.code,
      executedAt: new Date().toISOString(),
    };

    logError('GitDeployment', 'Deployment failed', errorResult);

    const enhancedError = new Error('Command execution failed');
    Object.assign(enhancedError, errorResult);
    throw enhancedError;
  }
}

function buildSSHCommand(host, commandSequence) {
  const escapedCommands = commandSequence.replace(/'/g, "'\\''");
  return `ssh ${host} "bash -l -c '${escapedCommands}'"`;
}
