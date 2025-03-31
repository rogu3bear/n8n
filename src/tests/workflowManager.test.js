const { workflowManager } = require('../core/workflowManager');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { excelService } = require('../features/workflows/excelService');

// Mock dependencies
jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// Mock excelService
jest.mock('../services/excelService', () => ({
  excelService: {
    createWorkbook: jest.fn().mockResolvedValue(true),
    addWorksheet: jest.fn().mockReturnValue({
      addRow: jest.fn()
    }),
    saveWorkbook: jest.fn().mockResolvedValue(true)
  }
}));

describe('WorkflowManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateWorkflowJson', () => {
    test('accepts valid workflow JSON', () => {
      const validWorkflow = {
        name: 'Test Workflow',
        nodes: [
          { id: 'node1', type: 'action', name: 'Action 1', parameters: { text: 'Hello' } }
        ],
        connections: {}
      };

      const result = workflowManager.validateWorkflowJson(JSON.stringify(validWorkflow));
      expect(result).toEqual(validWorkflow);
    });

    test('adds missing properties to incomplete workflow', () => {
      const incompleteWorkflow = {
        name: 'Incomplete Workflow'
        // Missing nodes and connections
      };

      const result = workflowManager.validateWorkflowJson(incompleteWorkflow);
      expect(result.name).toBe('Incomplete Workflow');
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result.connections).toBeDefined();
    });

    test('throws error for invalid JSON', () => {
      expect(() => {
        workflowManager.validateWorkflowJson('invalid-json');
      }).toThrow('Invalid workflow JSON');
    });
  });

  describe('executeCustomWorkflow', () => {
    test('executes a workflow and returns results', async () => {
      const workflow = {
        name: 'Test Execution',
        nodes: [
          { id: 'node1', type: 'action', name: 'Action 1', parameters: { text: 'Test' } }
        ],
        connections: {}
      };

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 123; // mock timer id
      });

      const result = await workflowManager.executeCustomWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('Workflow executed successfully');
      expect(result.resultPath).toBeDefined();
      
      // Verify Excel operations
      expect(excelService.createWorkbook).toHaveBeenCalled();
      expect(excelService.addWorksheet).toHaveBeenCalledWith('Workflow Details');
      expect(excelService.saveWorkbook).toHaveBeenCalled();
      
      // Verify file operations
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    test('handles errors during workflow execution', async () => {
      // Mock excelService to throw an error
      excelService.createWorkbook.mockRejectedValueOnce(new Error('Excel error'));

      await expect(workflowManager.executeCustomWorkflow({
        name: 'Error Workflow'
      })).rejects.toThrow('Excel error');
    });
  });
}); 