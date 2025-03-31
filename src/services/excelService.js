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
  async createWorkbook() {
    try {
      this.workbook = new ExcelJS.Workbook();
      log.info('Created new workbook');
      return true;
    } catch (error) {
      log.error('Error creating workbook:', error);
      throw error;
    }
  }

  /**
   * Load an existing Excel file
   * @param {string} filePath Path to the Excel file
   * @returns {Promise<ExcelJS.Workbook>} The loaded workbook
   */
  async loadWorkbook(filePath) {
    try {
      await this.workbook.xlsx.readFile(filePath);
      log.info(`Loaded workbook from ${filePath}`);
      return true;
    } catch (error) {
      log.error(`Error loading workbook from ${filePath}:`, error);
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
      log.info(`Saved workbook to ${filePath}`);
      return true;
    } catch (error) {
      log.error(`Error saving workbook to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Add a worksheet to the workbook
   * @param {string} name Name of the worksheet
   * @returns {ExcelJS.Worksheet} The created worksheet
   */
  addWorksheet(name) {
    try {
      const worksheet = this.workbook.addWorksheet(name);
      log.info(`Added worksheet: ${name}`);
      return worksheet;
    } catch (error) {
      log.error(`Error adding worksheet ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a worksheet by name
   * @param {string} name Name of the worksheet
   * @returns {ExcelJS.Worksheet|undefined} The worksheet if found
   */
  getWorksheet(name) {
    try {
      const worksheet = this.workbook.getWorksheet(name);
      if (!worksheet) {
        throw new Error(`Worksheet ${name} not found`);
      }
      return worksheet;
    } catch (error) {
      log.error(`Error getting worksheet ${name}:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
const excelService = new ExcelService();

module.exports = {
  excelService
}; 