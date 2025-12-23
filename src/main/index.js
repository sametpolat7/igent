import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planOperation, AGENT_TYPES } from './agent/planner.js';
import { executeOperation } from './agent/executor.js';
import { loadServersConfig } from './config/loadConfig.js';
import { logError } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}
function registerIPCHandlers() {
  ipcMain.handle('agent:get-servers', async () => {
    try {
      return loadServersConfig();
    } catch (error) {
      logError('IPC', 'Failed to load servers', error);
      throw new Error(`Configuration error: ${error.message}`);
    }
  });

  ipcMain.handle('agent:plan-deploy', async (_event, payload) => {
    try {
      return planOperation(AGENT_TYPES.GIT_DEPLOYMENT, payload);
    } catch (error) {
      logError('IPC', 'Planning failed', error);
      throw new Error(`Planning error: ${error.message}`);
    }
  });

  ipcMain.handle('agent:execute', async (event, payload) => {
    try {
      const progressCallback = (progressData) => {
        event.sender.send('agent:progress', progressData);
      };

      return await executeOperation(AGENT_TYPES.GIT_DEPLOYMENT, {
        ...payload,
        progressCallback,
      });
    } catch (error) {
      logError('IPC', 'Execution failed', error);
      throw new Error(`Execution error: ${error.message}`);
    }
  });
}

app.whenReady().then(() => {
  registerIPCHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
