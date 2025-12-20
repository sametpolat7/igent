/**
 * Deployment Planner - Validate and generate deployment plans
 *
 * Responsibilities:
 * - Validate deployment requests against server configuration
 * - Generate deployment command sequences
 * - Ensure security through directory whitelisting
 *
 * Future extensibility:
 * - Add rollback plan generation
 */

import { loadServersConfig } from '../config/loadConfig.js';

const BASE_DIRECTORY = '/var/webs';
const DEFAULT_MAIN_BRANCH = 'main';

/**
 * Plan a deployment by validating parameters and generating commands
 *
 * @param {Object} params - Deployment parameters
 * @param {string} params.serverKey - Server identifier from servers.json
 * @param {string} params.directory - Application directory name
 * @param {string} params.branch - Git branch to deploy
 * @returns {Object} Deployment plan with commands and sshHost
 * @throws {Error} If validation fails
 */
export function planDeployment({ serverKey, directory, branch }) {
  const serversConfig = loadServersConfig();

  validateDeploymentParams({ serverKey, directory, branch }, serversConfig);

  const serverConfig = serversConfig[serverKey];

  // Generate deployment command sequence
  const commands = generateGitDeploymentCommands({
    directory,
    branch,
  });

  // Build deployment plan
  const plan = {
    serverKey,
    directory,
    branch,
    commands,
    sshHost: serverConfig.sshHost,
    createdAt: new Date().toISOString(),
  };

  console.log('[Planner] Deployment plan created:', {
    server: serverKey,
    directory,
    branch,
    commandCount: commands.length,
  });

  return plan;
}

/**
 * Validate deployment parameters
 *
 * @param {Object} params - Parameters to validate
 * @param {Object} serversConfig - Loaded server configuration
 * @throws {Error} If validation fails
 */
function validateDeploymentParams(
  { serverKey, directory, branch },
  serversConfig
) {
  if (!serverKey || typeof serverKey !== 'string') {
    throw new Error('Server key is required and must be a string');
  }

  if (!serversConfig[serverKey]) {
    throw new Error(
      `Unknown server: "${serverKey}". Available servers: ${Object.keys(serversConfig).join(', ')}`
    );
  }

  const serverConfig = serversConfig[serverKey];

  if (!directory || typeof directory !== 'string') {
    throw new Error('Directory is required and must be a string');
  }

  if (!serverConfig.allowedDirectories) {
    throw new Error(
      `Server "${serverKey}" has no allowed directories configured`
    );
  }

  if (!serverConfig.allowedDirectories.includes(directory)) {
    throw new Error(
      `Directory "${directory}" is not allowed on server "${serverKey}". ` +
        `Allowed directories: ${serverConfig.allowedDirectories.join(', ')}`
    );
  }

  if (!branch || typeof branch !== 'string') {
    throw new Error('Branch name is required and must be a string');
  }

  if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) {
    throw new Error(
      'Invalid branch name. Only alphanumeric characters, hyphens, underscores, slashes, and dots are allowed'
    );
  }

  if (
    !serverConfig.sshHost ||
    typeof serverConfig.sshHost !== 'string' ||
    serverConfig.sshHost.length === 0
  ) {
    throw new Error(`Server "${serverKey}" has no SSH host configured`);
  }
}

/**
 * Generate git-based deployment commands for Rails application
 *
 * @param {Object} params - Deployment parameters
 * @param {string} params.directory - Application directory
 * @param {string} params.branch - Target branch
 * @returns {string[]} Array of shell commands
 */
function generateGitDeploymentCommands({ directory, branch }) {
  const appPath = `${BASE_DIRECTORY}/${directory}`;

  return [
    // 1. Navigate to application directory
    `cd ${appPath}`,

    // 2. Fetch latest changes from remote
    `git fetch origin`,

    // 3. Stash local changes (if any)
    `git stash`,

    // 4. Switch to main branch and update
    `git checkout ${DEFAULT_MAIN_BRANCH}`,
    `git pull origin ${DEFAULT_MAIN_BRANCH}`,

    // 5. Switch to target branch and update
    `git checkout ${branch}`,
    `git pull origin ${branch}`,

    // 6. Restore stashed changes (if any)
    `git stash pop`,

    // FIXME: rails command not found.
    // 7. Run database migrations
    // `rails db:migrate`,

    // 8. Rebuild assets
    // `rails assets:clobber`,
    // `rails assets:precompile`,

    // FIXME: failed to restart test-tc.service.
    // 9. Restart application service
    // `systemctl restart ${directory}.service`,
  ];
}
