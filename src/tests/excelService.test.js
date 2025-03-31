const { excelService } = require('../services/excelService');
const { logger } = require('../utils/logger');
const ExcelJS = require('exceljs');

// Mock ExcelJS with proper implementation
jest.mock('exceljs', () => {
    // Create a proper mock for worksheets that allows adding rows
    class MockWorksheet {
        constructor(name) {
            this.name = name;
            this.rows = [];
            this.columns = [];
        }
        
        addRow(data) {
            this.rows.push(data);
            return { commit: jest.fn() };
        }
        
        getRow(rowNumber) {
            return {
                getCell: (cellNumber) => ({ 
                    value: this.rows[rowNumber - 1] ? 
                        Object.values(this.rows[rowNumber - 1])[cellNumber - 1] : 
                        'test'
                }),
                font: {},
                fill: {}
            };
        }
        
        eachRow(callback) {
            // Add a header row for simulating Excel structure
            callback({ 
                getCell: (cellNumber) => ({ value: `Header ${cellNumber}` }) 
            }, 1);
            
            // Add mock data rows
            this.rows.forEach((row, index) => {
                callback({
                    getCell: (cellNumber) => {
                        const keys = Object.keys(row);
                        const values = Object.values(row);
                        return { value: cellNumber <= values.length ? values[cellNumber - 1] : null };
                    }
                }, index + 2); // +2 because we start with header row at index 1
            });
        }
    }

    // Create a proper mock workbook that tracks worksheets
    class MockWorkbook {
        constructor() {
            this.worksheets = [];
            
            // Create the xlsx property with proper methods
            this.xlsx = {
                writeBuffer: jest.fn().mockResolvedValue(Buffer.from('test-excel-data')),
                load: jest.fn().mockImplementation(async (buffer) => {
                    if (buffer && buffer.toString() === 'corrupted data') {
                        throw new Error('Failed to load Excel file');
                    }
                    
                    // Create test worksheets for the mock
                    this.addWorksheet('Workflow');
                    const ws = this.getWorksheet('Workflow');
                    ws.addRow({ property: 'ID', value: '123' });
                    ws.addRow({ property: 'Name', value: 'Test Workflow' });
                    ws.addRow({ property: 'Active', value: 'Yes' });
                    
                    this.addWorksheet('Nodes');
                    const nodesWs = this.getWorksheet('Nodes');
                    nodesWs.addRow({ id: 'node1', name: 'Start', type: 'trigger', position: 'x: 100, y: 100' });
                    
                    this.addWorksheet('Connections');
                    const connWs = this.getWorksheet('Connections');
                    connWs.addRow({ from: 'node1', to: 'node2', type: 'main' });
                    
                    return this;
                })
            };
        }
        
        addWorksheet(name) {
            const worksheet = new MockWorksheet(name);
            this.worksheets.push(worksheet);
            return worksheet;
        }
        
        getWorksheet(name) {
            return this.worksheets.find(ws => ws.name === name) || null;
        }
    }

    return {
        Workbook: jest.fn().mockImplementation(() => new MockWorkbook())
    };
});

