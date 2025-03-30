const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const debug = require('debug')('n8n:test');

// Test configuration
const TEST_CONFIG = {
    port: 5678,
    timeout: 30000, // 30 seconds
    healthCheckInterval: 1000, // 1 second
    maxHealthCheckAttempts: 30, // 30 attempts = 30 seconds
    debug: process.env.DEBUG === 'n8n:*',
    logDir: path.join(process.env.HOME || process.env.USERPROFILE, '.n8n', 'logs', 'test')
};

// Ensure log directory exists
if (!fs.existsSync(TEST_CONFIG.logDir)) {
    fs.mkdirSync(TEST_CONFIG.logDir, { recursive: true });
}

// Configure logging
log.transports.file.resolvePath = () => path.join(TEST_CONFIG.logDir, 'test.log');
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
log.transports.file.maxFiles = 5;

/**
 * Debug log with context
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function debugLog(message, context = {}) {
    if (TEST_CONFIG.debug) {
        debug(message, context);
    }
    log.info(message, context);
}

/**
 * Test if a port is available
 * @returns {Promise<boolean>}
 */
async function testPortAvailability() {
    debugLog('Testing port availability...');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (error) => {
            debugLog('Port test failed:', { error: error.message });
            resolve(false);
        });
        server.once('listening', () => {
            debugLog('Port test successful');
            server.close();
            resolve(true);
        });
        server.listen(TEST_CONFIG.port, '127.0.0.1');
    });
}

/**
 * Test n8n health endpoint
 * @returns {Promise<boolean>}
 */
async function testN8nHealth() {
    debugLog('Testing n8n health endpoint...');
    try {
        const response = await fetch(`http://localhost:${TEST_CONFIG.port}/healthz`);
        const isHealthy = response.ok;
        debugLog('Health check result:', { 
            status: response.status,
            ok: isHealthy,
            timestamp: new Date().toISOString()
        });
        return isHealthy;
    } catch (error) {
        debugLog('Health check failed:', { error: error.message });
        return false;
    }
}

/**
 * Test n8n process execution
 * @returns {Promise<boolean>}
 */
async function testN8nProcess() {
    debugLog('Starting n8n process test...');
    return new Promise((resolve, reject) => {
        let healthCheckAttempts = 0;
        let healthCheckInterval;
        let processStartTime = Date.now();

        // Start n8n process
        const n8nProcess = spawn('n8n', ['start'], {
            env: {
                ...process.env,
                N8N_PORT: TEST_CONFIG.port.toString(),
                N8N_PROTOCOL: 'http',
                N8N_HOST: 'localhost',
                N8N_LOG_LEVEL: 'debug',
                DEBUG: TEST_CONFIG.debug ? 'n8n:*' : undefined
            }
        });

        // Monitor process output
        n8nProcess.stdout.on('data', (data) => {
            const output = data.toString();
            debugLog(`n8n stdout: ${output.trim()}`);
            
            // Check for successful startup
            if (output.includes('Editor is now accessible via')) {
                const startupTime = Date.now() - processStartTime;
                debugLog('n8n started successfully', { startupTime });
                clearInterval(healthCheckInterval);
                n8nProcess.kill();
                resolve(true);
            }
        });

        n8nProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            debugLog(`n8n stderr: ${output}`, { timestamp: new Date().toISOString() });
        });

        // Start health check interval
        healthCheckInterval = setInterval(async () => {
            healthCheckAttempts++;
            debugLog('Health check attempt', { attempt: healthCheckAttempts });
            
            if (healthCheckAttempts >= TEST_CONFIG.maxHealthCheckAttempts) {
                debugLog('Health check timeout reached');
                clearInterval(healthCheckInterval);
                n8nProcess.kill();
                reject(new Error('Health check timeout'));
                return;
            }

            const isHealthy = await testN8nHealth();
            if (isHealthy) {
                debugLog('Health check passed');
                clearInterval(healthCheckInterval);
                n8nProcess.kill();
                resolve(true);
            }
        }, TEST_CONFIG.healthCheckInterval);

        // Handle process errors
        n8nProcess.on('error', (error) => {
            debugLog('Process error:', { error: error.message });
            clearInterval(healthCheckInterval);
            reject(error);
        });

        // Handle process exit
        n8nProcess.on('close', (code) => {
            debugLog('Process closed', { code });
            clearInterval(healthCheckInterval);
            if (code !== 0) {
                reject(new Error(`Process exited with code ${code}`));
            }
        });

        // Set overall timeout
        setTimeout(() => {
            debugLog('Process test timeout reached');
            clearInterval(healthCheckInterval);
            n8nProcess.kill();
            reject(new Error('Process test timeout'));
        }, TEST_CONFIG.timeout);
    });
}

/**
 * Test workflow execution
 * @returns {Promise<boolean>}
 */
async function testWorkflowExecution() {
    debugLog('Starting workflow execution test...');
    try {
        // Create a test workflow
        const testWorkflow = {
            name: 'Test Workflow',
            nodes: [
                {
                    type: 'n8n-nodes-base.start',
                    position: [250, 300],
                    parameters: {}
                },
                {
                    type: 'n8n-nodes-base.function',
                    position: [450, 300],
                    parameters: {
                        functionCode: `
                            return {
                                json: {
                                    test: 'success',
                                    timestamp: new Date().toISOString()
                                }
                            };
                        `
                    }
                }
            ],
            connections: {
                'Start': {
                    main: [[{ node: 'Function', index: 0 }]]
                }
            }
        };

        // Save test workflow
        const workflowsDir = path.join(process.env.HOME || process.env.USERPROFILE, '.n8n', 'workflows');
        if (!fs.existsSync(workflowsDir)) {
            fs.mkdirSync(workflowsDir, { recursive: true });
        }

        const workflowPath = path.join(workflowsDir, 'test-workflow.json');
        fs.writeFileSync(workflowPath, JSON.stringify(testWorkflow, null, 2));
        debugLog('Test workflow saved', { path: workflowPath });

        // Execute test workflow
        const response = await fetch(`http://localhost:${TEST_CONFIG.port}/rest/workflows/test-workflow/activate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to activate workflow: ${response.statusText}`);
        }

        debugLog('Workflow activation successful');
        return true;
    } catch (error) {
        debugLog('Workflow test failed:', { error: error.message });
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    const startTime = Date.now();
    debugLog('Starting n8n process tests...');

    try {
        // Test port availability
        const isPortAvailable = await testPortAvailability();
        if (!isPortAvailable) {
            throw new Error(`Port ${TEST_CONFIG.port} is not available`);
        }
        debugLog('Port availability test passed');

        // Test n8n process
        await testN8nProcess();
        debugLog('n8n process test passed');

        // Test workflow execution
        const workflowTestResult = await testWorkflowExecution();
        if (!workflowTestResult) {
            throw new Error('Workflow execution test failed');
        }
        debugLog('Workflow execution test passed');

        const duration = Date.now() - startTime;
        debugLog('All tests completed successfully', { duration });
        process.exit(0);
    } catch (error) {
        debugLog('Test failed:', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = {
    testPortAvailability,
    testN8nHealth,
    testN8nProcess,
    testWorkflowExecution,
    runTests
}; 