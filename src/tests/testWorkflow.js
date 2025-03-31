const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  execute: async () => {
    try {
      // Create test directory if it doesn't exist
      const testDir = path.join(os.tmpdir(), 'n8n-test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Write test file
      const testFile = path.join(testDir, 'test.txt');
      fs.writeFileSync(testFile, 'Hello from n8n test workflow');
      
      // Verify file was written
      if (!fs.existsSync(testFile)) {
        throw new Error('Test file was not created');
      }

      const content = fs.readFileSync(testFile, 'utf8');
      if (content !== 'Hello from n8n test workflow') {
        throw new Error('Test file content mismatch');
      }

      console.log('Workflow test: PASSED');
      return true;
    } catch (error) {
      console.error('Workflow test: FAILED', error);
      throw error;
    } finally {
      // Cleanup
      const testDir = path.join(os.tmpdir(), 'n8n-test');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }
  }
}; 