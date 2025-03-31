const ExcelJS = require('exceljs');
const log = require('electron-log');

class ExcelService {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
  }

  /**
   * Create a new workbook
   * @returns {ExcelJS.Workbook} The created workbook
   */
  createWorkbook() {
    this.workbook = new ExcelJS.Workbook();
    return this.workbook;
  }

  /**
   * Load an existing Excel file
   * @param {string} filePath Path to the Excel file
   * @returns {Promise<ExcelJS.Workbook>} The loaded workbook
   */
  async loadWorkbook(filePath) {
    try {
      this.workbook = await this.workbook.xlsx.readFile(filePath);
      return this.workbook;
    } catch (error) {
      log.error('Error loading Excel file:', error);
      throw error;
    }
  }

  /**
   * Save the workbook to a file
   * @param {string} filePath Path where to save the Excel file
   * @returns {Promise<void>}
   */
  async saveWorkbook(filePath) {
    try {
      await this.workbook.xlsx.writeFile(filePath);
    } catch (error) {
      log.error('Error saving Excel file:', error);
      throw error;
    }
  }

  /**
   * Add a worksheet to the workbook
   * @param {string} name Name of the worksheet
   * @returns {ExcelJS.Worksheet} The created worksheet
   */
  addWorksheet(name) {
    return this.workbook.addWorksheet(name);
  }

  /**
   * Get a worksheet by name
   * @param {string} name Name of the worksheet
   * @returns {ExcelJS.Worksheet|undefined} The worksheet if found
   */
  getWorksheet(name) {
    return this.workbook.getWorksheet(name);
  }
}

// Create a singleton instance
const excelService = new ExcelService();

module.exports = {
  excelService
}; 