import { planServerDeployment } from './types/server-deployment/planner.js';
import { logDebug } from '../utils/logger.js';

export const AGENT_TYPES = {
  SERVER_DEPLOYMENT: 'server-deployment',
};

export function planOperation(agentType, params) {
  logDebug('Planner', `Routing to ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.SERVER_DEPLOYMENT:
      return planServerDeployment(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}
