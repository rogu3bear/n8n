const { logger } = require('../utils/logger');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Safe version of os.homedir
function getHomeDir() {
  try {
    if (typeof os.homedir === 'function') {
      return os.homedir();
    } else {
      // Fallback for testing environments
      return process.env.HOME || process.env.USERPROFILE || '/tmp';
    }
  } catch (error) {
    logger.error('Failed to get home directory:', error);
    return '/tmp';
  }
}

class StateManager extends EventEmitter {
  constructor() {
    super();
    this.state = new Map();
    this.observers = new Map();
    this.stateFilePath = path.join(getHomeDir(), '.n8n', 'state.json');
    this.updateQueue = new Map();
    this.batchTimeout = 1000; // 1 second
    this.setupBatchProcessing();
  }

  setBaseDir(baseDir) {
    this.stateFilePath = path.join(baseDir, 'state.json');
  }

  async saveWorkflow(workflow) {
    try {
      const workflows = this.state.get('workflows') || new Map();
      workflows.set(workflow.id, workflow);
      this.state.set('workflows', workflows);
      await this.saveState();
      this.emit('workflow:saved', workflow);
    } catch (error) {
      logger.error('Error saving workflow:', error);
      throw error;
    }
  }

  async loadWorkflow(id) {
    try {
      const workflows = this.state.get('workflows') || new Map();
      return workflows.get(id);
    } catch (error) {
      logger.error('Error loading workflow:', error);
      throw error;
    }
  }

  async deleteWorkflow(id) {
    try {
      const workflows = this.state.get('workflows') || new Map();
      workflows.delete(id);
      this.state.set('workflows', workflows);
      await this.saveState();
      this.emit('workflow:deleted', id);
    } catch (error) {
      logger.error('Error deleting workflow:', error);
      throw error;
    }
  }

  async createWorkflow(workflow) {
    try {
      const workflows = this.state.get('workflows') || new Map();
      const id = Date.now().toString();
      const newWorkflow = { ...workflow, id };
      workflows.set(id, newWorkflow);
      this.state.set('workflows', workflows);
      await this.saveState();
      this.emit('workflow:created', newWorkflow);
      return newWorkflow;
    } catch (error) {
      logger.error('Error creating workflow:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      const tempFiles = await fs.readdir(path.dirname(this.stateFilePath));
      for (const file of tempFiles) {
        if (file.startsWith('temp.') && file.endsWith('.json')) {
          await fs.unlink(path.join(path.dirname(this.stateFilePath), file));
        }
      }
    } catch (error) {
      logger.error('Error cleaning up temporary files:', error);
      throw error;
    }
  }

  setupBatchProcessing() {
    setInterval(() => this.processBatchUpdates(), this.batchTimeout);
  }

  async updateState(key, value) {
    // Only update if value has changed
    if (this.state.get(key) === value) {
      return;
    }

    // Queue the update for batch processing
    this.updateQueue.set(key, value);
  }

  async processBatchUpdates() {
    if (this.updateQueue.size === 0) {
      return;
    }

    const updates = new Map(this.updateQueue);
    this.updateQueue.clear();

    for (const [key, value] of updates) {
      this.state.set(key, value);
      await this.notifyObservers(key);
    }

    // Save state to file after batch processing
    await this.saveState();
  }

  async notifyObservers(key) {
    const observers = this.observers.get(key) || [];
    for (const observer of observers) {
      try {
        await observer(this.state.get(key));
      } catch (error) {
        logger.error(`Error notifying observer for ${key}:`, error);
      }
    }
  }

  observe(key, callback) {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set());
    }
    this.observers.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.observers.get(key).delete(callback);
      if (this.observers.get(key).size === 0) {
        this.observers.delete(key);
      }
    };
  }

  getState(key) {
    return this.state.get(key);
  }

  async loadState() {
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.stateFilePath);
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (err) {
        // Ignore if directory already exists
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
      
      const data = await fs.readFile(this.stateFilePath, 'utf8');
      const loadedState = JSON.parse(data);
      this.state = new Map(Object.entries(loadedState));
      logger.info('State loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No existing state file found, starting fresh');
      } else {
        logger.error('Error loading state:', error);
      }
    }
  }

  async saveState() {
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.stateFilePath);
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (err) {
        // Ignore if directory already exists
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
      
      await fs.writeFile(this.stateFilePath, JSON.stringify(Object.fromEntries(this.state), null, 2));
      logger.debug('State saved successfully');
    } catch (error) {
      logger.error('Error saving state:', error);
      throw error;
    }
  }

  async resetState() {
    this.state.clear();
    await this.saveState();
    logger.info('State reset successfully');
  }

  getSnapshot() {
    return Object.fromEntries(this.state);
  }
}

module.exports = new StateManager(); 