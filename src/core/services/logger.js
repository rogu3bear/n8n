const electronLog = require('electron-log');
const path = require('path');
const os = require('os');

class Logger {
  constructor() {
    this.logBuffer = [];
    this.flushInterval = 1000; // 1 second
    this.maxBufferSize = 100;
    this.setupLogger();
    this.setupBufferFlush();
  }

  setupLogger() {
    const logPath = path.join(os.homedir(), '.n8n', 'logs');
    electronLog.transports.file.resolvePathFn = () => path.join(logPath, 'app.log');
    
    // Configure file transport
    electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
    electronLog.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    electronLog.transports.file.maxFiles = 5;
    
    // Configure console transport
    electronLog.transports.console.format = '[{level}] {text}';
    
    // Set log levels
    electronLog.transports.file.level = 'debug';
    electronLog.transports.console.level = 'info';
  }

  setupBufferFlush() {
    setInterval(() => this.flushBuffer(), this.flushInterval);
  }

  async log(level, message, meta = {}) {
    const logEntry = {
      level,
      message,
      meta,
      timestamp: Date.now()
    };

    this.logBuffer.push(logEntry);
    
    // Flush immediately for errors or if buffer is full
    if (level === 'error' || this.logBuffer.length >= this.maxBufferSize) {
      await this.flushBuffer();
    }
  }

  async flushBuffer() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    for (const log of logs) {
      const { level, message, meta } = log;
      const formattedMessage = this.formatMessage(message, meta);
      
      switch (level) {
        case 'error':
          electronLog.error(formattedMessage);
          break;
        case 'warn':
          electronLog.warn(formattedMessage);
          break;
        case 'info':
          electronLog.info(formattedMessage);
          break;
        case 'debug':
          electronLog.debug(formattedMessage);
          break;
        default:
          electronLog.info(formattedMessage);
      }
    }
  }

  formatMessage(message, meta) {
    if (Object.keys(meta).length === 0) {
      return message;
    }
    return `${message} ${JSON.stringify(meta)}`;
  }

  error(message, meta = {}) {
    return this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    return this.log('debug', message, meta);
  }

  async rotateLogs() {
    try {
      await electronLog.transports.file.rotate();
      this.info('Logs rotated successfully');
    } catch (error) {
      this.error('Failed to rotate logs:', error);
    }
  }
}

module.exports = new Logger(); 