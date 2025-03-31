const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const log = require('electron-log');
const os = require('os');

module.exports = {
  execute: async () => {
    try {
      log.info('Starting test workflow execution...');
      
      // Create a simple workflow file
      const workflow = {
        name: "Test Workflow",
        nodes: [
          {
            parameters: { text: "Hello, World!" },
            name: "Set",
            type: "n8n-nodes-base.set",
            typeVersion: 1,
            position: [250, 300]
          },
          {
            parameters: { 
              operation: "write",
              fileName: "/tmp/test.txt",
              content: "= {{$json.text}}"
            },
            name: "Write File",
            type: "n8n-nodes-base.fileSystem",
            typeVersion: 1,
            position: [450, 300]
          }
        ],
        connections: {
          "Set": {
            main: [
              [
                {
                  node: "Write File",
                  index: 0,
                  type: "main"
                }
              ]
            ]
          }
        }
      };

      const workflowPath = path.join(os.tmpdir(), 'test-workflow.json');
      fs.writeFileSync(workflowPath, JSON.stringify(workflow));
      log.info(`Created test workflow at: ${workflowPath}`);

      // Execute the workflow using n8n CLI
      return new Promise((resolve, reject) => {
        exec(`npx n8n execute --file=${workflowPath}`, (error, stdout, stderr) => {
          if (error) {
            log.error(`Error executing workflow: ${stderr}`);
            return reject(error);
          }
          log.info(`Workflow output: ${stdout}`);
          
          // Verify the output file was created
          if (fs.existsSync('/tmp/test.txt')) {
            const content = fs.readFileSync('/tmp/test.txt', 'utf8');
            log.info(`Output file content: ${content}`);
            resolve(content);
          } else {
            reject(new Error('Output file was not created'));
          }
          
          // Clean up
          try {
            fs.unlinkSync(workflowPath);
            log.info('Cleaned up test workflow file');
          } catch (cleanupError) {
            log.warn(`Failed to clean up test workflow file: ${cleanupError.message}`);
          }
        });
      });
    } catch (error) {
      log.error(`Test workflow execution failed: ${error.message}`);
      throw error;
    }
  }
}; 