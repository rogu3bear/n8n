const { logger } = require('./logger');
const { EventEmitter } = require('events');

class CleanupManager extends EventEmitter {
  constructor() {
    super();
    this.cleanupTasks = new Map();
    this.isCleaningUp = false;
  }

  registerCleanupTask(name, task, priority = 0) {
    if (typeof task !== 'function') {
      throw new Error('Cleanup task must be a function');
    }

    this.cleanupTasks.set(name, {
      task,
      priority,
      registeredAt: Date.now()
    });

    logger.debug(`Registered cleanup task: ${name}`);
  }

  async cleanup() {
    if (this.isCleaningUp) {
      logger.warn('Cleanup already in progress');
      return;
    }

    this.isCleaningUp = true;
    this.emit('cleanup-started');

    try {
      // Sort tasks by priority (higher priority first)
      const sortedTasks = Array.from(this.cleanupTasks.entries())
        .sort(([, a], [, b]) => b.priority - a.priority);

      for (const [name, { task }] of sortedTasks) {
        try {
          await this.executeCleanupTask(name, task);
        } catch (error) {
          logger.error(`Failed to execute cleanup task ${name}:`, error);
          this.emit('cleanup-task-error', { name, error });
        }
      }

      this.emit('cleanup-completed');
    } catch (error) {
      this.emit('cleanup-error', error);
      throw error;
    } finally {
      this.isCleaningUp = false;
    }
  }

  async executeCleanupTask(name, task) {
    logger.debug(`Executing cleanup task: ${name}`);
    const startTime = Date.now();
    
    try {
      await task();
      const duration = Date.now() - startTime;
      logger.debug(`Cleanup task completed: ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Cleanup task failed: ${name} (${duration}ms)`, error);
      throw error;
    }
  }

  removeCleanupTask(name) {
    if (this.cleanupTasks.delete(name)) {
      logger.debug(`Removed cleanup task: ${name}`);
    }
  }

  getRegisteredTasks() {
    return Array.from(this.cleanupTasks.entries()).map(([name, { priority, registeredAt }]) => ({
      name,
      priority,
      registeredAt
    }));
  }

  async forceCleanup() {
    logger.warn('Forcing cleanup of all tasks');
    this.cleanupTasks.clear();
    await this.cleanup();
  }
}

module.exports = new CleanupManager(); 