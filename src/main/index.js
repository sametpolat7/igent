import { app, BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planDeployment } from './agent/planner.js';
import { executeCommands } from './agent/executor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  ipcMain.handle('agent:plan-deploy', async (_event, payload) => {
    return planDeployment(payload);
  });

  ipcMain.handle('agent:execute', async (_event, commands) => {
    return executeCommands(commands);
  });
}

app.whenReady().then(createWindow);
