/**
 * Git Deployment Executor - Execute Git deployment commands via SSH
 *
 * Responsibilities:
 * - Execute deployment commands on remote servers via SSH
 * - Handle command sequencing and error propagation
 * - Provide detailed execution results and logging
 *
 * Future extensibility:
 * - Add command retry logic with exponential backoff
 * - Add real-time progress streaming to UI
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  validateArray,
  validateArrayNotEmpty,
  validateString,
  validateNonEmpty,
} from '../../../utils/validators.js';

const execAsync = promisify(exec);

const EXECUTION_TIMEOUT_MS = 300000; // 5 minutes default timeout
const MAX_BUFFER_SIZE = 1024 * 1024 * 10; // 10MB buffer for command output

/**
 * Execute a sequence of Git deployment commands on a remote server via SSH
 *
 * @param {Object} params - Execution parameters
 * @param {string[]} params.commands - Array of shell commands to execute
 * @param {string} params.sshHost - SSH host identifier
 * @returns {Promise<Object>} Execution result with stdout, stderr, and metadata
 * @throws {Error} If execution fails or validation errors occur
 */
export async function executeGitDeployment({ commands, sshHost }) {
  // Validate commands
  validateArray(commands, 'Commands');
  validateArrayNotEmpty(commands, 'Commands');
  for (const cmd of commands) {
    validateString(cmd, 'Command');
    validateNonEmpty(cmd, 'Command');
  }

  // Validate SSH host
  validateString(sshHost, 'SSH host');
  validateNonEmpty(sshHost, 'SSH host');

  const commandSequence = commands.join(' && ');
  const sshCommand = buildSSHCommand(sshHost, commandSequence);

  console.log('[GitDeploymentExecutor] Starting execution:', {
    host: sshHost,
    commandCount: commands.length,
  });

  try {
    // Execute command with timeout protection
    const { stdout, stderr } = await execAsync(sshCommand, {
      timeout: EXECUTION_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_SIZE,
      // Kill entire process group if timeout occurs
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

    console.log('[GitDeploymentExecutor] Execution completed successfully');
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

    console.error('[GitDeploymentExecutor] Execution failed:', errorResult);

    const enhancedError = new Error('Command execution failed');
    Object.assign(enhancedError, errorResult);
    throw enhancedError;
  }
}

/**
 * Build SSH command with proper escaping and shell initialization
 *
 * @param {string} host - SSH host identifier
 * @param {string} commandSequence - Command sequence to execute
 * @returns {string} Complete SSH command string
 */
function buildSSHCommand(host, commandSequence) {
  // Escape single quotes in command sequence for bash -c
  const escapedCommands = commandSequence.replace(/'/g, "'\\''");

  // Use bash -l -c to run as login shell (loads full environment)
  return `ssh ${host} "bash -l -c '${escapedCommands}'"`;
}
