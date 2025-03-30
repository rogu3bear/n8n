const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs'); // For synchronous fs operations
const fsPromises = fs.promises; // For promise-based fs operations
const crypto = require('crypto');
const keytar = require('keytar');
const log = require('electron-log');
const { spawn } = require('child_process');
const net = require('net');
const nodeNet = require('net'); // Import Node.js net module separately
const os = require('os'); // Import os module
const Docker = require('dockerode');

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

// Global state
let n8nProcess = null;
let mainWindow = null;
let activePort = null;
let isEnsuringWorkflows = false;
let internalApiKey = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

const docker = new Docker();

// Ensure scripts directory exists
const scriptsDir = path.join(__dirname, 'scripts');
if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
}

// --- Logging Configuration ---
/**
 * Setup logging
 */
function setupLogging() {
  try {
    // Create logs directory if it doesn't exist
    const logsPath = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }
    
    // Configure electron-log
    log.transports.file.resolvePath = (variables) => {
      return path.join(logsPath, `${variables.date}.log`);
    };
    
    // Set log levels
    log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    log.transports.file.level = 'info';
    
    // Max log size and rotation
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    
    // Catch uncaught exceptions
    process.on('uncaughtException', (error) => {
      log.error('Uncaught exception:', error);
    });
    
    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled promise rejection:', reason);
    });
    
    log.info('Logging setup complete');
    log.info(`App version: ${app.getVersion()}`);
    log.info(`Electron version: ${process.versions.electron}`);
    log.info(`Chrome version: ${process.versions.chrome}`);
    log.info(`Node.js version: ${process.versions.node}`);
    log.info(`Platform: ${process.platform}`);
    log.info(`Arch: ${process.arch}`);
    log.info(`User data path: ${app.getPath('userData')}`);
    
    return true;
  } catch (error) {
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
 * Get the encryption key from the system keychain
 * @returns {string|null} The encryption key or null if not found
 */
function getEncryptionKey() {
  try {
    const appName = app.getName();
    const keyringService = `${appName}-n8n`;
    const keyringAccount = 'n8n-encryption-key';
    
    // Try to get the key from the keychain
    const encryptionKey = keytar.getPassword(keyringService, keyringAccount);
    
    // If the key doesn't exist, generate a new one and store it
    if (!encryptionKey) {
      log.info('Encryption key not found, generating a new one');
      const newKey = generateEncryptionKey();
      
      // Store the new key in the keychain
      keytar.setPassword(keyringService, keyringAccount, newKey);
      return newKey;
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

// --- Docker Check ---
/**
 * Check if Docker is running by trying to get the version.
 * @returns {Promise<boolean>} True if Docker is running, false otherwise.
 */
async function isDockerRunning() {
    return new Promise((resolve) => {
        const dockerProcess = spawn('docker', ['version']);
        dockerProcess.on('error', (err) => {
            log.error(`Docker command failed: ${err.message}. Is Docker installed and running?`);
            resolve(false);
        });
        dockerProcess.on('close', (code) => {
            if (code !== 0) {
                log.warn(`Docker version command exited with code ${code}. Is Docker running?`);
            }
            resolve(code === 0);
        });
    });
}

// --- Process Management (Docker) ---

const DOCKER_CONTAINER_NAME = 'n8n-desktop-instance';

/**
 * Kill any existing n8n Docker containers managed by this app.
 */
async function killExistingN8nProcesses() {
    log.info(`Attempting to remove existing container: ${DOCKER_CONTAINER_NAME}`);
    return new Promise((resolve) => {
        // Use rm -f to force removal if running, ignore errors if not found
        const dockerProcess = spawn('docker', ['rm', '-f', DOCKER_CONTAINER_NAME]);
        
        dockerProcess.stderr.on('data', (data) => {
            const output = data.toString();
            // Ignore "No such container" errors, log others
            if (!output.includes('No such container')) {
                log.warn(`docker rm stderr: ${output.trim()}`);
            }
        });

        dockerProcess.on('close', (code) => {
            if (code === 0) {
                log.info(`Successfully removed existing container ${DOCKER_CONTAINER_NAME}.`);
            } else {
                // Code 1 is expected if the container didn't exist
                if (!code === 1) { 
                  log.warn(`docker rm exited with code ${code}`);
                } else {
                  log.info(`No existing container named ${DOCKER_CONTAINER_NAME} found to remove.`);
                }
            }
            resolve(); // Resolve regardless of whether the container existed
        });

        dockerProcess.on('error', (err) => {
           log.error(`Failed to execute docker rm: ${err.message}`);
           resolve(); // Resolve even on command error to avoid blocking initialization
        });
    });
}

/**
 * Start the n8n Docker container
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function startN8nProcess() {
    try {
        // Check if container exists
        const containers = await docker.listContainers({ all: true });
        const existingContainer = containers.find(c => c.Names.includes('/n8n-desktop-instance'));

        if (existingContainer) {
            if (existingContainer.State === 'running') {
                log.info('n8n container is already running');
                return true;
            }
            // Remove existing container if it's not running
            await docker.getContainer(existingContainer.Id).remove();
        }

        // Create and start new container
        const container = await docker.createContainer({
            Image: 'docker.n8n.io/n8nio/n8n',
            name: 'n8n-desktop-instance',
            ExposedPorts: {
                '5678/tcp': {}
            },
            HostConfig: {
                PortBindings: {
                    '5678/tcp': [{ HostPort: '5678' }]
                },
                Binds: [
                    `${getConfigPath()}:/home/node/.n8n`
                ],
                RestartPolicy: {
                    Name: 'unless-stopped'
                }
            },
            Env: [
                'N8N_HOST=localhost',
                'N8N_PORT=5678',
                'N8N_PROTOCOL=http',
                'N8N_USER_MANAGEMENT_DISABLED=true',
                'N8N_DIAGNOSTICS_ENABLED=false',
                'N8N_HIRING_BANNER_ENABLED=false',
                'N8N_PERSONALIZATION_ENABLED=false'
            ]
        });

        await container.start();
        log.info('n8n container started successfully');
        return true;
    } catch (error) {
        log.error(`Failed to start n8n container: ${error.message}`);
        return false;
    }
}

/**
 * Stop the n8n Docker container
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function stopN8nProcess() {
    try {
        const containers = await docker.listContainers({ all: true });
        const container = containers.find(c => c.Names.includes('/n8n-desktop-instance'));

        if (container) {
            const containerInstance = docker.getContainer(container.Id);
            await containerInstance.stop();
            await containerInstance.remove();
            log.info('n8n container stopped and removed successfully');
            return true;
        }
        return true; // Container doesn't exist, consider it stopped
    } catch (error) {
        log.error(`Failed to stop n8n container: ${error.message}`);
        return false;
    }
}

// --- Window Management ---
async function createWindow() {
    try {
        // Setup n8n dependencies
        await setupN8nDependencies();
        
        // Start n8n process
        await startN8nProcess();

        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        mainWindow.loadFile('index.html');

        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    } catch (error) {
        log.error('Failed to initialize the application:', error);
        app.quit();
    }
}

// --- App Lifecycle ---
async function initializeApp() {
    try {
        // Setup logging
        setupLogging();

        // Check if Docker is running early
        if (!await isDockerRunning()) {
            dialog.showErrorBox('Docker Required', 'Docker Desktop does not appear to be running. Please start Docker and restart the application.');
            app.quit();
            return;
        }
        
        // Find an available host port for n8n
        const port = await findAvailablePort();
        if (!port) {
            throw new Error('Could not find an available host port for n8n');
        }
        
        // Create the main window first
        await createWindow();
        
        // Start n8n container (kill existing is handled within startN8nProcess now)
        await startN8nProcess(port);
        
        // Set the active host port for IPC communication
        activePort = port;
        
        // Setup IPC handlers after window is created
        setupIpcHandlers();
        
        log.info('Application initialized successfully');
        // Notify renderer n8n is ready
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('n8n-init-info', { port: activePort, alreadyRunning: false });
        }

    } catch (error) {
        log.error(`Error initializing application: ${error.message}`);
        
        // Show an error dialog if initialization fails
        const detail = error.message || 'An unknown error occurred.';
        if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.webContents.send('n8n-init-error', { message: detail });
             dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Initialization Error',
                message: 'Failed to initialize the application.',
                detail: detail,
                buttons: ['Exit']
            }).then(() => app.quit());
        } else {
             dialog.showErrorBox('Initialization Error', `Failed to initialize the application:
${detail}`);
             app.quit();
        }
    }
}

// --- App Event Handlers ---
app.on('ready', async () => {
    try {
        await initializeApp();
    } catch (error) {
        log.error('Failed to start app:', error);
        dialog.showErrorBox('Startup Error', 'Failed to start the application. Please check the logs for details.');
        app.quit();
    }
});

app.on('window-all-closed', async () => {
    log.info('All windows closed, attempting to stop n8n container...');
    try {
        await stopN8nProcess(); // Stop the Docker container
        // Optional: Clean removal if needed, but --rm on run should handle it
        // await killExistingN8nProcesses(); 
    } catch (error) {
        log.error('Error stopping n8n container during shutdown:', error);
    } finally {
       if (process.platform !== 'darwin') {
           app.quit();
       }
    }
});

app.on('activate', async () => {
    if (mainWindow === null) {
        try {
            await createWindow();
        } catch (error) {
            log.error('Failed to recreate window:', error);
            dialog.showErrorBox('Window Error', 'Failed to recreate the application window.');
        }
    }
});

// --- IPC Handlers ---
ipcMain.handle('get-n8n-status', async () => {
    // Check if the container is running instead of checking the process handle
    // Or, more reliably, try to ping the n8n health endpoint
    try {
         if (!activePort) return { running: false, port: null };

         // Attempt to connect to the mapped host port
         const response = await fetch(`http://localhost:${activePort}/healthz`);
         // n8n healthcheck returns 200 if ok
         const isRunning = response.ok;
         if (!isRunning) {
             log.warn(`n8n health check failed with status: ${response.status}`);
         }
         return { running: isRunning, port: activePort };
    } catch (error) {
        // Network errors likely mean it's not running or reachable
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
             log.info(`Health check connection refused for port ${activePort}. Assuming n8n is not running.`);
        } else {
             log.error('Error checking n8n status via health check:', error);
        }
        return { running: false, port: activePort }; // Return port even if not running
    }
});

/**
 * Setup IPC handlers
 */
function setupIpcHandlers() {
  // Authentication handlers
  ipcMain.handle('auth-get-token', async (event, { nonce }) => {
    try {
      // Generate a new security token
      const token = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
      
      // Store the token in the keychain with expiration
      const expiration = Date.now() + TOKEN_TTL;
      const tokenData = JSON.stringify({ token, expiration, nonce });
      
      await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_PREFIX + token.substring(0, 8), tokenData);
      
      return token;
    } catch (error) {
      log.error('Error generating security token:', error);
      throw new Error('Failed to generate security token');
    }
  });
  
  // Verify security token
  async function verifySecurityToken({ token, nonce }) {
    if (!token) {
      throw new Error('Missing security token');
    }
    
    try {
      // Get the token data from the keychain
      const tokenData = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_PREFIX + token.substring(0, 8));
      
      if (!tokenData) {
        throw new Error('Invalid security token');
      }
      
      // Parse the token data
      const { token: storedToken, expiration, nonce: storedNonce } = JSON.parse(tokenData);
      
      // Check if the token is expired
      if (Date.now() > expiration) {
        // Remove the expired token
        await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_PREFIX + token.substring(0, 8));
        throw new Error('Security token expired');
      }
      
      // Check if the token matches
      if (token !== storedToken) {
        throw new Error('Invalid security token');
      }
      
      // Check if the nonce matches (prevents replay attacks)
      if (nonce && storedNonce && nonce === storedNonce) {
        throw new Error('Nonce already used (possible replay attack)');
      }
      
      // Update the nonce
      if (nonce) {
        const updatedData = JSON.stringify({ token, expiration, nonce });
        await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_PREFIX + token.substring(0, 8), updatedData);
      }
      
      return true;
    } catch (error) {
      log.error('Error verifying security token:', error);
      throw new Error('Failed to verify security token');
    }
  }
  
  // API Keys handlers
  ipcMain.on('save-api-keys', async (event, { token, nonce, data }) => {
    try {
      // Verify the security token
      await verifySecurityToken({ token, nonce });
      
      // Get the API keys
      const [keys] = data;
      
      // Validate the keys
      if (!keys || typeof keys !== 'object') {
        throw new Error('Invalid API keys');
      }
      
      // Encrypt the keys
      const encryptionKey = getEncryptionKey();
      if (!encryptionKey) {
        throw new Error('Encryption key not available');
      }
      
      const encryptedKeys = encryptApiKeys(keys, encryptionKey);
      
      // Store the encrypted keys in the keychain
      await keytar.setPassword(KEYCHAIN_SERVICE, API_KEYS_ACCOUNT, encryptedKeys);
      
      event.reply('save-api-keys-success');
    } catch (error) {
      log.error('Error saving API keys:', error);
      event.reply('save-api-keys-error', error.message);
    }
  });
  
  ipcMain.handle('verify-api-keys', async (event, { token, nonce, data }) => {
    try {
      // Verify the security token
      await verifySecurityToken({ token, nonce });
      
      // Get the API keys
      const [keys] = data;
      
      // Validate the keys
      if (!keys || typeof keys !== 'object') {
        throw new Error('Invalid API keys');
      }
      
      // TODO: Add API key validation logic here
      // This could involve making a test call to the service
      
      return { valid: true };
    } catch (error) {
      log.error('Error verifying API keys:', error);
      return { valid: false, error: error.message };
    }
  });
  
  // Workflow actions
  ipcMain.handle('workflow-action', async (event, { token, nonce, data }) => {
    try {
      // Verify the security token
      await verifySecurityToken({ token, nonce });
      
      // Get the action data
      const [actionData] = data;
      const { action, id } = actionData;
      
      if (!action || !id) {
        throw new Error('Invalid workflow action parameters');
      }
      
      // Handle different actions
      switch (action) {
        case 'run':
          // Run the workflow
          return await runWorkflow(id);
        case 'delete':
          // Delete the workflow
          return await deleteWorkflow(id);
        case 'export':
          // Export the workflow
          return await exportWorkflow(id);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      log.error(`Error executing workflow action: ${error.message}`);
      throw error;
    }
  });
  
  // Skip API Setup handler
  ipcMain.on('skip-api-setup', async (event) => {
    try {
      log.info('Skipping API setup as requested by user');
      
      // Notify the renderer that we're starting n8n
      mainWindow.webContents.send('n8n-status-update', { 
        stage: 'spawning', 
        port: activePort || 'pending' 
      });
      
      // If n8n is already running, stop it first
      if (n8nProcess) {
        log.info('n8n already running, stopping it first');
        await stopN8nProcess();
        n8nProcess = null;
      }
      
      // Find an available port if needed
      if (!activePort) {
        activePort = await findAvailablePort();
        if (!activePort) {
          throw new Error('Could not find an available port');
        }
      }
      
      // Start n8n
      n8nProcess = await startN8nProcess(activePort);
      
      // Notify the renderer that n8n is now running
      mainWindow.webContents.send('n8n-init-info', { 
        port: activePort, 
        alreadyRunning: false 
      });
      
      log.info(`n8n started successfully on port ${activePort}`);
    } catch (error) {
      log.error(`Error skipping API setup: ${error.message}`);
      mainWindow.webContents.send('n8n-init-error', { 
        message: error.message 
      });
    }
  });
}

/**
 * Encrypt API keys
 * @param {Object} keys - The API keys to encrypt
 * @param {string} encryptionKey - The encryption key
 * @returns {string} - The encrypted keys
 */
function encryptApiKeys(keys, encryptionKey) {
  try {
    // Convert the encryption key from hex to buffer
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    
    // Generate a random IV
    const iv = crypto.randomBytes(16);
    
    // Create a cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    
    // Encrypt the keys
    const keysString = JSON.stringify(keys);
    let encrypted = cipher.update(keysString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return the encrypted keys with the IV
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted
    });
  } catch (error) {
    log.error('Error encrypting API keys:', error);
    throw new Error('Failed to encrypt API keys');
  }
}

