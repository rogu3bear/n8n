const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs'); // For synchronous fs operations
const fsPromises = fs.promises; // For promise-based fs operations
const crypto = require('crypto');
const log = require('electron-log');
const debug = require('debug')('n8n:main');
const { spawn } = require('child_process');
const net = require('net');
const os = require('os'); // Import os module
const { excelService } = require('../services/excelService');
const { exec } = require('child_process');

// Constants
const KEYCHAIN_SERVICE = 'n8n-electron-wrapper';
const KEYCHAIN_ACCOUNT_PREFIX = 'auth-token-';
const TOKEN_TTL = 30 * 60 * 1000; // 30 minutes
const TOKEN_LENGTH = 48; // 48 bytes
const API_KEYS_ACCOUNT = 'api-keys';
const CONFIG_FILENAME = 'config.json';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits, standard for AES
const MAX_PORT_ATTEMPTS = 10;
const PORT_RANGE = { start: 5678, end: 5688 };
const MAX_N8N_START_ATTEMPTS = 3;
const N8N_START_TIMEOUT = 30000; // 30 seconds timeout
const N8N_PROCESS_CHECK_INTERVAL = 1000; // Check every second
const WORKFLOW_DIR = path.join(app.getPath('userData'), 'workflows');

// Global state
let n8nProcess = null;
let mainWindow = null;
let activePort = null;
let isEnsuringWorkflows = false;
let internalApiKey = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Test mode handling
if (process.argv.includes('--test-mode')) {
  const testWorkflow = require('../tests/testWorkflow');
  console.log('Running in test mode...');
  testWorkflow.execute().then(() => {
    console.log('Test workflow completed successfully');
    app.quit(0);
  }).catch((err) => {
    console.error('Test workflow failed:', err);
    app.quit(1);
  });
} else if (process.argv.includes('--perf-test')) {
  console.time('startup');
  app.whenReady().then(() => {
    console.timeEnd('startup');
    app.quit(0);
  }).catch((err) => {
    console.error('Performance test failed:', err);
    app.quit(1);
  });
} else {
  // Normal app startup
  // --- Logging Configuration ---
  /**
   * Setup logging
   */
  function setupLogging() {
    try {
      debug('Setting up logging...');
      // Create logs directory if it doesn't exist
      const logsPath = path.join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath, { recursive: true });
        debug('Created logs directory:', logsPath);
      }
      
      // Configure electron-log
      log.transports.file.resolvePath = (variables) => {
        return path.join(logsPath, `${variables.date}.log`);
      };
      
      // Set log levels based on environment
      const logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
      log.transports.console.level = logLevel;
      log.transports.file.level = 'info';
      debug('Log levels set - console:', logLevel, 'file: info');
      
      // Max log size and rotation
      log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
      log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
      
      // Catch uncaught exceptions
      process.on('uncaughtException', (error) => {
        debug('Uncaught exception:', error);
        log.error('Uncaught exception:', error);
      });
      
      // Catch unhandled promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        debug('Unhandled promise rejection:', reason);
        log.error('Unhandled promise rejection:', reason);
      });
      
      log.info('Logging setup complete');
      debug('Environment info:', {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        userDataPath: app.getPath('userData')
      });
      
      return true;
    } catch (error) {
      debug('Error setting up logging:', error);
      console.error('Error setting up logging:', error);
      return false;
    }
  }

  // --- Helper Functions ---
  /**
   * Get the path to the config directory
   * @returns {string} The path to the config directory
   */
  function getConfigPath() {
    try {
      // Explicitly re-require fs if needed since we've seen issues with it
      const fs = require('fs');
      
      // Use app.getPath('userData') for standard Electron app data location
      const userDataPath = app.getPath('userData');
      const configPath = path.join(userDataPath, 'n8n-config');
      
      log.info(`Config path determined as: ${configPath}`);
      
      // Extra safety check for fs
      if (typeof fs.existsSync !== 'function') {
        log.error('fs.existsSync is not a function, using fs from new require');
        // Try to use a fresh import of fs
        const freshFs = require('fs');
        if (typeof freshFs.existsSync !== 'function') {
          log.error('Still cannot access fs.existsSync, will assume directory needs creation');
          try {
            freshFs.mkdirSync(configPath, { recursive: true });
            log.info(`Created n8n config directory at: ${configPath}`);
          } catch (mkdirErr) {
            log.error(`Failed to create directory: ${mkdirErr.message}`);
          }
        } else {
          // Use the fresh fs
          if (!freshFs.existsSync(configPath)) {
            freshFs.mkdirSync(configPath, { recursive: true });
            log.info(`Created n8n config directory at: ${configPath}`);
          }
        }
      } else {
        // Normal path - fs is working properly
        if (!fs.existsSync(configPath)) {
          fs.mkdirSync(configPath, { recursive: true });
          log.info(`Created n8n config directory at: ${configPath}`);
        }
      }
      
      return configPath;
    } catch (error) {
      log.error(`Error getting config path: ${error.message}`);
      if (error.stack) {
        log.error(`Stack trace: ${error.stack}`);
      }
      
      // Try one more approach - get userData path and assume the rest
      try {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'n8n-config');
        log.info(`Fallback config path: ${configPath}`);
        return configPath;
      } catch (fallbackError) {
        log.error(`Fallback config path failed: ${fallbackError.message}`);
        return null;
      }
    }
  }

  /**
   * Check if the config file exists
   * @returns {boolean} True if the config file exists
   */
  function checkConfigExists() {
    try {
      // Explicitly re-require fs if needed
      const fs = require('fs');
      
      const configPath = getConfigPath();
      if (!configPath) return false;
      
      const configFile = path.join(configPath, 'config');
      
      // Extra safety check for fs
      if (typeof fs.existsSync !== 'function') {
        log.error('fs.existsSync is not a function in checkConfigExists, using fs from new require');
        // Try to use a fresh import of fs
        const freshFs = require('fs');
        if (typeof freshFs.existsSync !== 'function') {
          log.error('Still cannot access fs.existsSync in checkConfigExists, will return false');
          return false;
        } else {
          return freshFs.existsSync(configFile);
        }
      } else {
        // Normal path
        return fs.existsSync(configFile);
      }
    } catch (error) {
      log.error(`Error checking config existence: ${error.message}`);
      if (error.stack) {
        log.error(`Stack trace: ${error.stack}`);
      }
      return false;
    }
  }

  /**
   * Get the encryption key using safeStorage
   * @returns {string|null} The encryption key or null if not found
   */
  async function getEncryptionKey() {
    try {
      const appName = app.getName();
      const keyringService = `${appName}-n8n`;
      const keyringAccount = 'n8n-encryption-key';
      
      // Try to get the key from the config file
      const configPath = path.join(getConfigPath(), 'encryption.key');
      let encryptionKey;
      
      try {
        const keyData = await fsPromises.readFile(configPath);
        encryptionKey = safeStorage.decryptString(keyData);
      } catch (error) {
        // If key doesn't exist, generate a new one
        log.info('Encryption key not found, generating a new one');
        encryptionKey = generateEncryptionKey();
        
        // Store the new key using safeStorage
        const encryptedKey = safeStorage.encryptString(encryptionKey);
        await fsPromises.writeFile(configPath, encryptedKey);
      }
      
      return encryptionKey;
    } catch (error) {
      log.error(`Error getting encryption key: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate a random encryption key
   * @returns {string} A random encryption key
   */
  function generateEncryptionKey() {
    // Generate a secure random key of 32 bytes (256 bits)
    const keyLength = 32;
    return crypto.randomBytes(keyLength).toString('hex');
  }

  // --- App Initialization ---
  async function initializeApp() {
    try {
      setupLogging();
      
      // Ensure config directory exists
      const configPath = getConfigPath();
      if (!configPath) {
        throw new Error('Failed to initialize config directory');
      }
      
      // Start n8n process
      await startN8nProcess();
      
      // Create main window
      await createWindow();
      
      // Setup IPC handlers
      setupIpcHandlers();
      
      log.info('App initialization complete');
      return true;
    } catch (error) {
      log.error('Failed to initialize app:', error);
      return false;
    }
  }

  // --- Window Management ---
  async function createWindow() {
    try {
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          webSecurity: true
        }
      });
      
      // Load the app
      if (process.env.NODE_ENV === 'development') {
        await mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
      } else {
        await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
      }
      
      mainWindow.on('closed', () => {
        mainWindow = null;
      });
      
      return true;
    } catch (error) {
      log.error('Failed to create window:', error);
      return false;
    }
  }

  // --- App Lifecycle ---
  app.whenReady().then(async () => {
    const success = await initializeApp();
    if (!success) {
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (mainWindow === null) {
      await createWindow();
    }
  });

  // --- Process Management ---
  async function startN8nProcess() {
    try {
      const port = await findAvailablePort();
      if (!port) {
        throw new Error('No available ports found');
      }
      
      activePort = port;
      
      // Start n8n process
      n8nProcess = spawn('n8n', ['start', '--port', port.toString()], {
        stdio: 'pipe',
        shell: true
      });
      
      // Handle process output
      n8nProcess.stdout.on('data', (data) => {
        log.info(`n8n stdout: ${data}`);
      });
      
      n8nProcess.stderr.on('data', (data) => {
        log.error(`n8n stderr: ${data}`);
      });
      
      // Handle process exit
      n8nProcess.on('close', (code) => {
        log.info(`n8n process exited with code ${code}`);
        n8nProcess = null;
      });
      
      return true;
    } catch (error) {
      log.error('Failed to start n8n process:', error);
      return false;
    }
  }

  async function stopN8nProcess() {
    if (n8nProcess) {
      try {
        n8nProcess.kill();
        n8nProcess = null;
        return true;
      } catch (error) {
        log.error('Failed to stop n8n process:', error);
        return false;
      }
    }
    return true;
  }

  // --- Port Management ---
  async function findAvailablePort() {
    for (let port = PORT_RANGE.start; port <= PORT_RANGE.end; port++) {
      try {
        const isAvailable = await new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(port);
        });
        
        if (isAvailable) {
          return port;
        }
      } catch (error) {
        log.error(`Error checking port ${port}:`, error);
      }
    }
    return null;
  }

  // --- IPC Handlers ---
  function setupIpcHandlers() {
    // Add your IPC handlers here
    ipcMain.handle('app:get-version', () => app.getVersion());
    ipcMain.handle('app:get-platform', () => process.platform);
    ipcMain.handle('app:get-arch', () => process.arch);
    
    // Handle workflow execution
    ipcMain.handle('execute-workflow', async (event, workflow) => {
      try {
        const workflowPath = await saveWorkflow(workflow, workflow.name);
        const output = await executeWorkflowLocally(workflowPath);
        return { success: true, output };
      } catch (error) {
        log.error(`Workflow execution failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Execute a workflow locally without API key
   * @param {string} workflowPath Path to the workflow file
   * @returns {Promise<string>} The workflow output
   */
  async function executeWorkflowLocally(workflowPath) {
    try {
      log.info(`Executing workflow from: ${workflowPath}`);
      
      return new Promise((resolve, reject) => {
        exec(`npx n8n execute --file=${workflowPath}`, (error, stdout, stderr) => {
          if (error) {
            log.error(`Error executing workflow: ${stderr}`);
            return reject(error);
          }
          log.info(`Workflow output: ${stdout}`);
          resolve(stdout);
        });
      });
    } catch (error) {
      log.error(`Failed to execute workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save a workflow to the local filesystem
   * @param {Object} workflow The workflow object
   * @param {string} name The workflow name
   * @returns {Promise<string>} The path to the saved workflow
   */
  async function saveWorkflow(workflow, name) {
    try {
      // Ensure workflow directory exists
      if (!fs.existsSync(WORKFLOW_DIR)) {
        fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
      }
      
      // Create a safe filename
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const workflowPath = path.join(WORKFLOW_DIR, `${safeName}.json`);
      
      // Save the workflow
      await fsPromises.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
      log.info(`Saved workflow to: ${workflowPath}`);
      
      return workflowPath;
    } catch (error) {
      log.error(`Failed to save workflow: ${error.message}`);
      throw error;
    }
  }
}