const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('aiotDesktop', {requestConsent: (port, opts) => ipcRenderer.invoke('aiot:consent', String(port),
  opts ? {fileSha: String(opts.fileSha), node: String(opts.node), file: String(opts.file)} : undefined)});
