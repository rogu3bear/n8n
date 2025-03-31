/**
 * Logger utility for consistent logging across the application
 */
class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
    }

    /**
     * Log an info message
     * @param {string} message - The message to log
     * @param {Object} [data] - Optional data to log
     */
    info(message, data) {
        if (this.shouldLog('info')) {
            console.log(`[INFO] ${message}`, data || '');
        }
    }

    /**
     * Log a warning message
     * @param {string} message - The message to log
     * @param {Object} [data] - Optional data to log
     */
    warn(message, data) {
        if (this.shouldLog('warn')) {
            console.warn(`[WARN] ${message}`, data || '');
        }
    }

    /**
     * Log an error message
     * @param {string} message - The message to log
     * @param {Error|Object} [error] - Optional error object or data to log
     */
    error(message, error) {
        if (this.shouldLog('error')) {
            console.error(`[ERROR] ${message}`, error || '');
        }
    }

    /**
     * Log a debug message
     * @param {string} message - The message to log
     * @param {Object} [data] - Optional data to log
     */
    debug(message, data) {
        if (this.shouldLog('debug')) {
            console.debug(`[DEBUG] ${message}`, data || '');
        }
    }

    /**
     * Check if the message should be logged based on log level
     * @param {string} level - The log level to check
     * @returns {boolean}
     * @private
     */
    shouldLog(level) {
        const levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };

        return levels[level] <= levels[this.logLevel];
    }
}

// Export a singleton instance
module.exports = {
    logger: new Logger()
}; 