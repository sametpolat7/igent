const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('igent', {
  version: () => '1.0.0',
});
