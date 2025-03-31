const EventEmitter = require('events');
const { logger } = require('./logger');
const { errorHandler } = require('./errorHandler');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class EventHandler extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Increase max listeners if needed
    this.setupErrorHandling();
    this.stateFile = path.join(os.homedir(), '.n8n', 'state.json');
    this.state = {
      app: {
        lastStart: null,
        lastQuit: null,
        version: null,
        isRunning: false
      },
      docker: {
        containers: {},
        lastError: null
      },
      python: {
        envReady: false,
        lastError: null
      },
      npm: {
        lastInstall: null,
        lastError: null
      },
      windows: {},
      system: {
        lastError: null,
        lastWarning: null
      }
    };
    this.loadState();
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      this.state = { ...this.state, ...JSON.parse(data) };
      logger.info('Application state loaded successfully');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Error loading application state:', error);
      }
    }
  }

  async saveState() {
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
      await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
      logger.debug('Application state saved');
    } catch (error) {
      logger.error('Error saving application state:', error);
    }
  }

  setupErrorHandling() {
    this.on('error', async (error) => {
      try {
        await errorHandler.handleError(error);
      } catch (err) {
        logger.error('Error in event handler:', err);
      }
    });
  }

  // Application lifecycle events
  async emitAppStart() {
    this.state.app.lastStart = new Date().toISOString();
    this.state.app.version = process.env.npm_package_version;
    this.state.app.isRunning = true;
    await this.saveState();
    this.emit('app:start', {
      timestamp: this.state.app.lastStart,
      version: this.state.app.version
    });
  }

  async emitAppReady() {
    this.emit('app:ready', {
      timestamp: new Date().toISOString()
    });
  }

  async emitAppQuit() {
    this.state.app.lastQuit = new Date().toISOString();
    this.state.app.isRunning = false;
    await this.saveState();
    this.emit('app:quit', {
      timestamp: this.state.app.lastQuit
    });
  }

  // Docker container events
  async emitDockerStart(containerId) {
    this.state.docker.containers[containerId] = {
      startTime: new Date().toISOString(),
      status: 'running'
    };
    await this.saveState();
    this.emit('docker:start', {
      containerId,
      timestamp: this.state.docker.containers[containerId].startTime
    });
  }

  async emitDockerStop(containerId) {
    if (this.state.docker.containers[containerId]) {
      this.state.docker.containers[containerId].stopTime = new Date().toISOString();
      this.state.docker.containers[containerId].status = 'stopped';
      await this.saveState();
    }
    this.emit('docker:stop', {
      containerId,
      timestamp: new Date().toISOString()
    });
  }

  async emitDockerError(containerId, error) {
    this.state.docker.lastError = {
      containerId,
      message: error.message,
      timestamp: new Date().toISOString()
    };
    await this.saveState();
    this.emit('docker:error', {
      containerId,
      error,
      timestamp: this.state.docker.lastError.timestamp
    });
  }

  // Python environment events
  async emitPythonEnvReady() {
    this.state.python.envReady = true;
    await this.saveState();
    this.emit('python:ready', {
      timestamp: new Date().toISOString()
    });
  }

  async emitPythonEnvError(error) {
    this.state.python.lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
    await this.saveState();
    this.emit('python:error', {
      error,
      timestamp: this.state.python.lastError.timestamp
    });
  }

  // npm events
  async emitNpmInstallStart() {
    this.emit('npm:install:start', {
      timestamp: new Date().toISOString()
    });
  }

  async emitNpmInstallComplete() {
    this.state.npm.lastInstall = new Date().toISOString();
    await this.saveState();
    this.emit('npm:install:complete', {
      timestamp: this.state.npm.lastInstall
    });
  }

  async emitNpmInstallError(error) {
    this.state.npm.lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
    await this.saveState();
    this.emit('npm:install:error', {
      error,
      timestamp: this.state.npm.lastError.timestamp
    });
  }

  // Window events
  emitWindowReady(windowId) {
    this.emit('window:ready', {
      windowId,
      timestamp: new Date().toISOString()
    });
  }

  emitWindowClose(windowId) {
    this.emit('window:close', {
      windowId,
      timestamp: new Date().toISOString()
    });
  }

  // IPC events
  emitIpcMessage(channel, data) {
    this.emit('ipc:message', {
      channel,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // System events
  async emitSystemError(error) {
    this.state.system.lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
    await this.saveState();
    this.emit('system:error', {
      error,
      timestamp: this.state.system.lastError.timestamp
    });
  }

  async emitSystemWarning(message) {
    this.state.system.lastWarning = {
      message,
      timestamp: new Date().toISOString()
    };
    await this.saveState();
    this.emit('system:warning', {
      message,
      timestamp: this.state.system.lastWarning.timestamp
    });
  }

  // Add method to get current state
  getState() {
    return { ...this.state };
  }
}

// Create singleton instance
const eventHandler = new EventHandler();

module.exports = { eventHandler }; 