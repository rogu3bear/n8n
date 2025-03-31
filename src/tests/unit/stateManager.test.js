const fs = require('fs').promises;
const path = require('path');
const { fileURLToPath } = require('url');
const StateManager = require('../../services/stateManager');
const { logger } = require('../../utils/logger');

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn()
    }
}));

describe('StateManager Unit Tests', () => {
    let stateManager;
    let testDir;
    let baseDir;

    beforeAll(async () => {
        testDir = path.resolve(process.cwd(), 'test-data');
        try {
            await fs.access(testDir);
        } catch {
            await fs.mkdir(testDir);
        }
    });

    beforeEach(async () => {
        baseDir = path.join(testDir, `test-${Date.now()}`);
        await fs.mkdir(baseDir);
        stateManager = new StateManager(baseDir);
        await stateManager.initialize();
    });

    afterEach(async () => {
        if (!stateManager || !stateManager.stateFilePath) return;
        try {
            const dir = path.dirname(stateManager.stateFilePath);
            const files = await fs.readdir(dir);
            for (const file of files) {
                await fs.unlink(path.join(dir, file));
            }
            await fs.rmdir(dir);
        } catch (error) {
            console.error('Error cleaning up test directory:', error);
        }
    });

    afterAll(async () => {
        if (!testDir) return;
        try {
            const files = await fs.readdir(testDir);
            for (const file of files) {
                const filePath = path.join(testDir, file);
                const stats = await fs.stat(filePath);
                if (stats.isDirectory()) {
                    const subFiles = await fs.readdir(filePath);
                    for (const subFile of subFiles) {
                        await fs.unlink(path.join(filePath, subFile));
                    }
                    await fs.rmdir(filePath);
                } else {
                    await fs.unlink(filePath);
                }
            }
            await fs.rmdir(testDir);
        } catch (error) {
            console.error('Error cleaning up main test directory:', error);
        }
    });

    describe('State File Operations', () => {
        test('should create and load state file', async () => {
            const testState = { test: 'data' };
            await stateManager.setState(testState);
            const state = await stateManager.getState();
            expect(state).toEqual({
                ...stateManager.state,
                ...testState
            });
        });

        test('should handle state file corruption', async () => {
            await fs.writeFile(stateManager.stateFilePath, 'invalid json');
            const state = await stateManager.getState();
            expect(state).toEqual({
                workflows: {},
                nodes: {},
                connections: {},
                settings: {}
            });
        });

        test('should create backup before saving state', async () => {
            await stateManager.setState({ test: 'data' });
            const files = await fs.readdir(path.dirname(stateManager.stateFilePath));
            expect(files.some(file => file.includes('.backup'))).toBe(true);
        });
    });

    describe('Workflow Management', () => {
        test('should create a new workflow', async () => {
            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: []
            };
            await stateManager.createWorkflow(workflow);
            const state = await stateManager.getState();
            expect(state.workflows['test-workflow']).toEqual(workflow);
        });

        test('should delete a workflow', async () => {
            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: []
            };
            await stateManager.createWorkflow(workflow);
            await stateManager.deleteWorkflow('test-workflow');
            const state = await stateManager.getState();
            expect(state.workflows['test-workflow']).toBeUndefined();
        });
    });

    describe('Node Management', () => {
        test('should add nodes to a workflow', async () => {
            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: []
            };
            await stateManager.createWorkflow(workflow);
            
            const node = {
                id: 'test-node',
                type: 'test',
                parameters: {}
            };
            await stateManager.addNode('test-workflow', node);
            
            const state = await stateManager.getState();
            expect(state.workflows['test-workflow'].nodes).toContainEqual(node);
        });

        test('should update node connections', async () => {
            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: [
                    { id: 'node1', type: 'test', parameters: {} },
                    { id: 'node2', type: 'test', parameters: {} }
                ]
            };
            await stateManager.createWorkflow(workflow);
            
            const connection = {
                sourceId: 'node1',
                targetId: 'node2'
            };
            await stateManager.updateConnections('test-workflow', [connection]);
            
            const state = await stateManager.getState();
            expect(state.workflows['test-workflow'].connections).toContainEqual(connection);
        });
    });

    describe('Validation', () => {
        test('should validate workflow structure', async () => {
            const invalidWorkflow = {
                name: 'Invalid Workflow'
                // Missing required id field
            };
            await expect(stateManager.createWorkflow(invalidWorkflow)).rejects.toThrow();
        });

        test('should validate node connections', async () => {
            const workflow = {
                id: 'test-workflow',
                name: 'Test Workflow',
                nodes: [{ id: 'node1', type: 'test', parameters: {} }]
            };
            await stateManager.createWorkflow(workflow);
            
            const invalidConnection = {
                sourceId: 'non-existent-node',
                targetId: 'node1'
            };
            await expect(stateManager.updateConnections('test-workflow', [invalidConnection])).rejects.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('should handle file system errors', async () => {
            // Make the state file directory read-only
            await fs.chmod(path.dirname(stateManager.stateFilePath), 0o444);
            await expect(stateManager.setState({ test: 'data' })).rejects.toThrow();
            // Reset permissions
            await fs.chmod(path.dirname(stateManager.stateFilePath), 0o777);
        });

        test('should handle concurrent operations', async () => {
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(stateManager.setState({ test: `data-${i}` }));
            }
            await expect(Promise.all(promises)).resolves.not.toThrow();
        });
    });

    describe('Backup Management', () => {
        test('should rotate backups', async () => {
            for (let i = 0; i < 5; i++) {
                await stateManager.setState({ test: `data-${i}` });
            }
            const files = await fs.readdir(path.dirname(stateManager.stateFilePath));
            const backups = files.filter(file => file.includes('.backup'));
            expect(backups.length).toBeLessThanOrEqual(3); // Assuming max 3 backups
        });

        test('should restore from backup', async () => {
            const testState = { test: 'data' };
            await stateManager.setState(testState);
            
            // Corrupt the main state file
            await fs.writeFile(stateManager.stateFilePath, 'invalid json');
            
            // Force a restore from backup
            await stateManager.loadState();
            const state = await stateManager.getState();
            expect(state).toEqual({
                ...stateManager.state,
                ...testState
            });
        });
    });
}); 