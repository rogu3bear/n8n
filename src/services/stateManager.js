const { logger } = require('./logger');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class StateManager extends EventEmitter {
  constructor() {
    super();
    this.state = new Map();
    this.observers = new Map();
    this.stateFilePath = path.join(os.homedir(), '.n8n', 'state.json');
    this.updateQueue = new Map();
    this.batchTimeout = 1000; // 1 second
    this.setupBatchProcessing();
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
    await Promise.all(observers.map(observer => observer(this.state.get(key))));
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
      const data = await fs.readFile(this.stateFilePath, 'utf8');
      const state = JSON.parse(data);
      
      // Clear existing state
      this.state.clear();
      
      // Load new state
      for (const [key, value] of Object.entries(state)) {
        this.state.set(key, value);
      }
      
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
      const state = Object.fromEntries(this.state);
      await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2));
      logger.debug('State saved successfully');
    } catch (error) {
      logger.error('Error saving state:', error);
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