import { loadServersConfig } from '../../config/loadConfig.js';
import {
  validateString,
  validateNonEmpty,
  validateIncludes,
} from '../../utils/validators.js';
import { logSuccess } from '../../utils/logger.js';

const BASE_DIRECTORY = '/var/webs';

export const QUEUE_ACTIONS = {
  CHECK: 'check',
  START: 'start',
  STOP: 'stop',
  RESTART: 'restart',
};

export function planQueueControl({ serverKey, directory, action }) {
  const serversConfig = loadServersConfig();

  validateString(serverKey, 'Server key');
  validateNonEmpty(serverKey, 'Server key');
  validateIncludes(serverKey, Object.keys(serversConfig), 'Server key');

  const serverConfig = serversConfig[serverKey];

  validateString(directory, 'Directory');
  validateNonEmpty(directory, 'Directory');
  validateIncludes(directory, serverConfig.allowedDirectories, 'Directory');

  validateString(action, 'Action');
  validateNonEmpty(action, 'Action');
  validateIncludes(action, Object.values(QUEUE_ACTIONS), 'Action');

  const commands = generateQueueCommands(action, directory);

  const plan = {
    serverKey,
    directory,
    action,
    commands,
    sshHost: serverConfig.sshHost,
    createdAt: new Date().toISOString(),
  };

  logSuccess('queueControl', 'Plan created', {
    server: serverKey,
    directory,
    action,
    commands: commands.length,
  });

  return plan;
}

function generateQueueCommands(action, directory) {
  const appPath = `${BASE_DIRECTORY}/${directory}`;
  const checkCommand = `ps aux | grep -E "sidekiq.*${directory}" | grep -v grep`;
  const cdCommand = `cd ${appPath}`;
  const startSidekiqCommand = `setsid nohup bundle exec sidekiq -e production -C config/sidekiq.yml > sidekiq.log 2>&1 < /dev/null &`;

  // Graceful shutdown: TSTP pauses workers, TERM initiates shutdown
  const pauseQueueCommand = 'kill -TSTP {{PID}}';
  const stopQueueCommand = 'kill -TERM {{PID}}';

  // Verification markers - executor will poll server to confirm state
  const verifyStoppedMarker = '{{VERIFY_STOPPED}}';
  const verifyStartedMarker = '{{VERIFY_STARTED}}';

  switch (action) {
    case QUEUE_ACTIONS.CHECK:
      return [checkCommand];

    case QUEUE_ACTIONS.START:
      return [
        checkCommand,
        cdCommand,
        startSidekiqCommand,
        verifyStartedMarker,
      ];

    case QUEUE_ACTIONS.STOP:
      return [
        checkCommand,
        pauseQueueCommand,
        stopQueueCommand,
        verifyStoppedMarker,
      ];

    case QUEUE_ACTIONS.RESTART:
      return [
        checkCommand,
        pauseQueueCommand,
        stopQueueCommand,
        verifyStoppedMarker,
        cdCommand,
        startSidekiqCommand,
        verifyStartedMarker,
      ];

    default:
      throw new Error(`Unknown queue action: ${action}`);
  }
}