/**
 * Decrypt API keys
 * @param {string} encryptedData - The encrypted API keys
 * @param {string} encryptionKey - The encryption key
 * @returns {Object} - The decrypted keys
 */
function decryptApiKeys(encryptedData, encryptionKey) {
  try {
    // Parse the encrypted data
    const { iv, data } = JSON.parse(encryptedData);
    
    // Convert the encryption key and IV from hex to buffer
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    
    // Create a decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    
    // Decrypt the keys
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Return the decrypted keys
    return JSON.parse(decrypted);
  } catch (error) {
    log.error('Error decrypting API keys:', error);
    throw new Error('Failed to decrypt API keys');
  }
}

/**
 * Get stored API keys
 * @returns {Object|null} - The stored API keys or null if not found
 */
async function getStoredApiKeys() {
  try {
    // Get the encrypted keys from the keychain
    const encryptedKeys = await keytar.getPassword(KEYCHAIN_SERVICE, API_KEYS_ACCOUNT);
    
    if (!encryptedKeys) {
      return null;
    }
    
    // Get the encryption key
    const encryptionKey = getEncryptionKey();
    
    if (!encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    // Decrypt the keys
    return decryptApiKeys(encryptedKeys, encryptionKey);
  } catch (error) {
    log.error('Error getting stored API keys:', error);
    return null;
  }
}

/**
 * Find an available port in the specified range
 * @returns {Promise<number|null>} The available port or null if none found
 */
async function findAvailablePort() {
    for (let port = PORT_RANGE.start; port <= PORT_RANGE.end; port++) {
        try {
            // Try to create a server on this port
            const server = net.createServer();
            await new Promise((resolve, reject) => {
                server.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
                server.once('listening', () => {
                    server.close();
                    resolve();
                });
                server.listen(port, '127.0.0.1');
            });
            log.info(`Found available port: ${port}`);
            return port;
        } catch (err) {
            if (err.code === 'EADDRINUSE') {
                log.debug(`Port ${port} is in use, trying next port`);
                continue;
            }
            log.error(`Error checking port ${port}:`, err);
            return null;
        }
    }
    log.error('No available ports found in range');
    return null;
}

async function setupN8nDependencies() {
    return new Promise((resolve, reject) => {
        const setupScript = spawn('node', [
            path.join(scriptsDir, 'manage-n8n-deps.js'),
            'setup'
        ], { stdio: 'inherit' });

        setupScript.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Setup script exited with code ${code}`));
            }
        });
    });
}

async function startN8nProcess() {
    return new Promise((resolve, reject) => {
        // Notify UI that we're starting n8n
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('n8n-status-update', { 
                stage: 'starting', 
                message: 'Starting n8n process...'
            });
        }

        log.info('Starting n8n process...');
        
        // Add a longer timeout for the startup process
        const EXTENDED_TIMEOUT = 60000; // 60 seconds timeout
        let startupTimeout = null;
        
        const startScript = spawn('node', [
            path.join(scriptsDir, 'manage-n8n-process.js'),
            'start'
        ], { 
            stdio: 'pipe', // Capture output to log
            env: {
                ...process.env,
                N8N_ELECTRON_WRAPPER: 'true',
                RESOURCES_PATH: process.resourcesPath || ''
            }
        });

        // Capture stdout for logging
        startScript.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                log.info(`n8n startup: ${output}`);
                
                // Update UI with progress information
                if (mainWindow && !mainWindow.isDestroyed() && output.includes('Health check')) {
                    mainWindow.webContents.send('n8n-status-update', { 
                        stage: 'verifying', 
                        message: output
                    });
                }
                
                // Check for health success message
                if (output.includes('n8n is running and healthy')) {
                    clearTimeout(startupTimeout);
                    log.info('n8n is reported healthy, initialization complete');
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('n8n-status-update', { 
                            stage: 'ready', 
                            message: 'n8n is running and ready'
                        });
                    }
                    resolve();
                }
            }
        });
        
        // Capture stderr for error logging
        startScript.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                log.error(`n8n startup error: ${output}`);
                
                // Update UI with error information
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('n8n-status-update', { 
                        stage: 'error', 
                        message: `Error: ${output}`
                    });
                }
            }
        });

        startScript.on('close', (code) => {
            clearTimeout(startupTimeout);
            
            if (code === 0) {
                log.info('n8n startup process completed successfully');
                resolve();
            } else {
                const errorMsg = `Start script exited with code ${code}`;
                log.error(errorMsg);
                
                // Notify UI of failure
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('n8n-status-update', { 
                        stage: 'failed', 
                        message: errorMsg
                    });
                }
                
                reject(new Error(errorMsg));
            }
        });
        
        // Set timeout for the whole startup process
        startupTimeout = setTimeout(() => {
            log.warn(`n8n startup is taking longer than ${EXTENDED_TIMEOUT/1000} seconds, but continuing to wait...`);
            // We won't reject here, just log a warning and let the process continue
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('n8n-status-update', { 
                    stage: 'waiting', 
                    message: `n8n startup is taking longer than expected, please wait...`
                });
            }
            // Don't kill the process, just let it continue
        }, EXTENDED_TIMEOUT);
    });
}

async function stopN8nProcess() {
    return new Promise((resolve, reject) => {
        const stopScript = spawn('node', [
            path.join(scriptsDir, 'manage-n8n-process.js'),
            'stop'
        ], { stdio: 'inherit' });

        stopScript.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Stop script exited with code ${code}`));
            }
        });
    });
}