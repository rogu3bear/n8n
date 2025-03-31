import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as docker from './docker';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the index.html of the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for Docker operations
ipcMain.handle('check-docker', async () => {
  return await docker.checkDockerInstallation();
});

ipcMain.handle('check-docker-running', async () => {
  return await docker.checkDockerRunning();
});

ipcMain.handle('get-docker-version', async () => {
  return await docker.getDockerVersion();
});

ipcMain.handle('get-docker-installation-guide', () => {
  return docker.getDockerInstallationGuide();
});

ipcMain.handle('get-cli-installation-instructions', () => {
  return docker.getCLIInstallationInstructions();
}); 