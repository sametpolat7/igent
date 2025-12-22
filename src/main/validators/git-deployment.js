/**
 * Git Deployment Validators - Validation logic for git deployment operations
 *
 * Provides specialized validation functions for git deployment planning
 * and execution to ensure security and data integrity.
 */

import {
  validateRequiredString,
  validateNonEmptyString,
  validateStringArray,
  validatePattern,
  validateInArray,
} from './common.js';

/**
 * Validate Git deployment planning parameters
 *
 * @param {Object} params - Parameters to validate
 * @param {string} params.serverKey - Server identifier
 * @param {string} params.directory - Application directory name
 * @param {string} params.branch - Git branch name
 * @param {Object} serversConfig - Loaded server configuration
 * @throws {Error} If validation fails
 */
export function validateGitDeploymentParams(
  { serverKey, directory, branch },
  serversConfig
) {
  // Validate server key
  validateRequiredString(serverKey, 'Server key');

  if (!serversConfig[serverKey]) {
    throw new Error(
      `Unknown server: "${serverKey}". Available servers: ${Object.keys(serversConfig).join(', ')}`
    );
  }

  const serverConfig = serversConfig[serverKey];

  // Validate directory
  validateRequiredString(directory, 'Directory');

  if (!serverConfig.allowedDirectories) {
    throw new Error(
      `Server "${serverKey}" has no allowed directories configured`
    );
  }

  validateInArray(directory, serverConfig.allowedDirectories, 'Directory');

  // Validate branch name
  validateRequiredString(branch, 'Branch name');
  validatePattern(
    branch,
    /^[a-zA-Z0-9_./-]+$/,
    'branch name',
    'Only alphanumeric characters, hyphens, underscores, slashes, and dots are allowed'
  );

  // Validate SSH host configuration
  if (
    !serverConfig.sshHost ||
    typeof serverConfig.sshHost !== 'string' ||
    serverConfig.sshHost.length === 0
  ) {
    throw new Error(`Server "${serverKey}" has no SSH host configured`);
  }
}

/**
 * Validate SSH command execution parameters
 *
 * @param {Object} params - Parameters to validate
 * @param {string[]} params.commands - Array of shell commands to execute
 * @param {string} params.sshHost - SSH host identifier
 * @throws {Error} If validation fails
 */
export function validateSSHExecutionParams({ commands, sshHost }) {
  // Validate commands array
  validateStringArray(commands, 'Commands');

  // Validate SSH host
  validateNonEmptyString(sshHost, 'SSH host');
}
