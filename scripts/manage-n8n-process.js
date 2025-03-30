const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');
const http = require('http');

// Use the fallbacks helper if it exists
let n8nFallbacks;
try {
    n8nFallbacks = require('./n8n-fallbacks');
    console.log('n8n-fallbacks module loaded successfully');
} catch (err) {
    console.log('n8n-fallbacks module not available, using built-in fallbacks');
    n8nFallbacks = null;
}

// Configuration
const PORT_RANGE = { start: 5678, end: 5688 };
const MAX_START_ATTEMPTS = 3;
const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds for initial health check
const HEALTH_CHECK_INTERVAL = 2000; // Check every 2 seconds
const HEALTH_CHECK_RETRIES = 15; // 15 retries = 30 seconds total

// More robust detection of whether we're in a packaged app
let isPackaged = false;
let resourcesPath = '';

// Check if running in packaged Electron app
if (process.resourcesPath) {
    // We're in Electron with a resourcesPath
    isPackaged = true;
    resourcesPath = process.resourcesPath;
} else if (process.mainModule && process.mainModule.filename && process.mainModule.filename.includes('app.asar')) {
    // Alternative detection method
    isPackaged = true;
    // Try to derive resourcesPath
    const appAsarPath = process.mainModule.filename;
    resourcesPath = path.dirname(path.dirname(appAsarPath));
} else if (process.env.RESOURCES_PATH) {
    // Fallback to environment variable if provided
    isPackaged = true;
    resourcesPath = process.env.RESOURCES_PATH;
}

console.log(`Running in ${isPackaged ? 'packaged' : 'development'} mode`);
console.log(`Resources path: ${resourcesPath || 'not available'}`);

// Define base path and n8n executable path based on environment
let n8nExecutablePath;
let commandToSpawn;
let commandArgsPrefix = [];

// Try to find the n8n executable using either the fallbacks helper or our built-in logic
async function findN8nExecutable() {
    // If we have the fallbacks helper, use it
    if (n8nFallbacks) {
        const execInfo = await n8nFallbacks.findValidN8nExecutable();
        if (execInfo) {
            n8nExecutablePath = execInfo.path;
            commandToSpawn = execInfo.exec || execInfo.path;
            commandArgsPrefix = execInfo.exec ? [execInfo.path] : [];
            return true;
        }
    }

    // Otherwise use our built-in logic
    if (isPackaged && resourcesPath) {
        // Packaged app path - look in app.asar.unpacked/node_modules
        try {
            const basePath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'n8n');
            n8nExecutablePath = path.join(basePath, 'bin', 'n8n.js');
            
            if (fs.existsSync(n8nExecutablePath)) {
                console.log(`Found n8n at: ${n8nExecutablePath}`);
                commandToSpawn = 'node'; // Run the JS file with node
                commandArgsPrefix = [n8nExecutablePath];
                return true;
            } else {
                console.error(`n8n not found at expected packaged path: ${n8nExecutablePath}`);
                
                // Try alternate structure format that Electron might use
                const altPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', 'n8n');
                if (fs.existsSync(altPath)) {
                    console.log(`Found n8n at alternate path: ${altPath}`);
                    n8nExecutablePath = altPath;
                    commandToSpawn = n8nExecutablePath;
                    commandArgsPrefix = [];
                    return true;
                } else {
                    console.error(`n8n not found at alternate packaged path: ${altPath}`);
                    // Will fall back to development mode path below
                    isPackaged = false;
                }
            }
        } catch (error) {
            console.error('Error finding n8n in packaged app:', error);
            isPackaged = false; // Fall back to development mode
        }
    }

    if (!isPackaged) {
        // Development path (assuming relative to script location)
        try {
            const projectRoot = path.resolve(__dirname, '..');
            const binPath = path.join(projectRoot, 'node_modules', '.bin', 'n8n');
            
            if (fs.existsSync(binPath)) {
                n8nExecutablePath = binPath;
                commandToSpawn = n8nExecutablePath;
                console.log(`Found n8n at dev path: ${n8nExecutablePath}`);
                return true;
            } else {
                // Try alternate path for development mode
                const altDevPath = path.join(projectRoot, 'node_modules', 'n8n', 'bin', 'n8n.js');
                if (fs.existsSync(altDevPath)) {
                    n8nExecutablePath = altDevPath;
                    commandToSpawn = 'node';
                    commandArgsPrefix = [n8nExecutablePath];
                    console.log(`Found n8n at alternate dev path: ${n8nExecutablePath}`);
                    return true;
                } else {
                    console.error('n8n not found in expected development paths');
                    console.error(`Tried: ${binPath}`);
                    console.error(`Tried: ${altDevPath}`);
                    return false;
                }
            }
        } catch (error) {
            console.error('Error finding n8n in development mode:', error);
            return false;
        }
    }

    return false;
}

