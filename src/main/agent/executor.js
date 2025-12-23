import { executeGitDeployment } from './types/git-deployment/executor.js';
import { AGENT_TYPES } from './planner.js';
import { logDebug } from '../utils/logger.js';

export async function executeOperation(agentType, params) {
  logDebug('Executor', `Routing to ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.GIT_DEPLOYMENT:
      return await executeGitDeployment(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}
