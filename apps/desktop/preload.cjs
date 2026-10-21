const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('aiotDesktop', {requestConsent: port => ipcRenderer.invoke('aiot:consent', String(port))});
