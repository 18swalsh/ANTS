const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ants', {
  selectExport: () => ipcRenderer.invoke('select-export'),
  selectArt: () => ipcRenderer.invoke('select-art'),
  startUpload: (payload) => ipcRenderer.invoke('start-upload', payload),
  cancelUpload: () => ipcRenderer.invoke('cancel-upload'),
  onStatus: (handler) => ipcRenderer.on('status', (_evt, msg) => handler(msg))
});
