const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('igent', {
  version: () => '1.0.0',

  planDeploy: (branch) => ipcRenderer.invoke('agent:plan-deploy', { branch }),
});
