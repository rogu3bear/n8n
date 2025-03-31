const fs = require('fs');
const path = require('path');
const os = require('os');
const { logger } = require('./logger');

class StateValidator {
  constructor() {
    this.n8nDir = path.join(os.homedir(), '.n8n');
    this.stateFiles = {
      window: 'window-state.json',
      app: 'app-state.json'
    };
  }

  async validateDirectory() {
    try {
      await fs.promises.access(this.n8nDir);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn('.n8n directory not found');
        return false;
      }
      throw error;
    }
  }

  async validateStateFile(fileType) {
    const filePath = path.join(this.n8nDir, this.stateFiles[fileType]);
    try {
      await fs.promises.access(filePath);
      const stats = await fs.promises.stat(filePath);
      
      // Check if it's a file and not a directory
      if (!stats.isFile()) {
        logger.error(`${filePath} exists but is not a file`);
        return false;
      }

      // Check file permissions
      const mode = stats.mode;
      const isReadable = (mode & 0o400) !== 0;
      const isWritable = (mode & 0o200) !== 0;
      
      if (!isReadable || !isWritable) {
        logger.error(`${filePath} has incorrect permissions`);
        return false;
      }

      // Validate JSON content
      const content = await fs.promises.readFile(filePath, 'utf8');
      try {
        JSON.parse(content);
        return true;
      } catch (parseError) {
        logger.error(`${filePath} contains invalid JSON`);
        return false;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`${filePath} not found`);
        return false;
      }
      throw error;
    }
  }

  async validateAllStateFiles() {
    const results = {
      directory: await this.validateDirectory(),
      files: {}
    };

    for (const [type, filename] of Object.entries(this.stateFiles)) {
      results.files[type] = await this.validateStateFile(type);
    }

    return results;
  }

  async repairStateFile(fileType) {
    const filePath = path.join(this.n8nDir, this.stateFiles[fileType]);
    try {
      // Backup existing file if it exists
      if (await this.validateStateFile(fileType)) {
        const backupPath = `${filePath}.backup`;
        await fs.promises.copyFile(filePath, backupPath);
        logger.info(`Created backup at ${backupPath}`);
      }

      // Create new file with default state
      const defaultState = this.getDefaultState(fileType);
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(defaultState, null, 2)
      );
      
      logger.info(`Repaired ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to repair ${filePath}:`, error);
      return false;
    }
  }

  getDefaultState(fileType) {
    const defaults = {
      window: {
        bounds: {
          x: 100,
          y: 100,
          width: 1200,
          height: 800
        },
        isMaximized: false,
        isVisible: true
      },
      app: {
        lastActive: new Date().toISOString(),
        theme: 'light',
        language: 'en'
      }
    };
    return defaults[fileType];
  }
}

module.exports = new StateValidator(); 