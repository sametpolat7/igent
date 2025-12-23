import { planGitDeployment } from './types/git-deployment/planner.js';
import { logDebug } from '../utils/logger.js';

export const AGENT_TYPES = {
  GIT_DEPLOYMENT: 'git-deployment',
};

export function planOperation(agentType, params) {
  logDebug('Planner', `Routing to ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.GIT_DEPLOYMENT:
      return planGitDeployment(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}
