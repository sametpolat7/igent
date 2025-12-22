/**
 * Base Planner - Base planner that delegates to specific implementations
 *
 * Architecture:
 * This is the main planner that orchestrates different agent implementations.
 * Each specific agent (e.g., git-deployment, database-migration, config-update)
 * should have its own implementation in the implementations/ directory.
 */

import { planGitDeployment } from './implementations/git-deployment/planner.js';

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
  console.log(`[Planner] Routing to agent type: ${agentType}`);

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

/**
 * Legacy function for backward compatibility
 * Routes git deployment requests to the new structure
 *
 * @deprecated Use planOperation(AGENT_TYPES.GIT_DEPLOYMENT, params) instead
 */
export function planDeployment(params) {
  return planOperation(AGENT_TYPES.GIT_DEPLOYMENT, params);
}
