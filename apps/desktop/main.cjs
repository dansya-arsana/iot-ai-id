const {app, BrowserWindow, dialog} = require('electron');
const {createWriteStream, mkdirSync, chmodSync} = require('node:fs');
const {join} = require('node:path');
const {PORT, startBackend, waitReady, stopBackend} = require('./lifecycle.cjs');
let backend, window, log, stopping = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {if (window) {if (window.isMinimized()) window.restore(); window.focus();}});
  app.on('before-quit', event => {
    if (stopping || !backend) return;
    event.preventDefault(); stopping = true;
    stopBackend(backend).finally(() => {log?.end(); app.quit();});
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(async () => {
    app.setAccessibilitySupportEnabled(true);
    const userData = app.getPath('userData'); mkdirSync(userData, {recursive: true, mode: 0o700}); chmodSync(userData, 0o700);
    log = createWriteStream(join(userData, 'backend.log'), {flags: 'a', mode: 0o600});
    const resources = process.resourcesPath;
    try {
      backend = startBackend(resources, userData, log);
      await waitReady(backend);
      const url = `http://127.0.0.1:${PORT}`;
      window = new BrowserWindow({width: 1440, height: 960, minWidth: 1000, minHeight: 650,
        title: 'AIoT', webPreferences: {nodeIntegration: false, contextIsolation: true, sandbox: true}});
      window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
      window.webContents.on('will-navigate', (event, target) => {if (new URL(target).origin !== url) event.preventDefault();});
      window.webContents.on('will-redirect', (event, target) => {if (new URL(target).origin !== url) event.preventDefault();});
      window.webContents.session.webRequest.onHeadersReceived((details, callback) => callback({responseHeaders: {...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'"]}}));
      window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      window.webContents.session.setPermissionCheckHandler(() => false);
      backend.on('exit', () => {if (!stopping) {dialog.showErrorBox('Local runtime stopped', `Restart AIoT. Details: ${join(userData, 'backend.log')}`); app.quit();}});
      await window.loadURL(url);
    } catch (error) {
      dialog.showErrorBox('AIoT could not start', `${error.message}\n\nAdd an AI key in Backoffice → AI settings, or sign in to Codex or Claude Code on this computer.\nDetails: ${join(userData, 'backend.log')}`);
      app.quit();
    }
  });
}
