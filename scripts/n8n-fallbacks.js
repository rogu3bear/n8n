/**
 * Helper utilities for n8n-electron-wrapper
 * This file contains fallback mechanisms to start n8n when standard methods fail
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Collect all possible n8n executable paths to try
 * @returns {Array<{path: string, method: string, exec: string, args: Array<string>}>} Array of paths to try
 */
function getAllPossibleN8nPaths() {
    const isPackaged = process.resourcesPath ? true : false;
    const appPath = process.resourcesPath || process.cwd();
    const homedir = os.homedir();
    
    // Collect all possible paths
    const paths = [
        // Packaged app paths
        {
            path: path.join(appPath, 'app.asar.unpacked', 'node_modules', 'n8n', 'bin', 'n8n.js'),
            method: 'packaged-asar-unpacked',
            exec: 'node',
            args: []
        },
        {
            path: path.join(appPath, 'app.asar.unpacked', 'node_modules', '.bin', 'n8n'),
            method: 'packaged-asar-unpacked-bin',
            exec: null, // Direct execution
            args: []
        },
        {
            path: path.join(appPath, 'node_modules', 'n8n', 'bin', 'n8n.js'),
            method: 'packaged-resources',
            exec: 'node',
            args: []
        },
        
        // Development paths
        {
            path: path.join(process.cwd(), 'node_modules', '.bin', 'n8n'),
            method: 'dev-bin',
            exec: null, // Direct execution
            args: []
        },
        {
            path: path.join(process.cwd(), 'node_modules', 'n8n', 'bin', 'n8n.js'),
            method: 'dev-bin-js',
            exec: 'node',
            args: []
        },
        
        // Global installation paths
        {
            path: path.join('/usr/local/bin/n8n'),
            method: 'global-bin',
            exec: null, // Direct execution
            args: []
        },
        {
            path: path.join(homedir, '.npm-global', 'bin', 'n8n'),
            method: 'npm-global',
            exec: null, // Direct execution
            args: []
        },
        {
            path: 'n8n', // Let PATH resolve it
            method: 'path-resolution',
            exec: null, // Direct execution 
            args: []
        }
    ];
    
    return paths;
}

/**
 * Find the first valid n8n executable
 * @returns {Promise<{path: string, method: string, exec: string, args: Array<string>}|null>} First valid path or null
 */
async function findValidN8nExecutable() {
    const paths = getAllPossibleN8nPaths();
    
    for (const pathInfo of paths) {
        // Skip PATH resolution check for existence
        if (pathInfo.method === 'path-resolution') {
            console.log(`Trying PATH resolution for n8n executable...`);
            return pathInfo;
        }
        
        try {
            const exists = fs.existsSync(pathInfo.path);
            if (exists) {
                console.log(`Found valid n8n executable at: ${pathInfo.path} (method: ${pathInfo.method})`);
                return pathInfo;
            }
        } catch (err) {
            console.error(`Error checking path ${pathInfo.path}:`, err.message);
        }
    }
    
    console.error('Could not find any valid n8n executable path');
    return null;
}

/**
 * Start n8n using the provided executable info and arguments
 * @param {Object} execInfo Executable info
 * @param {Array<string>} args Command line arguments
 * @returns {Promise<Object>} Process info
 */
function startN8nWithExecutable(execInfo, args) {
    return new Promise((resolve, reject) => {
        const command = execInfo.exec || execInfo.path;
        const fullArgs = execInfo.exec ? [execInfo.path, ...args] : args;
        
        console.log(`Starting n8n with command: ${command} ${fullArgs.join(' ')}`);
        
        const n8nProcess = spawn(command, fullArgs, {
            stdio: 'inherit',
            env: {
                ...process.env,
                N8N_PATH: execInfo.path,
                N8N_EXECUTABLE_METHOD: execInfo.method
            }
        });
        
        n8nProcess.on('error', (err) => {
            console.error(`Failed to start n8n: ${err.message}`);
            reject(err);
        });
        
        // We want immediate resolution so the parent process can handle the lifecycle
        resolve({
            process: n8nProcess,
            command,
            args: fullArgs,
            method: execInfo.method
        });
    });
}

module.exports = {
    findValidN8nExecutable,
    startN8nWithExecutable,
    getAllPossibleN8nPaths
}; 