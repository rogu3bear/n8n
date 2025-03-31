const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ConversationStateManager extends EventEmitter {
  constructor() {
    super();
    this.state = new Map();
    this.stateFilePath = path.join(os.homedir(), '.n8n', 'conversation-state.json');
    this.maxHistorySize = 100;
    this.setupState();
  }

  async setupState() {
    try {
      await this.loadState();
    } catch (error) {
      console.error('Error setting up conversation state:', error);
    }
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFilePath, 'utf8');
      const loadedState = JSON.parse(data);
      this.state = new Map(Object.entries(loadedState));
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Initialize with empty state if no file exists
        this.state = new Map();
      } else {
        throw error;
      }
    }
  }

  async saveState() {
    try {
      await fs.writeFile(
        this.stateFilePath,
        JSON.stringify(Object.fromEntries(this.state), null, 2)
      );
    } catch (error) {
      console.error('Error saving conversation state:', error);
    }
  }

  async updateConversationContext(conversationId, context) {
    const currentContext = this.state.get(conversationId) || {
      history: [],
      metadata: {},
      lastUpdated: new Date().toISOString()
    };

    // Update context
    currentContext.metadata = {
      ...currentContext.metadata,
      ...context.metadata
    };

    // Add to history with size limit
    currentContext.history.push({
      timestamp: new Date().toISOString(),
      content: context.content
    });

    if (currentContext.history.length > this.maxHistorySize) {
      currentContext.history = currentContext.history.slice(-this.maxHistorySize);
    }

    currentContext.lastUpdated = new Date().toISOString();
    this.state.set(conversationId, currentContext);
    await this.saveState();
  }

  async getConversationContext(conversationId) {
    return this.state.get(conversationId) || {
      history: [],
      metadata: {},
      lastUpdated: new Date().toISOString()
    };
  }

  async clearConversationContext(conversationId) {
    this.state.delete(conversationId);
    await this.saveState();
  }
}

// Export singleton instance
const conversationStateManager = new ConversationStateManager();
module.exports = { conversationStateManager }; 