/**
 * Base Planner - Routes planning requests to specific agent types
 *
 * Architecture:
 * This is the main planner that orchestrates different agent types.
 * Each specific agent (e.g., git-deployment, database-migration, config-update)
 * should have its own implementation in the types/ directory.
 */

import { planGitDeployment } from './types/git-deployment/planner.js';
import { logDebug } from '../utils/logger.js';

export const AGENT_TYPES = {
  GIT_DEPLOYMENT: 'git-deployment',
  // Future agent types can be added here:
  // CONFIG_UPDATE: 'config-update',
};

/**
 * Plan an agent operation by routing to the appropriate implementation
 *
 * @param {string} agentType - Type of agent operation (e.g., 'git-deployment')
 * @param {Object} params - Parameters specific to the agent type
 * @returns {Object} Operation plan from the specific agent implementation
 * @throws {Error} If agent type is unknown or planning fails
 */
export function planOperation(agentType, params) {
  logDebug('Planner', `Routing to ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.GIT_DEPLOYMENT:
      return planGitDeployment(params);

    // Future agent implementations can be added here:
    // case AGENT_TYPES.CONFIG_UPDATE:
    //   return planConfigUpdate(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}
