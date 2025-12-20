/**
 * Preload Script - Secure IPC (Inter-Process Communication) Bridge (Context Bridge)
 *
 * This is the security layer between the renderer (UI) and main process (Node.js).
 *
 * Key Security Features:
 * - Uses contextBridge to expose ONLY approved APIs to renderer
 * - Prevents direct Node.js/Electron API access from renderer
 * - All communication goes through validated IPC channels
 * - Protects against code injection and privilege escalation
 *
 * Future extensibility:
 * - Add request/response logging for debugging
 * - Add API usage analytics
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose secure API to renderer process via window.igent
 *
 * This is the ONLY way the renderer can communicate with the main process.
 * Only add methods here that are safe and necessary for the UI.
 */
contextBridge.exposeInMainWorld('igent', {
  /**
   * Get available servers configuration
   * @returns {Promise<Object>} Servers configuration object
   */
  getServers: () => ipcRenderer.invoke('agent:get-servers'),

  /**
   * Plan a deployment (validate and generate commands)
   * @param {Object} params - Deployment parameters
   * @param {string} params.serverKey - Server identifier
   * @param {string} params.directory - Application directory
   * @param {string} params.branch - Git branch name
   * @returns {Promise<Object>} Deployment plan with commands
   */
  planDeploy: ({ serverKey, directory, branch }) =>
    ipcRenderer.invoke('agent:plan-deploy', { serverKey, directory, branch }),

  /**
   * Execute deployment commands on remote server
   * @param {Object} payload - Deployment plan from planDeploy
   * @returns {Promise<Object>} Execution result
   */
  execute: (payload) => ipcRenderer.invoke('agent:execute', payload),

  // Future APIs can be added here as the application evolves:
  // - getLogs: () => ipcRenderer.invoke('agent:get-logs'),
  // - cancelExecution: (id) => ipcRenderer.invoke('agent:cancel', id),
  // - getDeploymentHistory: () => ipcRenderer.invoke('agent:get-history'),
});
