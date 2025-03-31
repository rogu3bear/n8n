const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { logger } = require('../../utils/logger');
const { StateManager } = require('../../services/stateManager');

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock os module
jest.mock('os', () => ({
    tmpdir: () => '/tmp'
}));

describe('StateManager Unit Tests', () => {
    let stateManager;
    let testDir;

    beforeEach(async () => {
        // Create a unique test directory in the system's temp directory
        testDir = path.join(os.tmpdir(), `n8n-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        stateManager = new StateManager(testDir);
    });

    afterEach(async () => {
        try {
            if (testDir) {
                await fs.rm(testDir, { recursive: true, force: true });
            }
        } catch (error) {
            logger.error('Error cleaning up test directory:', error);
        }
    });

    describe('State File Operations', () => {
        it('should create and load state file', async () => {
            const initialState = {
                workflows: [],
                settings: {
                    theme: 'dark',
                    language: 'en'
                }
            };

            await stateManager.saveState(initialState);
            const loadedState = await stateManager.loadState();

            expect(loadedState).toEqual(initialState);
        });

        it('should handle state file corruption', async () => {
            const statePath = path.join(testDir, 'state.json');
            await fs.writeFile(statePath, 'invalid json');

            await expect(stateManager.loadState())
                .rejects
                .toThrow('Invalid state file');
        });

        it('should create backup before saving state', async () => {
            const state = { workflows: [] };
            await stateManager.saveState(state);

            const files = await fs.readdir(testDir);
            expect(files).toContain('state.json');
            expect(files).toContain('state.json.bak');
        });
    });

    describe('Workflow Management', () => {
        it('should create a new workflow', async () => {
            const workflow = {
                name: 'Test Workflow',
                nodes: [],
                connections: []
            };

            const created = await stateManager.createWorkflow(workflow);
            expect(created.id).toBeDefined();
            expect(created.name).toBe(workflow.name);
        });

        it('should update an existing workflow', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Original Name',
                nodes: []
            });

            const updated = await stateManager.updateWorkflow(workflow.id, {
                name: 'Updated Name'
            });

            expect(updated.name).toBe('Updated Name');
        });

        it('should delete a workflow', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'To Delete',
                nodes: []
            });

            await stateManager.deleteWorkflow(workflow.id);
            await expect(stateManager.getWorkflow(workflow.id))
                .rejects
                .toThrow('Workflow not found');
        });
    });

    describe('Node Management', () => {
        it('should add nodes to a workflow', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Node Test',
                nodes: []
            });

            const node = {
                type: 'http',
                position: { x: 100, y: 100 },
                data: { url: 'https://api.example.com' }
            };

            const updated = await stateManager.addNode(workflow.id, node);
            expect(updated.nodes).toHaveLength(1);
            expect(updated.nodes[0].id).toBeDefined();
        });

        it('should update node connections', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Connection Test',
                nodes: []
            });

            const node1 = await stateManager.addNode(workflow.id, {
                type: 'http',
                position: { x: 100, y: 100 }
            });

            const node2 = await stateManager.addNode(workflow.id, {
                type: 'transform',
                position: { x: 300, y: 100 }
            });

            const connection = {
                from: node1.nodes[0].id,
                to: node2.nodes[0].id
            };

            const updated = await stateManager.addConnection(workflow.id, connection);
            expect(updated.connections).toHaveLength(1);
        });
    });

    describe('Validation', () => {
        it('should validate workflow structure', async () => {
            const invalidWorkflow = {
                name: 'Invalid',
                nodes: [
                    {
                        type: 'http',
                        // Missing required position
                    }
                ]
            };

            await expect(stateManager.createWorkflow(invalidWorkflow))
                .rejects
                .toThrow('Invalid workflow structure');
        });

        it('should validate node connections', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Connection Test',
                nodes: []
            });

            const invalidConnection = {
                from: 'non-existent',
                to: 'also-non-existent'
            };

            await expect(stateManager.addConnection(workflow.id, invalidConnection))
                .rejects
                .toThrow('Invalid connection');
        });
    });

    describe('Error Handling', () => {
        it('should handle file system errors', async () => {
            // Simulate filesystem error by removing write permissions
            await fs.chmod(testDir, '444');

            await expect(stateManager.saveState({}))
                .rejects
                .toThrow('EACCES');
        });

        it('should handle concurrent operations', async () => {
            const workflow = {
                name: 'Concurrent Test',
                nodes: []
            };

            const operations = Array(5).fill().map(() => 
                stateManager.createWorkflow(workflow)
            );

            await expect(Promise.all(operations))
                .resolves
                .toHaveLength(5);
        });
    });

    describe('Backup Management', () => {
        it('should rotate backups', async () => {
            // Create multiple backups
            for (let i = 0; i < 5; i++) {
                await stateManager.saveState({ version: i });
            }

            const files = await fs.readdir(testDir);
            const backups = files.filter(f => f.startsWith('state.json.bak'));
            expect(backups.length).toBeLessThanOrEqual(3); // Should maintain max 3 backups
        });

        it('should restore from backup', async () => {
            const state = { workflows: [] };
            await stateManager.saveState(state);

            // Corrupt the main state file
            const statePath = path.join(testDir, 'state.json');
            await fs.writeFile(statePath, 'invalid json');

            // Restore from backup
            await stateManager.restoreFromBackup();
            const restored = await stateManager.loadState();
            expect(restored).toEqual(state);
        });
    });
}); 