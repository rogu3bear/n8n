// Preload script for secure IPC communication
const { contextBridge, ipcRenderer } = require('electron');
const crypto = require('crypto');

// Constants for security
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
const TOKEN_TTL = 30 * 60 * 1000; // 30 minutes
const NONCE_LENGTH = 16; // 16 bytes

// Valid IPC channels for security
const validChannels = {
    // Window management
    window: ['close-setup-modal', 'show-optional-setup-prompt'],
    // Setup
    setup: ['skip-api-setup', 'save-api-keys', 'save-api-keys-error', 'verify-api-keys'],
    // n8n status
    n8n: ['n8n-init-info', 'n8n-init-error', 'n8n-status-update', 'get-n8n-status', 'restart-n8n'],
    // Workflows
    workflows: ['get-workflows', 'workflows-list', 'toggle-workflow', 'workflow-action', 'import-workflow'],
    // Utility
    utility: ['open-data-folder', 'open-logs-folder', 'check-updates'],
    // Logs
    logs: ['append-to-n8n-log', 'get-logs', 'clear-logs'],
    // Initialization
    init: ['init-status-update', 'initialization-complete'],
    // Authentication
    auth: ['check-auth-status', 'auth-status-update', 'perform-auth', 'refresh-auth-token']
};

// Security token storage
let securityToken = null;
let tokenExpiration = 0;

// Validate channel name
function isValidChannel(channel) {
    return Object.values(validChannels).some(channels => channels.includes(channel));
}

// Generate a security nonce
function generateNonce() {
    return crypto.randomBytes(NONCE_LENGTH).toString('hex');
}

// Validate request size
function validateRequestSize(args) {
    const size = JSON.stringify(args).length;
    if (size > MAX_REQUEST_SIZE) {
        throw new Error(`Request size exceeds maximum allowed (${size} > ${MAX_REQUEST_SIZE} bytes)`);
    }
    return true;
}

// Get or refresh security token
async function getSecurityToken() {
    const now = Date.now();
    
    // If token is valid, return it
    if (securityToken && tokenExpiration > now) {
        return securityToken;
    }
    
    try {
        // Request a new token
        const nonce = generateNonce();
        const newToken = await ipcRenderer.invoke('auth-get-token', { nonce });
        
        // Set the new token and expiration
        securityToken = newToken;
        tokenExpiration = now + TOKEN_TTL;
        
        return newToken;
    } catch (error) {
        console.error('Failed to get security token:', error);
        securityToken = null;
        tokenExpiration = 0;
        throw error;
    }
}

// Safe IPC sender with security token
async function safeSend(channel, ...args) {
    if (!isValidChannel(channel)) {
        console.error(`Invalid IPC channel: ${channel}`);
        return;
    }
    
    try {
        validateRequestSize(args);
        
        // Add security token to channels that need authentication
        if (channel.startsWith('workflow-') || channel === 'save-api-keys') {
            const token = await getSecurityToken();
            const nonce = generateNonce();
            ipcRenderer.send(channel, { token, nonce, data: args });
        } else {
            ipcRenderer.send(channel, ...args);
        }
    } catch (error) {
        console.error(`Error sending IPC message on channel ${channel}:`, error);
    }
}

// Safe IPC invoker with security token
async function safeInvoke(channel, ...args) {
    if (!isValidChannel(channel)) {
        console.error(`Invalid IPC channel: ${channel}`);
        return;
    }
    
    try {
        validateRequestSize(args);
        
        // Add security token to channels that need authentication
        if (channel.startsWith('workflow-') || channel === 'verify-api-keys') {
            const token = await getSecurityToken();
            const nonce = generateNonce();
            return await ipcRenderer.invoke(channel, { token, nonce, data: args });
        } else {
            return await ipcRenderer.invoke(channel, ...args);
        }
    } catch (error) {
        console.error(`Error invoking IPC on channel ${channel}:`, error);
        throw error;
    }
}

