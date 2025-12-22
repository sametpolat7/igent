/**
 * Base Executor - Base executor that delegates to specific implementations
 *
 * Architecture:
 * This is the main executor that orchestrates different agent implementations.
 * Each specific agent (e.g., git-deployment, database-migration, config-update)
 * should have its own implementation in the implementations/ directory.
 */

import { executeGitDeployment } from './implementations/git-deployment/executor.js';
import { AGENT_TYPES } from './planner.js';

/**
 * Execute an agent operation by routing to the appropriate implementation
 *
 * @param {string} agentType - Type of agent operation (e.g., 'git-deployment')
 * @param {Object} params - Parameters specific to the agent type
 * @returns {Promise<Object>} Execution result from the specific agent implementation
 * @throws {Error} If agent type is unknown or execution fails
 */
export async function executeOperation(agentType, params) {
  console.log(`[Executor] Routing to agent type: ${agentType}`);

  switch (agentType) {
    case AGENT_TYPES.GIT_DEPLOYMENT:
      return await executeGitDeployment(params);

    // Future agent implementations can be added here:
    // case AGENT_TYPES.CONFIG_UPDATE:
    //   return await executeConfigUpdate(params);

    default:
      throw new Error(
        `Unknown agent type: "${agentType}". Available types: ${Object.values(AGENT_TYPES).join(', ')}`
      );
  }
}

/**
 * Legacy function for backward compatibility
 * Routes git deployment execution requests to the new structure
 *
 * @deprecated Use executeOperation(AGENT_TYPES.GIT_DEPLOYMENT, params) instead
 */
export async function executeCommands(params) {
  return await executeOperation(AGENT_TYPES.GIT_DEPLOYMENT, params);
}
