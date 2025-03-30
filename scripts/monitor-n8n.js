const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

// Monitoring configuration
const MONITOR_CONFIG = {
    port: 5678,
    checkInterval: 5000, // 5 seconds
    logFile: path.join(process.env.HOME || process.env.USERPROFILE, '.n8n', 'logs', 'monitor.log'),
    maxLogSize: 10 * 1024 * 1024, // 10MB
    maxLogFiles: 5
};

// Ensure log directory exists
const logDir = path.dirname(MONITOR_CONFIG.logFile);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Configure logging
log.transports.file.resolvePath = () => MONITOR_CONFIG.logFile;
log.transports.file.maxSize = MONITOR_CONFIG.maxLogSize;
log.transports.file.maxFiles = MONITOR_CONFIG.maxLogFiles;

/**
 * Check if n8n is running
 * @returns {Promise<boolean>}
 */
async function isN8nRunning() {
    try {
        const response = await fetch(`http://localhost:${MONITOR_CONFIG.port}/healthz`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Get n8n process status
 * @returns {Promise<Object>}
 */
async function getN8nStatus() {
    try {
        const response = await fetch(`http://localhost:${MONITOR_CONFIG.port}/rest/workflows`);
        const workflows = await response.json();
        
        return {
            running: true,
            workflows: workflows.length,
            activeWorkflows: workflows.filter(w => w.active).length,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            running: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Monitor n8n process
 */
async function monitorN8n() {
    let lastStatus = null;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    log.info('Starting n8n monitoring...');

    const monitorInterval = setInterval(async () => {
        try {
            const status = await getN8nStatus();
            
            // Log status changes
            if (!lastStatus || JSON.stringify(status) !== JSON.stringify(lastStatus)) {
                log.info('n8n status:', status);
                lastStatus = status;
            }

            // Check for consecutive failures
            if (!status.running) {
                consecutiveFailures++;
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    log.error(`n8n appears to be down after ${consecutiveFailures} consecutive failures`);
                    // Here you could implement recovery actions
                }
            } else {
                consecutiveFailures = 0;
            }

            // Monitor workflow execution
            if (status.running && status.workflows > 0) {
                const executionsResponse = await fetch(`http://localhost:${MONITOR_CONFIG.port}/rest/executions`);
                const executions = await executionsResponse.json();
                
                // Log failed executions
                const failedExecutions = executions.filter(e => e.status === 'failed');
                if (failedExecutions.length > 0) {
                    log.warn('Failed executions detected:', failedExecutions);
                }
            }

        } catch (error) {
            log.error('Monitoring error:', error);
            consecutiveFailures++;
            
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                log.error('Monitoring failed after multiple attempts');
                clearInterval(monitorInterval);
                process.exit(1);
            }
        }
    }, MONITOR_CONFIG.checkInterval);

    // Handle process termination
    process.on('SIGTERM', () => {
        log.info('Received SIGTERM, stopping monitoring...');
        clearInterval(monitorInterval);
        process.exit(0);
    });

    process.on('SIGINT', () => {
        log.info('Received SIGINT, stopping monitoring...');
        clearInterval(monitorInterval);
        process.exit(0);
    });
}

// Start monitoring if this file is executed directly
if (require.main === module) {
    monitorN8n();
}

module.exports = {
    isN8nRunning,
    getN8nStatus,
    monitorN8n
}; 