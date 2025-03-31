const { logger } = require('./logger');
const { EventEmitter } = require('events');

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ErrorHandler extends EventEmitter {
  constructor() {
    super();
    this.errorCache = new Map();
    this.recoveryStrategies = new Map();
    this.maxCacheSize = 1000;
    this.setupDefaultStrategies();
  }

  setupDefaultStrategies() {
    this.registerRecoveryStrategy('dependency', this.handleDependencyError.bind(this));
    this.registerRecoveryStrategy('network', this.handleNetworkError.bind(this));
    this.registerRecoveryStrategy('permission', this.handlePermissionError.bind(this));
  }

  registerRecoveryStrategy(type, strategy) {
    this.recoveryStrategies.set(type, strategy);
  }

  async handleError(error, context = {}) {
    const errorKey = this.getErrorKey(error);
    
    if (this.errorCache.has(errorKey)) {
      return this.errorCache.get(errorKey);
    }

    try {
      const result = await this.handleErrorWithStrategy(error, context);
      this.cacheError(errorKey, result);
      return result;
    } catch (handlingError) {
      logger.error('Error handling failed:', handlingError);
      throw handlingError;
    }
  }

  getErrorKey(error) {
    return `${error.name}:${error.message}:${error.code || 'unknown'}`;
  }

  cacheError(key, result) {
    if (this.errorCache.size >= this.maxCacheSize) {
      const firstKey = this.errorCache.keys().next().value;
      this.errorCache.delete(firstKey);
    }
    this.errorCache.set(key, result);
  }

  async handleErrorWithStrategy(error, context) {
    const strategy = this.recoveryStrategies.get(error.type);
    if (!strategy) {
      return this.handleUnknownError(error, context);
    }

    return await strategy(error, context);
  }

  async handleDependencyError(error, context) {
    logger.error('Dependency error:', error);
    this.emit('dependency-error', { error, context });
    
    // Attempt recovery
    try {
      const result = await this.attemptDependencyRecovery(error, context);
      return { success: true, result };
    } catch (recoveryError) {
      return { success: false, error: recoveryError };
    }
  }

  async handleNetworkError(error, context) {
    logger.error('Network error:', error);
    this.emit('network-error', { error, context });
    
    // Implement network retry logic
    return { success: false, error };
  }

  async handlePermissionError(error, context) {
    logger.error('Permission error:', error);
    this.emit('permission-error', { error, context });
    
    // Implement permission recovery logic
    return { success: false, error };
  }

  async handleUnknownError(error, context) {
    logger.error('Unknown error:', error);
    this.emit('unknown-error', { error, context });
    return { success: false, error };
  }

  async attemptDependencyRecovery(error, context) {
    const { dependency } = context;
    if (!dependency) {
      throw new Error('No dependency specified for recovery');
    }

    // Implement dependency-specific recovery logic
    return { recovered: true, dependency };
  }

  clearCache() {
    this.errorCache.clear();
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  await errorHandler.handleError(error);
  if (!errorHandler.isTrustedError(error)) {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  await errorHandler.handleError(reason);
  if (!errorHandler.isTrustedError(reason)) {
    process.exit(1);
  }
});

module.exports = {
  AppError,
  errorHandler
}; 