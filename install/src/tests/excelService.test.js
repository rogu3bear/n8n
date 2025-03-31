const { excelService } = require('../services/excelService');

describe('ExcelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createWorkbook creates a new workbook', async () => {
    const result = await excelService.createWorkbook();
    expect(result).toBe(true);
  });

  test('addWorksheet adds a new worksheet', () => {
    const worksheet = excelService.addWorksheet('Test Sheet');
    expect(worksheet).toBeDefined();
  });

  test('getWorksheet retrieves a worksheet', () => {
    // First add a worksheet
    excelService.addWorksheet('Test Sheet');
    
    // Then retrieve it
    const worksheet = excelService.getWorksheet('Test Sheet');
    expect(worksheet).toBeDefined();
  });
}); 