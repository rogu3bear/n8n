const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const log = require('electron-log');

class FileSystemUtils {
  constructor() {
    this.baseTempDir = path.join(os.tmpdir(), 'n8n');
    this.ensureBaseTempDir();
  }

  async ensureBaseTempDir() {
    try {
      await fs.mkdir(this.baseTempDir, { recursive: true });
    } catch (error) {
      log.error('Failed to create base temp directory:', error);
      throw error;
    }
  }

  async ensureTempDir(dirName) {
    const dirPath = path.join(this.baseTempDir, dirName);
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return dirPath;
    } catch (error) {
      log.error(`Failed to create temp directory ${dirName}:`, error);
      throw error;
    }
  }

  async cleanupTempFiles(dirName, maxAge = 24 * 60 * 60 * 1000) {
    const dirPath = path.join(this.baseTempDir, dirName);
    try {
      const files = await fs.readdir(dirPath);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          log.info(`Cleaned up old file: ${filePath}`);
        }
      }
    } catch (error) {
      log.error(`Failed to cleanup temp files in ${dirName}:`, error);
      throw error;
    }
  }

  async cleanupExecutionFiles(executionId, dirName) {
    const dirPath = path.join(this.baseTempDir, dirName);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (file.startsWith(executionId)) {
          const filePath = path.join(dirPath, file);
          await fs.unlink(filePath);
          log.info(`Cleaned up execution file: ${filePath}`);
        }
      }
    } catch (error) {
      log.error(`Failed to cleanup execution files for ${executionId}:`, error);
      throw error;
    }
  }

  async saveJsonToFile(data, dirName, fileName) {
    const dirPath = path.join(this.baseTempDir, dirName);
    const filePath = path.join(dirPath, fileName);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return filePath;
    } catch (error) {
      log.error(`Failed to save JSON to file ${filePath}:`, error);
      throw error;
    }
  }

  async readJsonFromFile(dirName, fileName) {
    const dirPath = path.join(this.baseTempDir, dirName);
    const filePath = path.join(dirPath, fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      log.error(`Failed to read JSON from file ${filePath}:`, error);
      throw error;
    }
  }
}

module.exports = new FileSystemUtils(); 