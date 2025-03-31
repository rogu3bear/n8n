const { logger } = require('../../utils/logger');
const { StateManager } = require('../../services/stateManager');
const { EventHandler } = require('../../services/eventHandler');
const { ExcelService } = require('../../services/excelService');

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

describe('Workflow Integration Tests', () => {
    let stateManager;
    let eventHandler;
    let excelService;
    let testDir;

    beforeEach(async () => {
        testDir = path.join(process.cwd(), 'test-files');
        await fs.mkdir(testDir, { recursive: true });
        
        stateManager = new StateManager(testDir);
        eventHandler = new EventHandler();
        excelService = new ExcelService();
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Error cleaning up test directory:', error);
        }
    });

    describe('Workflow CRUD Operations', () => {
        it('should create a new workflow', async () => {
            const workflow = {
                name: 'New Workflow',
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

    describe('Workflow Node Operations', () => {
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

    describe('Workflow Export/Import', () => {
        it('should export workflow to Excel', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Export Test',
                nodes: [
                    {
                        type: 'http',
                        position: { x: 100, y: 100 }
                    }
                ]
            });

            const buffer = await excelService.exportWorkflow(workflow);
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
        });

        it('should import workflow from Excel', async () => {
            const workflow = await stateManager.createWorkflow({
                name: 'Import Test',
                nodes: [
                    {
                        type: 'http',
                        position: { x: 100, y: 100 }
                    }
                ]
            });

            const buffer = await excelService.exportWorkflow(workflow);
            const imported = await excelService.importWorkflow(buffer);

            expect(imported.name).toBe(workflow.name);
            expect(imported.nodes).toHaveLength(1);
        });
    });

    describe('Workflow Validation', () => {
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

    describe('Workflow Events', () => {
        it('should emit workflow events', async () => {
            const eventSpy = jest.fn();
            eventHandler.on('workflow:created', eventSpy);

            const workflow = await stateManager.createWorkflow({
                name: 'Event Test',
                nodes: []
            });

            expect(eventSpy).toHaveBeenCalledWith(workflow);
        });

        it('should handle workflow execution events', async () => {
            const eventSpy = jest.fn();
            eventHandler.on('workflow:started', eventSpy);

            const workflow = await stateManager.createWorkflow({
                name: 'Execution Test',
                nodes: []
            });

            await stateManager.startWorkflow(workflow.id);
            expect(eventSpy).toHaveBeenCalledWith(workflow.id);
        });
    });
}); 