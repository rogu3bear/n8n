const { excelService } = require('../../services/excelService');
const { logger } = require('../../utils/logger');

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock tmp module
jest.mock('tmp', () => ({
    fileSync: jest.fn().mockReturnValue({ name: '/tmp/test.xlsx' }),
    dirSync: jest.fn().mockReturnValue({ name: '/tmp' })
}));

// Mock ExcelJS
jest.mock('exceljs', () => {
    const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnThis(),
        getWorksheet: jest.fn().mockReturnThis(),
        xlsx: {
            writeBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
            load: jest.fn().mockResolvedValue(undefined)
        }
    };

    const mockWorksheet = {
        columns: [],
        addRow: jest.fn().mockReturnThis(),
        getRow: jest.fn().mockReturnThis(),
        eachRow: jest.fn().mockImplementation((callback) => {
            callback({ getCell: jest.fn().mockReturnValue({ value: 'test' }) }, 2);
        })
    };

    mockWorkbook.addWorksheet.mockReturnValue(mockWorksheet);
    mockWorkbook.getWorksheet.mockReturnValue(mockWorksheet);

    return {
        Workbook: jest.fn().mockReturnValue(mockWorkbook)
    };
});

describe('ExcelService Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exportWorkflow', () => {
        it('should export a valid workflow to Excel', async () => {
            const workflow = {
                name: 'Test Workflow',
                id: 'test-1',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes: [],
                connections: []
            };

            const result = await excelService.exportWorkflow(workflow);
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should handle empty workflows', async () => {
            const workflow = {
                name: 'Empty Workflow',
                id: 'empty-1',
                active: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes: [],
                connections: []
            };

            const result = await excelService.exportWorkflow(workflow);
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should handle workflows with complex node data', async () => {
            const workflow = {
                name: 'Complex Workflow',
                id: 'complex-1',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: 'trigger',
                        position: [0, 0]
                    }
                ],
                connections: [
                    {
                        from: 'node-1',
                        to: 'node-2',
                        type: 'main'
                    }
                ]
            };

            const result = await excelService.exportWorkflow(workflow);
            expect(result).toBeInstanceOf(Buffer);
        });
    });

    describe('importWorkflow', () => {
        it('should import a valid Excel file', async () => {
            const fileBuffer = Buffer.from('test');
            const result = await excelService.importWorkflow(fileBuffer);
            expect(result).toBeDefined();
            expect(result.name).toBe('test');
            expect(result.id).toBe('test');
            expect(result.active).toBe(true);
            expect(result.nodes).toBeDefined();
            expect(result.connections).toBeDefined();
        });

        it('should handle malformed Excel files', async () => {
            const fileBuffer = Buffer.from('invalid');
            await expect(excelService.importWorkflow(fileBuffer))
                .rejects
                .toThrow();
        });
    });

    describe('Excel Format Validation', () => {
        it('should validate worksheet structure', async () => {
            const fileBuffer = Buffer.from('test');
            const result = await excelService.importWorkflow(fileBuffer);
            expect(result).toBeDefined();
            expect(result.nodes).toBeDefined();
            expect(result.connections).toBeDefined();
        });

        it('should validate column headers', async () => {
            const fileBuffer = Buffer.from('test');
            const result = await excelService.importWorkflow(fileBuffer);
            expect(result).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.active).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle large workflows', async () => {
            const largeWorkflow = {
                name: 'Large Workflow',
                id: 'large-1',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes: Array(1000).fill().map((_, i) => ({
                    id: `node-${i}`,
                    name: `Node ${i}`,
                    type: 'trigger',
                    position: [i, i]
                })),
                connections: []
            };

            const result = await excelService.exportWorkflow(largeWorkflow);
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should handle concurrent operations', async () => {
            const workflow = {
                name: 'Test Workflow',
                id: 'test-1',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes: [],
                connections: []
            };

            const operations = Array(5).fill().map(() => excelService.exportWorkflow(workflow));
            const results = await Promise.all(operations);
            results.forEach(result => expect(result).toBeInstanceOf(Buffer));
        });
    });
}); 