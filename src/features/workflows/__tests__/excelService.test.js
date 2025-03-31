const ExcelJS = require('exceljs');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Dynamically import excelService *after* mocks are set up
let excelService;

// --- Mocks ---
// Mock the core logger functions
jest.mock('../../../core/services/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Define explicit mock functions outside the jest.mock scope
// so we can reference them directly in tests.
const mockAddRow = jest.fn();
const mockReadFile = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockAddWorksheet = jest.fn(() => mockWorksheet); 
const mockGetWorksheet = jest.fn(() => mockWorksheet); 
const mockWorksheet = { addRow: mockAddRow }; // Keep this simple for now

// Mock the actual exceljs library methods used by the service
jest.mock('exceljs', () => {
  // Inside the mock factory, return the structure using the pre-defined mocks
  const mockWorkbook = {
    addWorksheet: mockAddWorksheet,
    getWorksheet: mockGetWorksheet,
    xlsx: {
      readFile: mockReadFile,
      writeFile: mockWriteFile,
    },
  };
  return {
    Workbook: jest.fn().mockImplementation(() => mockWorkbook),
  };
});

// Mock fs for file operations if needed by tests (e.g., checking existence)
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true), // Assume files exist for tests
  promises: {
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue(Buffer.from('mock excel data')),
      unlink: jest.fn().mockResolvedValue(undefined),
  }
}));

// --- Tests ---
describe('ExcelService', () => {
  let tempFilePath;

  beforeEach(() => {
    jest.clearAllMocks();
    // IMPORTANT: Dynamically require excelService here to get the instance with mocks applied
    excelService = require('../excelService').excelService;
    tempFilePath = path.join(os.tmpdir(), `test-${Date.now()}.xlsx`);
    // No need to reset excelService.workbook manually, 
    // the require call above should give a fresh instance using the mocked constructor
  });

  afterEach(async () => {
    // Clean up temporary files if they were created
    try {
        if (fs.existsSync(tempFilePath)) {
            await fs.promises.unlink(tempFilePath);
        }
    } catch (err) { /* ignore cleanup errors */ }
  });

  it('should create a new workbook instance on createWorkbook', async () => {
    await excelService.createWorkbook();
    // Constructor called once on initial module load (beforeEach) + once in createWorkbook
    expect(ExcelJS.Workbook).toHaveBeenCalledTimes(2); 
  });

  it('should call the mockReadFile function on loadWorkbook', async () => {
    await excelService.loadWorkbook(tempFilePath);
    expect(mockReadFile).toHaveBeenCalledWith(tempFilePath);
  });

  it('should throw error if loadWorkbook (mockReadFile) fails', async () => {
    const loadError = new Error('Failed to read file');
    mockReadFile.mockRejectedValueOnce(loadError);
    // Now test the instance obtained in beforeEach
    await expect(excelService.loadWorkbook(tempFilePath)).rejects.toThrow(loadError);
  });

  it('should call the mockWriteFile function on saveWorkbook', async () => {
    await excelService.saveWorkbook(tempFilePath);
    expect(mockWriteFile).toHaveBeenCalledWith(tempFilePath);
  });

  it('should throw error if saveWorkbook (mockWriteFile) fails', async () => {
    const saveError = new Error('Failed to write file');
    mockWriteFile.mockRejectedValueOnce(saveError);
    await expect(excelService.saveWorkbook(tempFilePath)).rejects.toThrow(saveError);
  });

  it('should call the mockAddWorksheet function on addWorksheet', () => {
    const sheetName = 'MySheet';
    const worksheet = excelService.addWorksheet(sheetName);
    expect(mockAddWorksheet).toHaveBeenCalledWith(sheetName);
    expect(worksheet).toBeDefined();
  });

  it('should throw error if addWorksheet (mockAddWorksheet) fails', () => {
    const addError = new Error('Worksheet exists');
    mockAddWorksheet.mockImplementationOnce(() => { throw addError; });
    expect(() => excelService.addWorksheet('DuplicateSheet')).toThrow(addError);
  });

  it('should call the mockGetWorksheet function on getWorksheet', () => {
    const sheetName = 'ExistingSheet';
    mockGetWorksheet.mockReturnValueOnce({ name: sheetName });
    const worksheet = excelService.getWorksheet(sheetName);
    expect(mockGetWorksheet).toHaveBeenCalledWith(sheetName);
    expect(worksheet).toBeDefined();
  });

  it('should throw error if getWorksheet (mockGetWorksheet) does not find the sheet', () => {
    const sheetName = 'MissingSheet';
    mockGetWorksheet.mockReturnValueOnce(undefined);
    expect(() => excelService.getWorksheet(sheetName)).toThrow(`Worksheet ${sheetName} not found`);
  });
}); 