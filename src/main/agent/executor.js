/**
 * Command Executor - Remote SSH Command Execution
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

const execAsync = promisify(exec);

const EXECUTION_TIMEOUT_MS = 300000; // 5 minutes default timeout
const MAX_BUFFER_SIZE = 1024 * 1024 * 10; // 10MB buffer for command output

/**
 * Execute a sequence of commands on a remote server via SSH
 *
 * @param {Object} params - Execution parameters
 * @param {string[]} params.commands - Array of shell commands to execute
 * @param {string} params.sshHost - SSH host identifier
 * @returns {Promise<Object>} Execution result with stdout, stderr, and metadata
 * @throws {Error} If execution fails or validation errors occur
 */
export async function executeCommands({ commands, sshHost }) {
  validateExecutionParams({ commands, sshHost });

  const commandSequence = commands.join(' && ');

  // Build SSH command with bash login shell (loads .bashrc, environment, rbenv, etc.)
  const sshCommand = buildSSHCommand(sshHost, commandSequence);

  console.log('[Executor] Starting execution:', {
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

    console.log('[Executor] Execution completed successfully');
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

    console.error('[Executor] Execution failed:', errorResult);

    const enhancedError = new Error('Command execution failed');
    Object.assign(enhancedError, errorResult);
    throw enhancedError;
  }
}

/**
 * Validate execution parameters
 *
 * @param {Object} params - Parameters to validate
 * @throws {Error} If validation fails
 */
function validateExecutionParams({ commands, sshHost }) {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error('Commands must be a non-empty array');
  }

  for (const cmd of commands) {
    if (typeof cmd !== 'string' || cmd.trim().length === 0) {
      throw new Error('All commands must be non-empty strings');
    }
  }

  if (typeof sshHost !== 'string' || sshHost.trim().length === 0) {
    throw new Error('SSH host must be a non-empty string');
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
