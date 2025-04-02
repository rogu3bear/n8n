const errorHandler = require('./errorHandler');
const logger = require('../utils/logger');
const fileSystem = require('../utils/fileSystem');
const crypto = require('crypto');

const log = logger.createLogger('workflowExecutor');

class WorkflowExecutor {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.maxConcurrentExecutions = 5;
    this.activeExecutions = new Map();
    this.workflowCache = new Map();
    
    this.initialize();
  }

  async initialize() {
    try {
      // Ensure temp directory exists
      await fileSystem.ensureTempDir('workflows');
      
      // Clean up old temporary files
      await fileSystem.cleanupTempFiles('workflows');
      
      log.info('WorkflowExecutor initialized');
    } catch (error) {
      errorHandler.handleError(error, { context: 'WorkflowExecutor initialization' });
    }
  }

  async executeWorkflow(workflow, options = {}) {
    const executionId = crypto.randomBytes(16).toString('hex');
    const startTime = Date.now();

    try {
      // Validate workflow
      await this.validateWorkflow(workflow);

      // Check concurrent execution limit
      if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
        throw new Error('Maximum concurrent executions reached');
      }

      // Store execution context
      this.activeExecutions.set(executionId, {
        workflow,
        startTime,
        status: 'running',
        retryCount: 0
      });

      // Execute workflow with retries
      const result = await this.executeWithRetry(workflow, executionId);

      // Update execution status
      this.activeExecutions.get(executionId).status = 'completed';
      this.activeExecutions.get(executionId).endTime = Date.now();

      // Generate execution report
      await this.generateExecutionReport(executionId);

      return result;
    } catch (error) {
      // Update execution status
      if (this.activeExecutions.has(executionId)) {
        this.activeExecutions.get(executionId).status = 'failed';
        this.activeExecutions.get(executionId).error = error;
        this.activeExecutions.get(executionId).endTime = Date.now();
      }

      // Handle error
      await errorHandler.handleError(error, {
        context: 'Workflow execution',
        workflowId: workflow.id,
        executionId
      });

      throw error;
    } finally {
      // Cleanup after execution
      await this.cleanupExecution(executionId);
    }
  }

  async validateWorkflow(workflow) {
    // Basic structure validation
    if (!workflow || typeof workflow !== 'object') {
      throw new Error('Invalid workflow structure');
    }

    // Required fields validation
    const requiredFields = ['id', 'name', 'nodes', 'connections'];
    for (const field of requiredFields) {
      if (!workflow[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Node validation
    for (const node of workflow.nodes) {
      if (!node.id || !node.type) {
        throw new Error('Invalid node structure');
      }
    }

    // Connection validation
    for (const connection of workflow.connections) {
      if (!connection.from || !connection.to) {
        throw new Error('Invalid connection structure');
      }
    }

    // Size validation
    const workflowSize = JSON.stringify(workflow).length;
    if (workflowSize > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Workflow size exceeds limit');
    }

    // Node count validation
    if (workflow.nodes.length > 1000) {
      throw new Error('Workflow node count exceeds limit');
    }
  }

  async executeWithRetry(workflow, executionId) {
    const execution = this.activeExecutions.get(executionId);
    let lastError;

    while (execution.retryCount < this.maxRetries) {
      try {
        // Save workflow to temporary file
        const workflowPath = await fileSystem.saveJsonToFile(workflow, 'workflows', `${executionId}.json`);

        // Execute workflow
        const result = await this.executeWorkflowFile(workflowPath);

        // Cleanup temporary file
        await fileSystem.cleanupExecutionFiles(executionId, 'workflows');

        return result;
      } catch (error) {
        lastError = error;
        execution.retryCount++;

        if (execution.retryCount < this.maxRetries) {
          log.warn(`Retrying workflow execution (${execution.retryCount}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError || new Error('Workflow execution failed after retries');
  }

  async executeWorkflowFile(workflowPath) {
    // This is a placeholder for the actual workflow execution logic
    // In a real implementation, this would integrate with your workflow engine
    return new Promise((resolve, reject) => {
      // Simulate workflow execution
      setTimeout(() => {
        if (Math.random() < 0.1) { // 10% failure rate for testing
          reject(new Error('Simulated workflow execution failure'));
        } else {
          resolve({
            status: 'success',
            output: 'Workflow executed successfully'
          });
        }
      }, 1000);
    });
  }

  async generateExecutionReport(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const report = {
      executionId,
      workflowId: execution.workflow.id,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.endTime - execution.startTime,
      status: execution.status,
      retryCount: execution.retryCount,
      error: execution.error
    };

    await fileSystem.saveJsonToFile(report, 'workflows', `${executionId}-report.json`);
  }

  async cleanupExecution(executionId) {
    // Remove from active executions
    this.activeExecutions.delete(executionId);

    // Cleanup temporary files
    await fileSystem.cleanupExecutionFiles(executionId, 'workflows');
  }

  getExecutionStatus(executionId) {
    return this.activeExecutions.get(executionId);
  }

  getActiveExecutions() {
    return Array.from(this.activeExecutions.entries()).map(([id, execution]) => ({
      id,
      ...execution
    }));
  }
}

module.exports = new WorkflowExecutor(); 