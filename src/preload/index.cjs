const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('igent', {
  getServers: () => ipcRenderer.invoke('agent:get-servers'),

  planDeploy: ({ serverKey, directory, branch }) =>
    ipcRenderer.invoke('agent:plan-deploy', { serverKey, directory, branch }),

  execute: (payload) => ipcRenderer.invoke('agent:execute', payload),
});
