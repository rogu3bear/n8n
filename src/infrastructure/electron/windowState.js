const fs = require('fs');
const fsPromises = require('fs').promises || require('fs/promises');
const path = require('path');
const os = require('os');
const { logger } = require('../utils/logger');
const { eventHandler } = require('./eventHandler');

class WindowStateManager {
  constructor() {
    this.stateFilePath = path.join(os.homedir(), '.n8n', 'window-state.json');
    this.defaultState = {
      bounds: {
        x: 100,
        y: 100,
        width: 1200,
        height: 800
      },
      isMaximized: false,
      isVisible: true,
      lastActive: null
    };
    this.state = { ...this.defaultState };
  }

  async ensureDirectoryExists() {
    const n8nDir = path.join(os.homedir(), '.n8n');
    try {
      await fsPromises.access(n8nDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fsPromises.mkdir(n8nDir, { recursive: true });
        logger.info('Created .n8n directory');
      } else {
        throw error;
      }
    }
  }

  async loadState() {
    try {
      await this.ensureDirectoryExists();
      const data = await fsPromises.readFile(this.stateFilePath, 'utf8');
      const loadedState = JSON.parse(data);
      
      // Validate and sanitize loaded state
      this.state = this.validateState(loadedState);
      
      logger.info('Window state loaded successfully');
      eventHandler.emitIpcMessage('window:state:loaded', this.state);
      return this.state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this.defaultState;
      }
      logger.error('Error loading window state:', error);
      // Reset to default state on error
      this.state = { ...this.defaultState };
      return this.state;
    }
  }

  validateState(state) {
    const validatedState = { ...this.defaultState };
    
    try {
      // Validate bounds
      if (state && state.bounds) {
        const { x, y, width, height } = state.bounds;
        // Safely get screen dimensions with fallback values
        let screenWidth = 1920;
        let screenHeight = 1080;
        
        try {
          const screen = require('electron').screen;
          if (screen && screen.getPrimaryDisplay) {
            const { workAreaSize } = screen.getPrimaryDisplay();
            screenWidth = workAreaSize.width;
            screenHeight = workAreaSize.height;
          }
        } catch (e) {
          logger.warn('Could not get screen dimensions, using defaults:', e);
        }
        
        // Ensure window is within screen bounds
        validatedState.bounds = {
          x: Math.max(0, Math.min(x || 100, screenWidth - (width || 1200))),
          y: Math.max(0, Math.min(y || 100, screenHeight - (height || 800))),
          width: Math.min(width || 1200, screenWidth),
          height: Math.min(height || 800, screenHeight)
        };
      }
      
      // Validate boolean flags
      if (state) {
        validatedState.isMaximized = Boolean(state.isMaximized);
        validatedState.isVisible = Boolean(state.isVisible);
        
        // Validate timestamp
        validatedState.lastActive = state.lastActive ? new Date(state.lastActive).toISOString() : null;
      }
    } catch (error) {
      logger.error('Error validating window state:', error);
      // If validation fails, return default state
      return { ...this.defaultState };
    }
    
    return validatedState;
  }

  async saveState(state = this.state) {
    try {
      await this.ensureDirectoryExists();
      await fsPromises.writeFile(
        this.stateFilePath,
        JSON.stringify(state, null, 2)
      );
      logger.debug('Window state saved');
      eventHandler.emitIpcMessage('window:state:saved', state);
    } catch (error) {
      logger.error('Failed to save window state:', error);
      throw error;
    }
  }

  async updateState(updates) {
    const currentState = await this.loadState();
    const newState = {
      ...currentState,
      ...updates,
      lastActive: new Date().toISOString()
    };
    await this.saveState(newState);
    return newState;
  }

  async resetState() {
    await this.saveState(this.defaultState);
    return this.defaultState;
  }

  getState() {
    return { ...this.state };
  }

  // Window state recovery methods
  async recoverWindowState(window) {
    try {
      const state = await this.loadState();
      
      // If window is not provided, just return state but don't apply
      if (!window) {
        logger.warn('Window object not provided to recoverWindowState');
        return true;
      }
      
      // Validate screen bounds
      try {
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { workArea } = primaryDisplay;

        // Ensure window is within screen bounds
        const bounds = {
          x: Math.max(workArea.x, Math.min(state.bounds.x, workArea.x + workArea.width - state.bounds.width)),
          y: Math.max(workArea.y, Math.min(state.bounds.y, workArea.y + workArea.height - state.bounds.height)),
          width: Math.min(state.bounds.width, workArea.width),
          height: Math.min(state.bounds.height, workArea.height)
        };

        // Apply validated bounds
        window.setBounds(bounds);
        
        // Restore maximized state if it was maximized
        if (state.isMaximized) {
          window.maximize();
        }

        // Restore visibility
        if (state.isVisible) {
          window.show();
        } else {
          window.hide();
        }
      } catch (error) {
        logger.error('Error applying window state:', error);
        // Continue execution even if window methods fail
      }

      logger.info('Window state recovered successfully');
      eventHandler.emitIpcMessage('window:state:recovered', state);
      return true;
    } catch (error) {
      logger.error('Failed to recover window state:', error);
      // Reset to default state on recovery failure
      await this.resetState();
      return false;
    }
  }
}

// Create singleton instance
const windowStateManager = new WindowStateManager();

module.exports = { windowStateManager }; 