async function findAvailablePort() {
    for (let port = PORT_RANGE.start; port <= PORT_RANGE.end; port++) {
        try {
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
            return port;
        } catch (err) {
            if (err.code === 'EADDRINUSE') {
                continue;
            }
            throw err;
        }
    }
    throw new Error('No available ports found');
}

// Helper function to check if n8n is healthy
function checkN8nHealth(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
            if (res.statusCode === 200) {
                console.log(`n8n health check passed on port ${port}`);
                resolve(true);
            } else {
                console.log(`n8n health check failed with status ${res.statusCode}`);
                resolve(false);
            }
        });
        
        req.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                console.log(`n8n not yet accepting connections on port ${port}`);
            } else {
                console.error(`Health check error: ${err.message}`);
            }
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            console.log('Health check timed out');
            resolve(false);
        });
    });
}

async function waitForN8nHealthy(port, maxRetries = HEALTH_CHECK_RETRIES, interval = HEALTH_CHECK_INTERVAL) {
    console.log(`Waiting for n8n to be healthy on port ${port}...`);
    
    for (let i = 0; i < maxRetries; i++) {
        console.log(`Health check attempt ${i+1}/${maxRetries}`);
        const isHealthy = await checkN8nHealth(port);
        
        if (isHealthy) {
            console.log(`n8n is healthy after ${i+1} attempts!`);
            return true;
        }
        
        // If not the last attempt, wait before trying again
        if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    console.error(`n8n failed to become healthy after ${maxRetries} attempts`);
    return false;
}

async function startN8nProcess() {
    try {
        // First find the n8n executable
        const executableFound = await findN8nExecutable();
        
        if (!executableFound) {
            console.error('Failed to find n8n executable');
            process.exit(1);
        }
        
        // At this point we should have a valid n8nExecutablePath and commandToSpawn
        if (!n8nExecutablePath || !commandToSpawn) {
            console.error('Failed to determine n8n executable path');
            process.exit(1);
        }
        
        // Find an available port
        const port = await findAvailablePort();
        console.log(`Starting n8n on port ${port} using command: ${commandToSpawn}`);

        const args = [
            ...commandArgsPrefix, // Prepend node and script path if needed
            'start',
            '--port', port.toString(),
            '--host', '127.0.0.1',
            '--no-open'
        ];

        console.log(`Spawning: ${commandToSpawn} ${args.join(' ')}`);

        const n8nProcess = spawn(commandToSpawn, args, {
            stdio: 'inherit', // Pipe output to parent (main.js/terminal)
            env: {
                ...process.env,
                N8N_PORT: port.toString(),
                N8N_HOST: '127.0.0.1',
                N8N_PROTOCOL: 'http',
                // Set longer timeouts to avoid premature failure
                N8N_STARTUP_TIMEOUT: '60000', // 60 seconds
                // Force debug logging
                N8N_LOG_LEVEL: 'debug'
            }
        });

        // Set up error handling
        n8nProcess.on('error', (err) => {
            console.error('Failed to start n8n:', err);
            process.exit(1);
        });

        // Wait for n8n to become healthy
        const healthyResult = await waitForN8nHealthy(port);
        
        if (!healthyResult) {
            console.error('n8n process is running but failed health checks');
            // We'll continue anyway as the process might be slow to start
        } else {
            console.log('n8n is running and healthy!');
        }
        
        // Keep the process running while n8n runs
        n8nProcess.on('exit', (code) => {
            console.log(`n8n process exited with code ${code}`);
            process.exit(code);
        });

        return n8nProcess;
    } catch (err) {
        console.error('Error starting n8n:', err);
        process.exit(1);
    }
}

function stopN8nProcess(process) {
    if (process) {
        console.log('Stopping n8n process...');
        process.kill();
        console.log('n8n process stopped');
    } else {
        console.log('No n8n process to stop');
    }
}

// Handle command line arguments
const command = process.argv[2];
let n8nProcess = null;

switch (command) {
    case 'start':
        console.log('Starting n8n process...');
        startN8nProcess().then(process => {
            n8nProcess = process;
            console.log('n8n process started and running');
        }).catch(err => {
            console.error('Error in start sequence:', err);
            process.exit(1);
        });
        break;
    case 'stop':
        console.log('Stopping n8n process...');
        stopN8nProcess(n8nProcess);
        process.exit(0);
        break;
    default:
        console.error('Please specify either "start" or "stop"');
        process.exit(1);
} 