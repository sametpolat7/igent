import { loadServersConfig } from '../../../config/loadConfig.js';
import {
  validateString,
  validateNonEmpty,
  validatePattern,
  validateIncludes,
} from '../../../utils/validators.js';
import { logSuccess } from '../../../utils/logger.js';

const BASE_DIRECTORY = '/var/webs';
const DEFAULT_MAIN_BRANCH = 'main';

export function planServerDeployment({ serverKey, directory, branch }) {
  const serversConfig = loadServersConfig();

  validateString(serverKey, 'Server key');
  validateNonEmpty(serverKey, 'Server key');
  validateIncludes(serverKey, Object.keys(serversConfig), 'Server key');

  const serverConfig = serversConfig[serverKey];

  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  if (!serverConfig.allowedDirectories) {
    throw new Error(
      `Server "${serverKey}" has no allowed directories configured`
    );
  }
  validateIncludes(directory, serverConfig.allowedDirectories, 'Directory');

  validateString(branch, 'Branch name');
  validateNonEmpty(branch, 'Branch name');
  validatePattern(branch, /^[a-zA-Z0-9_./-]+$/, 'Branch name');

  if (!serverConfig.sshHost || serverConfig.sshHost.length === 0) {
    throw new Error(`Server "${serverKey}" has no SSH host configured`);
  }

  const commands = generateServerDeploymentCommands({
    directory,
    branch,
  });

  const plan = {
    serverKey,
    directory,
    branch,
    commands,
    sshHost: serverConfig.sshHost,
    createdAt: new Date().toISOString(),
  };

  logSuccess('ServerDeployment', 'Plan created', {
    server: serverKey,
    directory,
    branch,
    commands: commands.length,
  });

  return plan;
}

function generateServerDeploymentCommands({ directory, branch }) {
  const appPath = `${BASE_DIRECTORY}/${directory}`;

  return [
    `cd ${appPath}`,
    `git fetch origin`,
    `git stash`,
    `git checkout ${DEFAULT_MAIN_BRANCH}`,
    `git pull origin ${DEFAULT_MAIN_BRANCH}`,
    `git checkout ${branch}`,
    `git pull origin ${branch}`,
    `git stash pop || true`,
    `rails db:migrate`,
    `rails assets:clobber`,
    `rails assets:precompile`,
    `sudo systemctl restart ${directory}.service`,
  ];
}
