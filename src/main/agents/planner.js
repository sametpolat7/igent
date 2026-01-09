import { planServerUpdate } from './server-update/planner.js';
import { planQueueControl } from './queue-control/planner.js';
import {
  planFileEdit,
  planRestore,
  getFileEditFunctions,
} from './file-editing/planner.js';
import { logDebug } from '../utils/logger.js';

export const AGENT_TYPES = {
  SERVER_UPDATE: 'server-update',
  QUEUE_CONTROL: 'queue-control',
  FILE_EDITING: 'file-editing',
};

export function planProcess(agentType, params) {
  logDebug('Planner', `Routing to ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.SERVER_UPDATE:
      return planServerUpdate(params);

    case AGENT_TYPES.QUEUE_CONTROL:
      return planQueueControl(params);

    case AGENT_TYPES.FILE_EDITING:
      return planFileEdit(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}

export { getFileEditFunctions, planRestore };
