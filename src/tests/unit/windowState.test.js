const { logger } = require('../../utils/logger');
const path = require('path');
const os = require('os');

// Mock logger with proper error method
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Create separate mock implementation functions to track calls
const mockFsPromises = {
    access: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined)
};

// Mock fs and fs/promises with proper error handling
jest.mock('fs', () => {
    const originalModule = jest.requireActual('fs');
    return {
        ...originalModule,
        promises: mockFsPromises
    };
});

// Also mock fs/promises separately to ensure both ways of importing promises work
jest.mock('fs/promises', () => mockFsPromises);

// Mock os with proper paths
jest.mock('os', () => ({
    tmpdir: jest.fn().mockReturnValue('/tmp'),
    homedir: jest.fn().mockReturnValue('/home/test')
}));

// Mock electron screen with proper dimensions
jest.mock('electron', () => ({
    screen: {
        getPrimaryDisplay: jest.fn().mockReturnValue({
            workAreaSize: { width: 1920, height: 1080 },
            workArea: { x: 0, y: 0, width: 1920, height: 1080 }
        })
    }
}));

// Mock eventHandler with proper event emission
jest.mock('../../services/eventHandler', () => ({
    eventHandler: {
        emitIpcMessage: jest.fn()
    }
}));

// Import the service after all mocks are set up
const { windowStateManager } = require('../../services/windowState');
const { eventHandler } = require('../../services/eventHandler');

describe('WindowState Unit Tests', () => {
    // Create a mock window object
    const mockWindow = {
        setBounds: jest.fn(),
        maximize: jest.fn(),
        show: jest.fn(),
        hide: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset all mocks to their default implementations
        const stateData = JSON.stringify({
            bounds: {
                x: 100,
                y: 100,
                width: 1200,
                height: 800
            },
            isMaximized: false,
            isVisible: true,
            lastActive: null
        });
        
        // Set up fs.promises mocks with resolved values
        mockFsPromises.readFile.mockResolvedValue(stateData);
    });

    describe('Window State Management', () => {
        it('should initialize with default state', async () => {
            const state = await windowStateManager.loadState();
            expect(state).toEqual({
                bounds: {
                    x: 100,
                    y: 100,
                    width: 1200,
                    height: 800
                },
                isMaximized: false,
                isVisible: true,
                lastActive: null
            });
        });

        it('should update window dimensions', async () => {
            await windowStateManager.updateState({
                bounds: {
                    width: 1024,
                    height: 768
                }
            });
            expect(mockFsPromises.writeFile).toHaveBeenCalled();
        });

        it('should update window position', async () => {
            await windowStateManager.updateState({
                bounds: {
                    x: 200,
                    y: 200
                }
            });
            expect(mockFsPromises.writeFile).toHaveBeenCalled();
        });

        it('should update window state flags', async () => {
            await windowStateManager.updateState({
                isMaximized: true,
                isVisible: false
            });
            expect(mockFsPromises.writeFile).toHaveBeenCalled();
        });
    });

    describe('Window State Validation', () => {
        it('should validate window dimensions', async () => {
            mockFsPromises.readFile.mockResolvedValueOnce(JSON.stringify({
                bounds: {
                    width: 0,
                    height: 0
                }
            }));
            
            const state = await windowStateManager.loadState();
            expect(state.bounds.width).toBeGreaterThan(0);
            expect(state.bounds.height).toBeGreaterThan(0);
        });

        it('should validate window position', async () => {
            mockFsPromises.readFile.mockResolvedValueOnce(JSON.stringify({
                bounds: {
                    x: -1,
                    y: -1
                }
            }));
            
            const state = await windowStateManager.loadState();
            expect(state.bounds.x).toBeGreaterThanOrEqual(0);
            expect(state.bounds.y).toBeGreaterThanOrEqual(0);
        });

        it('should enforce screen bounds', async () => {
            mockFsPromises.readFile.mockResolvedValueOnce(JSON.stringify({
                bounds: {
                    x: 9999,
                    y: 9999
                }
            }));
            
            const state = await windowStateManager.loadState();
            expect(state.bounds.x).toBeLessThan(9999);
            expect(state.bounds.y).toBeLessThan(9999);
        });
    });

    describe('Window State Persistence', () => {
        it('should save window state', async () => {
            await windowStateManager.saveState();
            expect(mockFsPromises.writeFile).toHaveBeenCalled();
        });

        it('should load window state', async () => {
            const state = await windowStateManager.loadState();
            expect(state).toBeDefined();
            expect(mockFsPromises.readFile).toHaveBeenCalled();
        });

        it('should handle invalid saved state', async () => {
            mockFsPromises.readFile.mockRejectedValueOnce(new Error('Invalid JSON'));
            const state = await windowStateManager.loadState();
            expect(state).toEqual(windowStateManager.defaultState);
        });
    });

    describe('Window State Recovery', () => {
        it('should recover window state', async () => {
            const result = await windowStateManager.recoverWindowState(mockWindow);
            expect(result).toBe(true);
            expect(mockWindow.setBounds).toHaveBeenCalled();
        });

        it('should handle missing window object', async () => {
            const result = await windowStateManager.recoverWindowState();
            expect(result).toBe(true);
        });

        it('should handle recovery failure', async () => {
            // Mock error during file read
            mockFsPromises.readFile.mockRejectedValueOnce(new Error('File not found'));
            
            // Mock resetState to verify it's called
            const originalResetState = windowStateManager.resetState;
            windowStateManager.resetState = jest.fn().mockResolvedValue(windowStateManager.defaultState);
            
            // Also mock loadState to ensure it throws
            const originalLoadState = windowStateManager.loadState;
            windowStateManager.loadState = jest.fn().mockRejectedValueOnce(new Error('File not found'));
            
            try {
                const result = await windowStateManager.recoverWindowState(mockWindow);
                expect(result).toBe(false);
                expect(windowStateManager.resetState).toHaveBeenCalled();
            } finally {
                // Restore original methods
                windowStateManager.resetState = originalResetState;
                windowStateManager.loadState = originalLoadState;
            }
        });
    });
}); 