/**
 * Main Process - Application Entry Point
 *
 * Responsibilities:
 * - Create and manage application windows
 * - Handle IPC communication from renderer process
 * - Coordinate deployment planning and execution
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planOperation, AGENT_TYPES } from './agent/planner.js';
import { executeOperation } from './agent/executor.js';
import { loadServersConfig } from './config/loadConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Enable secure bridge between main and renderer
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the application UI
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

// Register IPC handlers for renderer communication
function registerIPCHandlers() {
  // Get available servers configuration
  ipcMain.handle('agent:get-servers', async () => {
    try {
      return loadServersConfig();
    } catch (error) {
      console.error('Failed to load servers:', error);
      throw new Error(`Configuration error: ${error.message}`);
    }
  });

  // Deployment planning
  ipcMain.handle('agent:plan-deploy', async (_event, payload) => {
    try {
      return planOperation(AGENT_TYPES.GIT_DEPLOYMENT, payload);
    } catch (error) {
      console.error('Planning failed:', error);
      throw new Error(`Planning error: ${error.message}`);
    }
  });

  // Execute commands on remote server
  ipcMain.handle('agent:execute', async (_event, payload) => {
    try {
      return await executeOperation(AGENT_TYPES.GIT_DEPLOYMENT, payload);
    } catch (error) {
      console.error('Execution failed:', error);
      throw new Error(`Execution error: ${error.message}`);
    }
  });
}

app.whenReady().then(() => {
  registerIPCHandlers();
  createWindow();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit app when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
