const ExcelJS = require('exceljs');
const log = require('electron-log');

/**
 * Service for Excel file operations
 */
class ExcelService {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
    log.info('ExcelService initialized');
  }

  /**
   * Create a new workbook
   * @returns {Promise<boolean>} Success indicator
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
   * Load an Excel file
   * @param {string} filePath - Path to the Excel file
   * @returns {Promise<boolean>} Success indicator
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
   * @param {string} filePath - Path to save the Excel file
   * @returns {Promise<boolean>} Success indicator
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
   * @param {string} name - Name of the worksheet
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
   * @param {string} name - Name of the worksheet
   * @returns {ExcelJS.Worksheet} The worksheet
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

const excelService = new ExcelService();
module.exports = { excelService }; 