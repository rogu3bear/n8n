const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { conversationStateManager } = require('../../services/conversationState');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('ConversationStateManager', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock fs.readFile to return empty state
    fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
  });

  test('should initialize with empty state when no file exists', async () => {
    const context = await conversationStateManager.getConversationContext('test-id');
    expect(context).toEqual({
      history: [],
      metadata: {},
      lastUpdated: expect.any(String)
    });
  });

  test('should update and retrieve conversation context', async () => {
    const conversationId = 'test-conversation';
    const context = {
      metadata: { user: 'test-user' },
      content: 'Test message'
    };

    await conversationStateManager.updateConversationContext(conversationId, context);
    const retrievedContext = await conversationStateManager.getConversationContext(conversationId);

    expect(retrievedContext.metadata).toEqual({ user: 'test-user' });
    expect(retrievedContext.history).toHaveLength(1);
    expect(retrievedContext.history[0].content).toBe('Test message');
  });

  test('should maintain history size limit', async () => {
    const conversationId = 'test-conversation';
    
    // Add more messages than the limit
    for (let i = 0; i < 150; i++) {
      await conversationStateManager.updateConversationContext(conversationId, {
        metadata: {},
        content: `Message ${i}`
      });
    }

    const context = await conversationStateManager.getConversationContext(conversationId);
    expect(context.history).toHaveLength(100); // maxHistorySize
  });

  test('should clear conversation context', async () => {
    const conversationId = 'test-conversation';
    
    // Add some context
    await conversationStateManager.updateConversationContext(conversationId, {
      metadata: { user: 'test-user' },
      content: 'Test message'
    });

    // Clear the context
    await conversationStateManager.clearConversationContext(conversationId);
    
    // Verify it's cleared
    const context = await conversationStateManager.getConversationContext(conversationId);
    expect(context.history).toHaveLength(0);
    expect(context.metadata).toEqual({});
  });
}); 