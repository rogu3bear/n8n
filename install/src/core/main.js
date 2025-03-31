const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const fsPromises = fs.promises;
const crypto = require('crypto');
const log = require('electron-log');
console.log('electron-log loaded successfully');
const debug = require('debug')('n8n:main');
const { spawn } = require('child_process');
const net = require('net');
const os = require('os');
const { excelService } = require('../services/excelService');
const { exec } = require('child_process');

// Constants
const APP_NAME = 'n8n';
const APP_VERSION = '1.0.0';
const DEFAULT_PORT = 5678;
const LOG_DIR = path.join(os.homedir(), '.n8n', 'logs');
const CONFIG_DIR = path.join(os.homedir(), '.n8n', 'config');

// Global state
let mainWindow = null;
let n8nProcess = null;
let currentPort = DEFAULT_PORT;

// Ensure directories exist
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(CONFIG_DIR, { recursive: true });

// Configure logging
log.transports.file.resolvePathFn = () => path.join(LOG_DIR, 'main.log');
log.transports.file.level = 'debug';
log.transports.console.level = 'info';

// Test logging
log.info('Application starting...');
log.debug('Debug mode enabled');

// Test mode handling
if (process.argv.includes('--test-mode')) {
  const testWorkflow = require('../tests/testWorkflow');
  log.info('Running in test mode...');
  testWorkflow.execute().then(() => {
    log.info('Test workflow completed successfully');
    app.quit(0);
  }).catch((err) => {
    log.error('Test workflow failed:', err);
    app.quit(1);
  });
} else if (process.argv.includes('--perf-test')) {
  console.time('startup');
  app.whenReady().then(() => {
    console.timeEnd('startup');
    app.quit(0);
  }).catch((err) => {
    log.error('Performance test failed:', err);
    app.quit(1);
  });
} else {
  // Normal app startup
  app.whenReady().then(async () => {
    log.info('Creating main window...');
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });

    // Load the appropriate URL based on environment
    if (process.env.NODE_ENV === 'development') {
      log.info('Loading development URL...');
      mainWindow.loadURL('http://localhost:5678');
      mainWindow.webContents.openDevTools();
    } else {
      log.info('Loading production URL...');
      mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, '..', '..', 'dist', 'renderer', 'src', 'renderer', 'index.html'),
        protocol: 'file:',
        slashes: true
      }));
    }

    // Test safeStorage
    try {
      const secret = 'test123';
      const encrypted = safeStorage.encryptString(secret);
      const decrypted = safeStorage.decryptString(encrypted);
      log.info('SafeStorage test successful');
    } catch (error) {
      log.error('SafeStorage test failed:', error);
    }

    // Handle window close
    mainWindow.on('closed', () => {
      log.info('Main window closed');
      mainWindow = null;
    });
  });

  // Quit when all windows are closed
  app.on('window-all-closed', () => {
    log.info('All windows closed, quitting...');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    log.info('App activated, checking window state...');
    if (mainWindow === null) {
      app.whenReady().then(() => {
        log.info('Recreating main window...');
        mainWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true,
            allowRunningInsecureContent: false
          }
        });
        mainWindow.loadURL(url.format({
          pathname: path.join(__dirname, '..', '..', 'dist', 'renderer', 'src', 'renderer', 'index.html'),
          protocol: 'file:',
          slashes: true
        }));
      });
    }
  });
}