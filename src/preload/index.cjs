const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('igent', {
  // Shared
  getServers: () => ipcRenderer.invoke('agent:get-servers'),

  // Server Update
  plan: ({ serverKey, directory, branch }) =>
    ipcRenderer.invoke('agent:plan', { serverKey, directory, branch }),

  execute: (payload) => ipcRenderer.invoke('agent:execute', payload),

  onProgress: (callback) => {
    ipcRenderer.on('agent:progress', (_event, data) => callback(data));
  },

  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('agent:progress');
  },

  // Queue Control
  queue: {
    checkStatus: ({ serverKey, directory }) =>
      ipcRenderer.invoke('queue:check-status', { serverKey, directory }),

    plan: ({ serverKey, directory, action }) =>
      ipcRenderer.invoke('queue:plan', { serverKey, directory, action }),

    execute: (payload) => ipcRenderer.invoke('queue:execute', payload),

    onProgress: (callback) => {
      ipcRenderer.on('queue:progress', (_event, data) => callback(data));
    },

    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('queue:progress');
    },
  },
});
