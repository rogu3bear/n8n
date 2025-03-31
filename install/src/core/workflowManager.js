/**
 * Workflow Manager for handling custom workflow execution
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const log = require('electron-log');
const { excelService } = require('../services/excelService');

class WorkflowManager {
  constructor() {
    log.info('WorkflowManager initialized');
    this.tempDir = os.tmpdir();
  }

  /**
   * Execute a custom workflow from JSON string
   * @param {string} workflowJson - JSON string representing the workflow
   * @returns {Promise<object>} Result of the workflow execution
   */
  async executeCustomWorkflow(workflowJson) {
    try {
      log.info('Executing custom workflow');
      
      // Parse and validate the workflow
      const workflow = this.validateWorkflowJson(workflowJson);
      
      // Save workflow to temporary file
      const workflowPath = path.join(this.tempDir, `workflow-${Date.now()}.json`);
      fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
      log.info(`Custom workflow saved to ${workflowPath}`);

      // For demonstration, we'll create an Excel file with workflow data
      await excelService.createWorkbook();
      const sheet = excelService.addWorksheet('Workflow Details');
      
      // Add headers
      sheet.addRow(['Property', 'Value']);
      
      // Add basic workflow data
      sheet.addRow(['Name', workflow.name || 'Unnamed Workflow']);
      sheet.addRow(['Nodes Count', workflow.nodes ? workflow.nodes.length : 0]);
      sheet.addRow(['Execution Time', new Date().toISOString()]);
      
      // Add node details if available
      if (workflow.nodes && workflow.nodes.length > 0) {
        const nodesSheet = excelService.addWorksheet('Nodes');
        nodesSheet.addRow(['ID', 'Type', 'Name', 'Parameters']);
        
        workflow.nodes.forEach(node => {
          nodesSheet.addRow([
            node.id || 'no-id',
            node.type || 'unknown',
            node.name || 'Unnamed',
            JSON.stringify(node.parameters || {})
          ]);
        });
      }
      
      // Save Excel file
      const excelPath = path.join(this.tempDir, `workflow-results-${Date.now()}.xlsx`);
      await excelService.saveWorkbook(excelPath);
      log.info(`Workflow results saved to Excel: ${excelPath}`);

      // Mock execution (replace with actual execution logic)
      return new Promise((resolve) => {
        setTimeout(() => {
          log.info('Custom workflow execution completed');
          
          // Clean up temporary files
          try {
            fs.unlinkSync(workflowPath);
            log.info('Cleaned up workflow JSON file');
          } catch (err) {
            log.error('Error cleaning up workflow file:', err);
          }
          
          resolve({
            success: true,
            output: 'Workflow executed successfully',
            resultPath: excelPath
          });
        }, 1000);
      });
    } catch (error) {
      log.error('Custom workflow execution failed:', error);
      throw error;
    }
  }

  /**
   * Validate workflow JSON
   * @param {string} json - JSON string to validate
   * @returns {object} Parsed and validated workflow object
   */
  validateWorkflowJson(json) {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid workflow: must be a valid JSON object');
      }
      
      // Ensure required fields
      if (!parsed.name) {
        log.warn('Workflow missing name property');
        parsed.name = `Unnamed Workflow (${new Date().toISOString()})`;
      }
      
      if (!Array.isArray(parsed.nodes)) {
        log.warn('Workflow missing nodes array');
        parsed.nodes = [];
      }
      
      if (!parsed.connections) {
        log.warn('Workflow missing connections object');
        parsed.connections = {};
      }
      
      return parsed;
    } catch (error) {
      log.error('Workflow validation failed:', error);
      throw new Error(`Invalid workflow JSON: ${error.message}`);
    }
  }
}

const workflowManager = new WorkflowManager();
module.exports = { workflowManager }; 