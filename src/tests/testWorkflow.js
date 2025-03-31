const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const log = require('electron-log');
const os = require('os');
const { excelService } = require('../services/excelService');

module.exports = {
  async execute() {
    try {
      log.info('Starting test workflow');
      
      // Create test Excel file
      const testData = {
        name: 'Test Workflow',
        timestamp: new Date().toISOString(),
        status: 'running'
      };

      // Create Excel workbook
      await excelService.createWorkbook();
      const sheet = excelService.addWorksheet('Test Results');
      
      // Add headers
      sheet.addRow(['Field', 'Value']);
      
      // Add data
      Object.entries(testData).forEach(([key, value]) => {
        sheet.addRow([key, value]);
      });

      // Save Excel file
      const excelPath = path.join(os.tmpdir(), 'test-results.xlsx');
      await excelService.saveWorkbook(excelPath);
      log.info(`Excel file saved to ${excelPath}`);

      // Create workflow definition
      const workflow = {
        name: 'Test Workflow',
        nodes: [
          {
            parameters: {
              filePath: excelPath,
              operation: 'read'
            },
            name: 'Excel',
            type: 'n8n-nodes-base.excel',
            typeVersion: 1,
            position: [250, 300]
          }
        ],
        connections: {}
      };

      // Save workflow to temporary file
      const workflowPath = path.join(os.tmpdir(), 'test-workflow.json');
      fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
      log.info(`Workflow saved to ${workflowPath}`);

      // Execute workflow
      return new Promise((resolve, reject) => {
        exec(`npx n8n execute --file=${workflowPath}`, (error, stdout, stderr) => {
          try {
            // Cleanup temporary files
            fs.unlinkSync(workflowPath);
            fs.unlinkSync(excelPath);
            
            if (error) {
              log.error('Workflow execution error:', error);
              log.error('Stderr:', stderr);
              reject(error);
              return;
            }
            
            log.info('Workflow execution successful');
            log.debug('Workflow output:', stdout);
            resolve({ success: true, output: stdout });
          } catch (cleanupError) {
            log.error('Error during cleanup:', cleanupError);
            reject(cleanupError);
          }
        });
      });
    } catch (error) {
      log.error('Test workflow failed:', error);
      throw error;
    }
  }
}; 