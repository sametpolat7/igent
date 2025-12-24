const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('igent', {
  getServers: () => ipcRenderer.invoke('agent:get-servers'),

  plan: ({ serverKey, directory, branch }) =>
    ipcRenderer.invoke('agent:plan', { serverKey, directory, branch }),

  execute: (payload) => ipcRenderer.invoke('agent:execute', payload),

  onProgress: (callback) => {
    ipcRenderer.on('agent:progress', (_event, data) => callback(data));
  },

  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('agent:progress');
  },
});
