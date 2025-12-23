import { executeServerDeployment } from './types/server-deployment/executor.js';
import { AGENT_TYPES } from './planner.js';
import { logDebug } from '../utils/logger.js';

export async function executeOperation(agentType, params) {
  logDebug('Executor', `Routing to ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.SERVER_DEPLOYMENT:
      return await executeServerDeployment(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}
