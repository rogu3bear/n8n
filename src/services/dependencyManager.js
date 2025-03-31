const { logger } = require('./logger');
const { EventEmitter } = require('events');

class DependencyManager extends EventEmitter {
  constructor() {
    super();
    this.dependencies = new Map();
    this.loaded = false;
    this.healthChecks = new Map();
    this.checkInterval = 30000; // 30 seconds
    this.setupHealthChecks();
  }

  async loadDependency(name) {
    if (this.dependencies.has(name)) {
      return this.dependencies.get(name);
    }

    try {
      const dependency = await this.initializeDependency(name);
      this.dependencies.set(name, dependency);
      this.emit('dependency-loaded', { name, status: 'success' });
      return dependency;
    } catch (error) {
      this.emit('dependency-error', { name, error });
      throw error;
    }
  }

  async initializeDependency(name) {
    switch (name) {
      case 'docker':
        return await this.setupDocker();
      case 'npm':
        return await this.setupNpm();
      case 'python':
        return await this.setupPython();
      default:
        throw new Error(`Unknown dependency: ${name}`);
    }
  }

  setupHealthChecks() {
    setInterval(() => this.runHealthChecks(), this.checkInterval);
  }

  async runHealthChecks() {
    for (const [name, check] of this.healthChecks) {
      try {
        const status = await check();
        await this.updateHealthStatus(name, status);
      } catch (error) {
        await this.handleHealthCheckError(name, error);
      }
    }
  }

  async updateHealthStatus(name, status) {
    this.emit('health-status', { name, status });
  }

  async handleHealthCheckError(name, error) {
    logger.error(`Health check failed for ${name}:`, error);
    this.emit('health-error', { name, error });
  }

  async cleanup() {
    for (const [name, dependency] of this.dependencies) {
      try {
        await this.cleanupDependency(name, dependency);
      } catch (error) {
        logger.error(`Failed to cleanup ${name}:`, error);
      }
    }
  }

  async cleanupDependency(name, dependency) {
    if (dependency && typeof dependency.cleanup === 'function') {
      await dependency.cleanup();
    }
  }
}

module.exports = new DependencyManager(); 