// Mock logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('ExcelService', () => {
    const mockWorkflow = {
        name: 'Test Workflow',
        id: '123',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: [
            {
                id: 'node1',
                name: 'Start',
                type: 'trigger',
                position: [100, 100]
            },
            {
                id: 'node2',
                name: 'Process',
                type: 'action',
                position: [200, 200]
            }
        ],
        connections: [
            {
                from: 'node1',
                to: 'node2',
                type: 'main'
            }
        ]
    };

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        
        // Reset environment variables
        process.env.MAX_WORKFLOW_SIZE = '10485760'; // 10MB
        process.env.MAX_NODES = '1000';
    });

    describe('exportWorkflow', () => {
        it('should export workflow to Excel buffer', async () => {
            const buffer = await excelService.exportWorkflow(mockWorkflow);
            expect(buffer).toBeInstanceOf(Buffer);
            expect(logger.debug).toHaveBeenCalledWith('Workflow exported successfully to Excel format');
        });

        it('should handle empty workflow data gracefully', async () => {
            const emptyWorkflow = {
                id: 'empty-workflow',
                name: 'Empty Workflow',
                active: false,
                nodes: [],
                connections: []
            };

            const buffer = await excelService.exportWorkflow(emptyWorkflow);
            expect(buffer).toBeDefined();
            expect(buffer).toBeInstanceOf(Buffer);
        });
        
        it('should handle missing nodes or connections', async () => {
            const partialWorkflow = {
                id: 'partial',
                name: 'Partial Workflow'
                // No nodes or connections
            };
            
            const buffer = await excelService.exportWorkflow(partialWorkflow);
            expect(buffer).toBeDefined();
            expect(buffer).toBeInstanceOf(Buffer);
        });
        
        it('should handle alternative connection format (object-based)', async () => {
            const objectConnectionsWorkflow = {
                id: 'object-connections',
                name: 'Object Connections Workflow',
                nodes: [
                    { id: 'node1', name: 'Node 1', type: 'trigger', position: [100, 100] },
                    { id: 'node2', name: 'Node 2', type: 'action', position: [200, 200] }
                ],
                connections: {
                    node1: [
                        { node: 'node2', type: 'main' }
                    ]
                }
            };
            
            const buffer = await excelService.exportWorkflow(objectConnectionsWorkflow);
            expect(buffer).toBeDefined();
            expect(buffer).toBeInstanceOf(Buffer);
        });
    });

    describe('importWorkflow', () => {
        it('should import workflow from Excel buffer', async () => {
            // Use the mock that returns test data
            const buffer = Buffer.from('test-excel-data');
            const importedWorkflow = await excelService.importWorkflow(buffer);
            
            // Verify the imported workflow has expected structure
            expect(importedWorkflow).toBeDefined();
            expect(importedWorkflow.id).toBeDefined();
            expect(importedWorkflow.name).toBeDefined();
            expect(Array.isArray(importedWorkflow.nodes)).toBe(true);
            expect(Array.isArray(importedWorkflow.connections)).toBe(true);
        });

        it('should throw error for invalid buffer', async () => {
            await expect(excelService.importWorkflow('not a buffer')).rejects.toThrow('Invalid file buffer provided');
        });

        it('should throw error for corrupted Excel file', async () => {
            await expect(excelService.importWorkflow(Buffer.from('corrupted data'))).rejects.toThrow(/Failed to load Excel file/);
        });
    });

    describe('error handling', () => {
        it('should handle file size limits', async () => {
            // Create a very large workflow that exceeds the limits
            process.env.MAX_WORKFLOW_SIZE = '10'; // 10 bytes limit
            
            // Mock large workflow
            const largeWorkflow = { ...mockWorkflow };
            
            await expect(excelService.exportWorkflow(largeWorkflow))
                .rejects
                .toThrow('Workflow size exceeds maximum allowed size');
        });

        it('should handle node count limits', async () => {
            // Set low node limit
            process.env.MAX_NODES = '1';
            
            // Create workflow with too many nodes
            const manyNodesWorkflow = {
                ...mockWorkflow,
                nodes: [
                    { id: 'node1', type: 'test', position: [0, 0] },
                    { id: 'node2', type: 'test', position: [0, 0] },
                    { id: 'node3', type: 'test', position: [0, 0] }
                ]
            };
            
            await expect(excelService.exportWorkflow(manyNodesWorkflow))
                .rejects
                .toThrow(/Workflow contains too many nodes/);
        });
        
        it('should handle nodes with missing position data', async () => {
            const badNodeWorkflow = {
                ...mockWorkflow,
                nodes: [
                    { id: 'bad-node', name: 'Bad Node', type: 'trigger' }
                    // Missing position
                ]
            };
            
            const buffer = await excelService.exportWorkflow(badNodeWorkflow);
            expect(buffer).toBeDefined();
            expect(buffer).toBeInstanceOf(Buffer);
        });
    });
}); 