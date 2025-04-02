/**
 * Logger utility for consistent logging across the application
 */
const log = require('electron-log');
const path = require('path');
const os = require('os');
const fs = require('fs');

class Logger {
    constructor() {
        this.logDir = path.join(os.homedir(), '.n8n', 'logs');
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 5;
        
        this.initialize();
    }

    initialize() {
        // Ensure log directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Configure logging
        log.transports.file.resolvePath = () => path.join(this.logDir, 'main.log');
        log.transports.file.maxSize = this.maxLogSize;
        log.transports.file.maxFiles = this.maxLogFiles;

        // Configure console transport
        log.transports.console.format = '[{level}] {text}';
    }

    createLogger(category) {
        const categoryLogDir = path.join(this.logDir, category);
        if (!fs.existsSync(categoryLogDir)) {
            fs.mkdirSync(categoryLogDir, { recursive: true });
        }

        const logger = {
            info: (message, ...args) => {
                log.info(`[${category}] ${message}`, ...args);
            },
            error: (message, ...args) => {
                log.error(`[${category}] ${message}`, ...args);
            },
            warn: (message, ...args) => {
                log.warn(`[${category}] ${message}`, ...args);
            },
            debug: (message, ...args) => {
                log.debug(`[${category}] ${message}`, ...args);
            }
        };

        return logger;
    }

    logError(error, context = {}) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context,
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                memory: process.memoryUsage()
            }
        };

        log.error('Error occurred:', errorLog);
    }

    getLogPath(category) {
        return path.join(this.logDir, category);
    }
}

module.exports = new Logger(); 