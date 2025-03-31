const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { logger } = require('../../utils/logger');
const { StateManager } = require('../../services/stateManager');
const { eventHandler } = require('../../services/eventHandler');

// Mock StateManager
jest.mock('../../services/stateManager', () => ({
    StateManager: jest.fn().mockImplementation((baseDir) => ({
        baseDir,
        saveState: jest.fn(),
        loadState: jest.fn(),
        saveWorkflow: jest.fn(),
        loadWorkflow: jest.fn(),
        deleteWorkflow: jest.fn(),
        cleanup: jest.fn()
    }))
}));

// Mock fs module with proper error handling
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        rm: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('{}'),
        readdir: jest.fn().mockResolvedValue([]),
        chmod: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined)
    }
}));

// Mock os module with proper paths
jest.mock('os', () => {
    const mockOs = {
        tmpdir: jest.fn(),
        homedir: jest.fn()
    };
    mockOs.tmpdir.mockReturnValue('/tmp');
    mockOs.homedir.mockReturnValue('/home/test');
    return mockOs;
});

// Mock logger with proper error handling
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn().mockImplementation((msg, err) => {
            console.error(msg, err);
        }),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Filesystem Integration Tests', () => {
    let testDir;
    let stateManager;

    beforeEach(async () => {
        // Create a temporary test directory with a unique name
        const timestamp = Date.now();
        testDir = path.join('/tmp', `n8n-test-${timestamp}`);
        try {
            await fs.mkdir(testDir, { recursive: true });
        } catch (error) {
            logger.error('Error creating test directory:', error);
            throw error;
        }
        
        // Initialize state manager with test directory
        stateManager = new StateManager(testDir);
        // Clear event handlers
        eventHandler.removeAllListeners();
    });

    afterEach(async () => {
        // Clean up test directory if it exists
        if (testDir) {
            try {
                await fs.rm(testDir, { recursive: true, force: true });
            } catch (error) {
                logger.error('Error cleaning up test directory:', error);
            }
        }
    });

    describe('State File Operations', () => {
        it('should create and read state files correctly', async () => {
            const testState = {
                workflows: [
                    {
                        id: 'test-1',
                        name: 'Test Workflow',
                        active: true
                    }
                ]
            };

            await stateManager.saveState(testState);
            const loadedState = await stateManager.loadState();

            expect(loadedState).toEqual(testState);
        });

        it('should handle file corruption gracefully', async () => {
            const statePath = path.join(testDir, 'state.json');
            await fs.writeFile(statePath, 'invalid json');

            await expect(stateManager.loadState()).rejects.toThrow('Invalid state file');
        });

        it('should backup state files before modifications', async () => {
            const testState = { workflows: [] };
            await stateManager.saveState(testState);

            const files = await fs.readdir(testDir);
            expect(files).toContain('state.json');
            expect(files).toContain('state.json.bak');
        });
    });

    describe('Workflow File Operations', () => {
        it('should save and load workflow files', async () => {
            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: []
            };

            await stateManager.saveWorkflow(workflow);
            const loaded = await stateManager.loadWorkflow(workflow.id);

            expect(loaded).toEqual(workflow);
        });

        it('should handle workflow file deletion', async () => {
            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: []
            };

            await stateManager.saveWorkflow(workflow);
            await stateManager.deleteWorkflow(workflow.id);

            await expect(stateManager.loadWorkflow(workflow.id))
                .rejects
                .toThrow('Workflow not found');
        });
    });

    describe('Event Handling', () => {
        it('should emit events for file operations', async () => {
            const eventSpy = jest.fn();
            eventHandler.on('workflow:created', eventSpy);

            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: []
            };

            await stateManager.saveWorkflow(workflow);
            expect(eventSpy).toHaveBeenCalledWith(workflow);
        });

        it('should handle file system errors gracefully', async () => {
            // Simulate filesystem error by removing write permissions
            await fs.chmod(testDir, '444');

            await expect(stateManager.saveState({}))
                .rejects
                .toThrow('EACCES');
        });
    });

    describe('Cleanup Operations', () => {
        it('should clean up temporary files', async () => {
            const tempFile = path.join(testDir, 'temp.json');
            await fs.writeFile(tempFile, '{}');

            await stateManager.cleanup();
            const files = await fs.readdir(testDir);
            expect(files).not.toContain('temp.json');
        });

        it('should maintain backup rotation', async () => {
            // Create multiple backups
            for (let i = 0; i < 5; i++) {
                await stateManager.saveState({ version: i });
            }

            const files = await fs.readdir(testDir);
            const backups = files.filter(f => f.startsWith('state.json.bak'));
            expect(backups.length).toBeLessThanOrEqual(3); // Should maintain max 3 backups
        });
    });

    describe('Security', () => {
        it('should validate file paths', async () => {
            const maliciousPath = path.join(testDir, '..', '..', 'etc', 'passwd');
            await expect(stateManager.saveWorkflow({}, maliciousPath))
                .rejects
                .toThrow('Invalid file path');
        });

        it('should sanitize file names', async () => {
            const maliciousName = '../../etc/passwd';
            await expect(stateManager.saveWorkflow({ id: maliciousName }))
                .rejects
                .toThrow('Invalid workflow ID');
        });
    });
}); 