// Safe IPC listener
function safeOn(channel, callback) {
    if (!isValidChannel(channel)) {
        console.error(`Invalid IPC channel: ${channel}`);
        return;
    }
    
    try {
        ipcRenderer.on(channel, (event, ...args) => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in IPC callback for channel ${channel}:`, error);
            }
        });
    } catch (error) {
        console.error(`Error setting up IPC listener for channel ${channel}:`, error);
    }
}

// Safe IPC listener removal
function safeRemoveAllListeners(channel) {
    if (!isValidChannel(channel)) {
        console.error(`Invalid IPC channel: ${channel}`);
        return;
    }
    
    try {
        ipcRenderer.removeAllListeners(channel);
    } catch (error) {
        console.error(`Error removing IPC listeners for channel ${channel}:`, error);
    }
}

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld(
    'api',
    {
        // Window management
        closeSetupModal: () => safeSend('close-setup-modal'),
        showOptionalSetupPrompt: (callback) => safeOn('show-optional-setup-prompt', callback),
        
        // Setup
        skipApiSetup: () => safeSend('skip-api-setup'),
        saveApiKeys: (keys) => safeSend('save-api-keys', keys),
        onSaveApiKeysError: (callback) => safeOn('save-api-keys-error', callback),
        verifyApiKeys: (keys) => safeInvoke('verify-api-keys', keys),
        
        // n8n status
        onN8nInitInfo: (callback) => safeOn('n8n-init-info', callback),
        onN8nInitError: (callback) => safeOn('n8n-init-error', callback),
        onN8nStatusUpdate: (callback) => safeOn('n8n-status-update', callback),
        getN8nStatus: () => safeInvoke('get-n8n-status'),
        restartN8n: () => safeInvoke('restart-n8n'),
        
        // Workflows
        getWorkflows: () => safeSend('get-workflows'),
        onWorkflowsReceived: (callback) => safeOn('workflows-list', callback),
        toggleWorkflowActive: (id, active) => safeInvoke('toggle-workflow', { id, active }),
        runWorkflow: (id) => safeInvoke('workflow-action', { action: 'run', id }),
        deleteWorkflow: (id) => safeInvoke('workflow-action', { action: 'delete', id }),
        exportWorkflow: (id) => safeInvoke('workflow-action', { action: 'export', id }),
        importWorkflow: () => safeInvoke('workflow-action', { action: 'import' }),
        
        // Utility functions
        openDataFolder: () => safeSend('open-data-folder'),
        openLogsFolder: () => safeSend('open-logs-folder'),
        checkForUpdates: () => safeInvoke('check-updates'),
        
        // Log management
        appendToN8nLog: (callback) => safeOn('append-to-n8n-log', callback),
        getLogs: () => safeInvoke('get-logs'),
        clearLogs: () => safeInvoke('clear-logs'),
        
        // Authentication
        checkAuthStatus: () => safeInvoke('check-auth-status'),
        onAuthStatusUpdate: (callback) => safeOn('auth-status-update', callback),
        performAuth: (credentials) => safeInvoke('perform-auth', credentials),
        refreshAuthToken: () => safeInvoke('refresh-auth-token'),
        
        // Cleanup
        removeAllListeners: (channel) => safeRemoveAllListeners(channel)
    }
);

// Expose initialization status updates
contextBridge.exposeInMainWorld(
    'electron',
    {
        onInitStatusUpdate: (callback) => safeOn('init-status-update', callback),
        onInitializationComplete: (callback) => safeOn('initialization-complete', callback)
    }
);

// Clean up listeners when the window is unloaded
window.addEventListener('unload', () => {
    Object.values(validChannels).flat().forEach(channel => {
        safeRemoveAllListeners(channel);
    });
    
    // Clear security token
    securityToken = null;
    tokenExpiration = 0;
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        skipApiSetup: () => ipcRenderer.send('skip-api-setup'),
        
        // Add protected listeners for n8n status events
        onN8nStatusUpdate: (callback) => {
            // Log when a status update is received
            ipcRenderer.on('n8n-status-update', (event, data) => {
                console.log('Received n8n status update:', data);
                // Dispatch a custom event to the window with the status data
                window.dispatchEvent(new CustomEvent('n8n-status-update', { detail: data }));
                if (callback) callback(data);
            });
        },
        
        onN8nInitInfo: (callback) => {
            ipcRenderer.on('n8n-init-info', (event, data) => {
                console.log('Received n8n init info:', data);
                window.dispatchEvent(new CustomEvent('n8n-init-info', { detail: data }));
                if (callback) callback(data);
            });
        },
        
        onN8nInitError: (callback) => {
            ipcRenderer.on('n8n-init-error', (event, data) => {
                console.log('Received n8n init error:', data);
                window.dispatchEvent(new CustomEvent('n8n-init-error', { detail: data }));
                if (callback) callback(data);
            });
        }
    }
);

// When preload.js is loaded, log it to console
console.log('Preload script loaded. Setting up IPC bridges for n8n.');

// Set up initialization listeners
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed, setting up event listeners');
    
    // Initialize electron bridge event listeners
    window.electron.onN8nStatusUpdate();
    window.electron.onN8nInitInfo();
    window.electron.onN8nInitError();
    
    // Log that we're ready for IPC communication
    console.log('IPC bridges established for n8n status updates.');
}); 