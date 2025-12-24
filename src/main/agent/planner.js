import { planServerUpdate } from './types/server-update/planner.js';
import { logDebug } from '../utils/logger.js';

export const AGENT_TYPES = {
  SERVER_UPDATE: 'server-update',
};

export function planProcess(agentType, params) {
  logDebug('Planner', `Routing to ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.SERVER_UPDATE:
      return planServerUpdate(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}
