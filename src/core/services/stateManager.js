const { logger } = require('../utils/logger');
const { EventEmitter } = require('events');
const { readFile, writeFile, mkdir, readdir, unlink } = require('fs/promises');
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
  constructor(baseDir) {
    super();
    this.baseDir = baseDir;
    this.stateFilePath = path.join(baseDir, 'state.json');
    this.state = {
      workflows: {},
      nodes: {},
      connections: {},
      settings: {}
    };
    this.maxBackups = 3;
    this.observers = new Map();
  }

  async initialize() {
    try {
      await mkdir(path.dirname(this.stateFilePath), { recursive: true });
      await this.loadState();
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async getState() {
    return this.state;
  }

  async setState(newState) {
    await this.createBackup();
    this.state = newState;
    await this.saveState();
  }

  async saveState() {
    try {
      await writeFile(this.stateFilePath, JSON.stringify(this.state, null, 2));
      logger.debug('State saved successfully');
    } catch (error) {
      logger.error('Error saving state:', error);
      throw error;
    }
  }

  async createBackup() {
    try {
      const backupPath = `${this.stateFilePath}.backup.${Date.now()}`;
      let currentState;
      try {
        // Try to read the current state file
        currentState = await readFile(this.stateFilePath, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          // If file doesn't exist, use current state
          currentState = JSON.stringify(this.state, null, 2);
        } else {
          throw error;
        }
      }
      // Write the backup
      await writeFile(backupPath, currentState);
      await this.rotateBackups();
      logger.debug('Backup created successfully');
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  async rotateBackups() {
    try {
      const dir = path.dirname(this.stateFilePath);
      const files = await readdir(dir);
      const backups = files
        .filter(f => f.startsWith(path.basename(this.stateFilePath) + '.backup.'))
        .sort((a, b) => b.localeCompare(a)); // Sort newest to oldest

      // Keep only the most recent maxBackups
      const filesToDelete = backups.slice(this.maxBackups);
      for (const file of filesToDelete) {
        await unlink(path.join(dir, file));
      }
    } catch (error) {
      logger.error('Failed to rotate backups:', error);
    }
  }

  async restoreFromBackup() {
    try {
      const dir = path.dirname(this.stateFilePath);
      const files = await readdir(dir);
      const backups = files
        .filter(f => f.startsWith(path.basename(this.stateFilePath) + '.backup.'))
        .sort((a, b) => b.localeCompare(a)); // Sort newest to oldest

      if (backups.length > 0) {
        const latestBackup = backups[0];
        const backupData = await readFile(path.join(dir, latestBackup), 'utf8');
        this.state = JSON.parse(backupData);
        // Save the restored state back to the main state file
        await this.saveState();
        logger.info('State restored from backup successfully');
      } else {
        logger.warn('No backup found, initializing empty state');
        this.state = {
          workflows: {},
          nodes: {},
          connections: {},
          settings: {}
        };
      }
    } catch (error) {
      logger.error('Failed to restore from backup:', error);
      this.state = {
        workflows: {},
        nodes: {},
        connections: {},
        settings: {}
      };
    }
    return this.state;
  }

  async loadState() {
    try {
      const data = await readFile(this.stateFilePath, 'utf8');
      this.state = JSON.parse(data);
      logger.info('State loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        logger.warn('State file missing or corrupted, attempting restore from backup');
        await this.restoreFromBackup();
      } else {
        logger.error('Failed to load state:', error);
        throw error;
      }
    }
    return this.state;
  }

  async createWorkflow(workflow) {
    if (!workflow.id) {
      throw new Error('Workflow must have an id');
    }

    if (!this.state.workflows) {
      this.state.workflows = {};
    }

    this.state.workflows[workflow.id] = workflow;
    await this.saveState();
  }

  async deleteWorkflow(workflowId) {
    if (this.state.workflows && this.state.workflows[workflowId]) {
      delete this.state.workflows[workflowId];
      await this.saveState();
    }
  }

  async addNode(workflowId, node) {
    if (!this.state.workflows || !this.state.workflows[workflowId]) {
      throw new Error('Workflow not found');
    }

    if (!this.state.workflows[workflowId].nodes) {
      this.state.workflows[workflowId].nodes = [];
    }

    this.state.workflows[workflowId].nodes.push(node);
    await this.saveState();
  }

  async updateConnections(workflowId, connections) {
    if (!this.state.workflows || !this.state.workflows[workflowId]) {
      throw new Error('Workflow not found');
    }

    const workflow = this.state.workflows[workflowId];
    
    // Validate connections
    for (const connection of connections) {
      const { sourceId, targetId } = connection;
      const nodes = workflow.nodes || [];
      const sourceExists = nodes.some(n => n.id === sourceId);
      const targetExists = nodes.some(n => n.id === targetId);

      if (!sourceExists || !targetExists) {
        throw new Error('Invalid connection: node not found');
      }
    }

    this.state.workflows[workflowId].connections = connections;
    await this.saveState();
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

  async notifyObservers(key) {
    const observers = this.observers.get(key) || [];
    for (const observer of observers) {
      try {
        await observer(this.state[key]);
      } catch (error) {
        logger.error(`Error notifying observer for ${key}:`, error);
      }
    }
  }
}

module.exports = StateManager; 