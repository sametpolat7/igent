import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  planProcess,
  planRestore,
  AGENT_TYPES,
  getFileEditFunctions,
} from './agents/planner.js';
import {
  executeProcess,
  checkQueueStatus,
  checkFileChanges,
  restoreFile,
} from './agents/executor.js';
import { loadServersConfig } from './config/loadConfig.js';
import { logError } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 600,
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
  ipcMain.handle('server-update:get-servers', async () => {
    try {
      return loadServersConfig();
    } catch (error) {
      logError('IPC', 'Failed to load servers', error);
      throw new Error('Failed to load servers. Please check your settings.');
    }
  });

  // Server Update handlers
  ipcMain.handle('server-update:plan', async (_event, payload) => {
    try {
      return planProcess(AGENT_TYPES.SERVER_UPDATE, payload);
    } catch (error) {
      logError('IPC', 'Planning failed', error);
      throw new Error(
        'Planning failed. Please verify your server and branch configuration.'
      );
    }
  });

  ipcMain.handle('server-update:execute', async (event, payload) => {
    try {
      const progressCallback = (progressData) => {
        event.sender.send('server-update:progress', progressData);
      };

      return await executeProcess(AGENT_TYPES.SERVER_UPDATE, {
        ...payload,
        progressCallback,
      });
    } catch (error) {
      if (error.isConflict) {
        return {
          success: false,
          isConflict: true,
          conflictType: error.conflictType,
          directory: error.directory,
          branch: error.branch,
          message: error.message,
          totalSteps: error.totalSteps,
          failedAtStep: error.failedAtStep,
          totalDuration: error.totalDuration,
        };
      }

      logError('IPC', 'Execution failed', error);
      throw new Error(
        'Deployment failed. Please try again or contact support if the problem persists.'
      );
    }
  });

  // Queue Control handlers
  ipcMain.handle('queue:check-status', async (_event, payload) => {
    try {
      const serversConfig = loadServersConfig();
      const serverConfig = serversConfig[payload.serverKey];
      if (!serverConfig) {
        throw new Error(`Server "${payload.serverKey}" not found`);
      }
      return await checkQueueStatus({
        sshHost: serverConfig.sshHost,
        directory: payload.directory,
      });
    } catch (error) {
      logError('IPC', 'Queue status check failed', error);
      throw new Error('Failed to check queue status. Please try again.');
    }
  });

  ipcMain.handle('queue:plan', async (_event, payload) => {
    try {
      return planProcess(AGENT_TYPES.QUEUE_CONTROL, payload);
    } catch (error) {
      logError('IPC', 'Queue planning failed', error);
      throw new Error(
        'Planning failed. Please verify your server and directory configuration.'
      );
    }
  });

  ipcMain.handle('queue:execute', async (event, payload) => {
    try {
      const progressCallback = (progressData) => {
        event.sender.send('queue:progress', progressData);
      };

      return await executeProcess(AGENT_TYPES.QUEUE_CONTROL, {
        ...payload,
        progressCallback,
      });
    } catch (error) {
      logError('IPC', 'Queue execution failed', error);
      return {
        success: false,
        action: payload.action,
        directory: payload.directory,
        message: error.message || 'Queue operation failed',
        failedAtStep: error.failedAtStep,
        totalSteps: error.totalSteps,
        stderr: error.stderr,
        failureReason: error.failureReason,
        totalDuration: error.totalDuration,
      };
    }
  });

  // File Editing handlers
  ipcMain.handle('file-edit:get-functions', async () => {
    try {
      return getFileEditFunctions();
    } catch (error) {
      logError('IPC', 'Failed to load file edit configs', error);
      throw new Error('Failed to load file edit configs.');
    }
  });

  ipcMain.handle('file-edit:plan', async (_event, payload) => {
    try {
      return planProcess(AGENT_TYPES.FILE_EDITING, payload);
    } catch (error) {
      logError('IPC', 'File edit planning failed', error);
      throw new Error(
        'Planning failed. Please verify your configuration and inputs.'
      );
    }
  });

  ipcMain.handle('file-edit:execute', async (event, payload) => {
    try {
      const progressCallback = (progressData) => {
        event.sender.send('file-edit:progress', progressData);
      };

      return await executeProcess(AGENT_TYPES.FILE_EDITING, {
        ...payload,
        progressCallback,
      });
    } catch (error) {
      logError('IPC', 'File edit execution failed', error);
      return {
        success: false,
        functionId: payload.functionId,
        functionName: payload.functionName,
        directory: payload.directory,
        message: error.message || 'File edit operation failed',
        failedAtStep: error.failedAtStep,
        totalSteps: error.totalSteps,
        stderr: error.stderr,
        failureReason: error.failureReason,
        totalDuration: error.totalDuration,
      };
    }
  });

  ipcMain.handle('file-edit:check-changes', async (_event, payload) => {
    try {
      const serversConfig = loadServersConfig();
      const serverConfig = serversConfig[payload.serverKey];
      if (!serverConfig) {
        throw new Error(`Server "${payload.serverKey}" not found`);
      }
      return await checkFileChanges({
        sshHost: serverConfig.sshHost,
        directory: payload.directory,
        targetFile: payload.targetFile,
      });
    } catch (error) {
      logError('IPC', 'File changes check failed', error);
      throw new Error('Failed to check file changes. Please try again.');
    }
  });

  ipcMain.handle('file-edit:restore', async (event, payload) => {
    try {
      const plan = planRestore({
        serverKey: payload.serverKey,
        directory: payload.directory,
        targetFile: payload.targetFile,
      });

      return await restoreFile({
        ...plan,
        progressCallback: (progress) => {
          event.sender.send('file-edit:restore-progress', progress);
        },
      });
    } catch (error) {
      logError('IPC', 'File restore failed', error);
      throw new Error('Failed to restore file. Please try again.');
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
