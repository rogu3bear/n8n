const { logger } = require('../../utils/logger');
const { eventHandler } = require('../../services/eventHandler');
const fs = require('fs').promises;

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock fs.promises
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    }
}));

describe('EventHandler Unit Tests', () => {
    beforeEach(() => {
        // Clear all event listeners
        eventHandler.removeAllListeners();
        // Reset mocks
        jest.clearAllMocks();
        // Reset state
        eventHandler.state = {
            app: {
                lastStart: null,
                lastQuit: null,
                version: null,
                isRunning: false
            },
            docker: {
                containers: {},
                lastError: null
            },
            python: {
                envReady: false,
                lastError: null
            },
            npm: {
                lastInstall: null,
                lastError: null
            },
            windows: {},
            system: {
                lastError: null,
                lastWarning: null
            }
        };
    });

    describe('Event Registration', () => {
        it('should register event handlers', async () => {
            const handler = jest.fn();
            eventHandler.on('test:event', handler);
            await eventHandler.emit('test:event', { data: 'test' });
            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should register multiple handlers for the same event', async () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            eventHandler.on('test:event', handler1);
            eventHandler.on('test:event', handler2);
            await eventHandler.emit('test:event', { data: 'test' });
            expect(handler1).toHaveBeenCalledWith({ data: 'test' });
            expect(handler2).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should prevent duplicate handler registration', async () => {
            const handler = jest.fn();
            eventHandler.on('test:event', handler);
            eventHandler.on('test:event', handler);
            await eventHandler.emit('test:event', { data: 'test' });
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('Event Emission', () => {
        it('should emit events to registered handlers', async () => {
            const handler = jest.fn();
            eventHandler.on('test:event', handler);
            await eventHandler.emit('test:event', { data: 'test' });
            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should emit events to multiple handlers', async () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            eventHandler.on('test:event', handler1);
            eventHandler.on('test:event', handler2);
            await eventHandler.emit('test:event', { data: 'test' });
            expect(handler1).toHaveBeenCalledWith({ data: 'test' });
            expect(handler2).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should handle async event handlers', async () => {
            // Create an async handler that uses a Promise that resolves immediately
            const handler = jest.fn().mockResolvedValue('result');
            
            // Register the handler
            eventHandler.on('test:async', handler);
            
            // Emit the event
            await eventHandler.emit('test:async', { data: 'test' });
            
            // Verify the handler was called
            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });
    });

    describe('Event Removal', () => {
        it('should remove event handlers', async () => {
            const handler = jest.fn();
            eventHandler.on('test:event', handler);
            eventHandler.removeListener('test:event', handler);
            await eventHandler.emit('test:event', { data: 'test' });
            expect(handler).not.toHaveBeenCalled();
        });

        it('should remove specific handlers while keeping others', async () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            eventHandler.on('test:event', handler1);
            eventHandler.on('test:event', handler2);
            eventHandler.removeListener('test:event', handler1);
            await eventHandler.emit('test:event', { data: 'test' });
            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should handle removal of non-existent handlers', () => {
            const handler = jest.fn();
            expect(() => eventHandler.removeListener('test:event', handler))
                .not.toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should handle errors in event handlers', async () => {
            const handler = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });

            eventHandler.on('test:event', handler);
            
            // Emit the event, but don't expect it to throw
            await eventHandler.emit('test:event', { data: 'test' });
            
            // Verify handler was called despite the error
            expect(handler).toHaveBeenCalledTimes(1);
            
            // Verify the error was logged
            expect(logger.error).toHaveBeenCalled();
        });

        it('should continue execution after handler error', async () => {
            // First, clear any previous listeners
            eventHandler.removeAllListeners();
            
            // Create mock handlers
            const errorHandler = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });
            
            const successHandler = jest.fn();
            
            // Register handlers - First handler throws, second one should still be called
            eventHandler.on('error:test', errorHandler);
            eventHandler.on('error:test', successHandler);
            
            // Emit event which should trigger both handlers despite first one throwing
            await eventHandler.emit('error:test', { data: 'test' });
            
            // Verify first handler was called and threw an error
            expect(errorHandler).toHaveBeenCalledTimes(1);
            
            // The second handler should also have been called
            expect(successHandler).toHaveBeenCalledTimes(1);
            
            // Error should have been logged
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('State Management', () => {
        it('should save state', async () => {
            fs.writeFile.mockResolvedValue();
            fs.mkdir.mockResolvedValue();
            await eventHandler.saveState();
            expect(fs.writeFile).toHaveBeenCalled();
        });

        it('should load state', async () => {
            const mockState = {
                app: { isRunning: true }
            };
            fs.readFile.mockResolvedValue(JSON.stringify(mockState));
            await eventHandler.loadState();
            expect(eventHandler.state.app.isRunning).toBe(true);
        });

        it('should handle state load errors', async () => {
            fs.readFile.mockRejectedValue(new Error('File not found'));
            await eventHandler.loadState();
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('Application Events', () => {
        it('should emit app start event', async () => {
            const handler = jest.fn();
            eventHandler.on('app:start', handler);
            await eventHandler.emitAppStart();
            expect(handler).toHaveBeenCalled();
            expect(eventHandler.state.app.isRunning).toBe(true);
        });

        it('should emit app quit event', async () => {
            const handler = jest.fn();
            eventHandler.on('app:quit', handler);
            await eventHandler.emitAppQuit();
            expect(handler).toHaveBeenCalled();
            expect(eventHandler.state.app.isRunning).toBe(false);
        });
    });
}); 