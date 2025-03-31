const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { logger } = require('../../utils/logger');
const { stateManager } = require('../../services/stateManager');
const { eventHandler } = require('../../services/eventHandler');

// Mock StateManager
jest.mock('../../services/stateManager', () => ({
    stateManager: {
        setBaseDir: jest.fn(),
        saveWorkflow: jest.fn(),
        saveState: jest.fn(),
        createWorkflow: jest.fn(),
        addNode: jest.fn(),
        updateWorkflow: jest.fn()
    }
}));

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        rm: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('{}'),
        readdir: jest.fn().mockResolvedValue([]),
        chmod: jest.fn().mockResolvedValue(undefined)
    }
}));

// Mock os module
jest.mock('os', () => {
    const mockOs = {
        tmpdir: jest.fn(),
        homedir: jest.fn()
    };
    mockOs.tmpdir.mockReturnValue('/tmp');
    mockOs.homedir.mockReturnValue('/home/test');
    return mockOs;
});

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Security Integration Tests', () => {
    let testDir;

    beforeEach(async () => {
        // Create a temporary test directory with a unique name
        const timestamp = Date.now();
        testDir = path.join('/tmp', `n8n-security-test-${timestamp}`);
        try {
            await fs.mkdir(testDir, { recursive: true });
        } catch (error) {
            console.error('Error creating test directory:', error);
            throw error;
        }
        
        // Reset state manager's directory
        stateManager.setBaseDir(testDir);
        // Clear event handlers
        eventHandler.removeAllListeners();
    });

    afterEach(async () => {
        // Clean up test directory if it exists
        if (testDir) {
            try {
                await fs.rm(testDir, { recursive: true, force: true });
            } catch (error) {
                console.error('Error cleaning up test directory:', error);
            }
        }
    });

    describe('File System Security', () => {
        it('should prevent directory traversal attacks', async () => {
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

        it('should enforce file size limits', async () => {
            const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB
            await expect(stateManager.saveState({ data: largeData }))
                .rejects
                .toThrow('File size exceeds limit');
        });
    });

    describe('Data Validation', () => {
        it('should validate workflow data structure', async () => {
            const maliciousData = {
                name: 'Test',
                nodes: [
                    {
                        type: 'http',
                        data: {
                            url: 'javascript:alert(1)'
                        }
                    }
                ]
            };

            await expect(stateManager.createWorkflow(maliciousData))
                .rejects
                .toThrow('Invalid node data');
        });

        it('should sanitize node parameters', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Test',
                nodes: []
            });

            const maliciousNode = {
                type: 'http',
                position: { x: 100, y: 100 },
                data: {
                    url: 'javascript:alert(1)',
                    method: 'POST',
                    body: '<script>alert(1)</script>'
                }
            };

            await expect(stateManager.addNode(workflow.id, maliciousNode))
                .rejects
                .toThrow('Invalid node parameters');
        });
    });

    describe('Access Control', () => {
        it('should enforce workflow ownership', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Test',
                nodes: []
            });

            // Simulate different user
            const otherUser = {
                id: 'other-user',
                permissions: ['read']
            };

            await expect(stateManager.updateWorkflow(workflow.id, {
                name: 'Modified'
            }, otherUser))
                .rejects
                .toThrow('Unauthorized');
        });

        it('should validate user permissions', async () => {
            const user = {
                id: 'test-user',
                permissions: ['read']
            };

            await expect(stateManager.createWorkflow({
                name: 'Test',
                nodes: []
            }, user))
                .rejects
                .toThrow('Insufficient permissions');
        });
    });

    describe('Event Security', () => {
        it('should prevent event injection', async () => {
            const eventSpy = jest.fn();
            eventHandler.on('workflow:created', eventSpy);

            const maliciousEvent = {
                type: 'workflow:created',
                data: {
                    name: 'Test',
                    nodes: [
                        {
                            type: 'http',
                            data: {
                                url: 'javascript:alert(1)'
                            }
                        }
                    ]
                }
            };

            await expect(eventHandler.emit(maliciousEvent.type, maliciousEvent.data))
                .rejects
                .toThrow('Invalid event data');
        });

        it('should validate event handlers', async () => {
            const maliciousHandler = () => {
                throw new Error('Malicious code execution');
            };

            await expect(eventHandler.on('workflow:created', maliciousHandler))
                .rejects
                .toThrow('Invalid event handler');
        });
    });

    describe('State Management Security', () => {
        it('should prevent state corruption', async () => {
            const statePath = path.join(testDir, 'state.json');
            await fs.writeFile(statePath, 'invalid json');

            await expect(stateManager.loadState())
                .rejects
                .toThrow('Invalid state file');
        });

        it('should validate state transitions', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Test',
                nodes: []
            });

            const invalidTransition = {
                id: workflow.id,
                status: 'invalid_status'
            };

            await expect(stateManager.updateWorkflowStatus(invalidTransition))
                .rejects
                .toThrow('Invalid state transition');
        });
    });

    describe('Backup Security', () => {
        it('should secure backup files', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Test',
                nodes: []
            });

            const backupPath = path.join(testDir, `${workflow.id}.bak`);
            await fs.writeFile(backupPath, 'sensitive data');

            await expect(stateManager.restoreWorkflow(workflow.id))
                .rejects
                .toThrow('Invalid backup file');
        });

        it('should enforce backup rotation', async () => {
            // Create multiple backups
            for (let i = 0; i < 5; i++) {
                await stateManager.saveState({ version: i });
            }

            const files = await fs.readdir(testDir);
            const backups = files.filter(f => f.startsWith('state.json.bak'));
            expect(backups.length).toBeLessThanOrEqual(3); // Should maintain max 3 backups
        });
    });
}); 