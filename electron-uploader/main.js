const path = require('path');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');

let mainWindow = null;
let currentAbortController = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#f2f4f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-export', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Export Folder, CSV, or ZIP',
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'Export', extensions: ['zip', 'csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return '';
  return result.filePaths[0];
});

ipcMain.handle('select-art', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Album Art (Optional)',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return '';
  return result.filePaths[0];
});

ipcMain.handle('start-upload', async (event, payload) => {
  const corePath = path.join(__dirname, 'core.js');
  const { runUpload } = require(corePath);
  currentAbortController = new AbortController();

  const sendStatus = (msg) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('status', msg);
    }
  };

  try {
    await runUpload({
      ...payload,
      signal: currentAbortController.signal,
      onStatus: sendStatus
    });
    sendStatus('Done. Review the draft and publish manually when ready.');
    return { ok: true };
  } catch (err) {
    sendStatus(`Error: ${err.message || err}`);
    return { ok: false, error: String(err) };
  } finally {
    currentAbortController = null;
  }
});

ipcMain.handle('cancel-upload', async () => {
  if (currentAbortController) currentAbortController.abort();
  return { ok: true };
});

ipcMain.handle('open-log', async (event, logPath) => {
  if (!logPath) return { ok: false };
  await shellOpen(logPath);
  return { ok: true };
});

async function shellOpen(targetPath) {
  const { shell } = require('electron');
  await shell.openPath(targetPath);
}
