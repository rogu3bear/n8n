import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
import fs from 'fs';

// Define paths for later use
const ROOT_DIR = __dirname;
const SRC_DIR = resolve(ROOT_DIR, 'src');
const SERVICES_DIR = resolve(SRC_DIR, 'services');
const DIST_MAIN_DIR = resolve(ROOT_DIR, 'dist/main');
const DIST_SERVICES_DIR = resolve(DIST_MAIN_DIR, 'services');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    electron([
      {
        // Main process entry point
        entry: 'src/core/main.js',
        vite: {
          build: {
            outDir: 'dist/main',
            sourcemap: true,
            rollupOptions: {
              external: ['electron', 'electron-log', 'exceljs']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist/renderer',
    sourcemap: true,
    rollupOptions: {
      input: {
        renderer: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@services': resolve(__dirname, 'src/services')
    }
  },
  server: {
    port: 5678,
    strictPort: true,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
    }
  }
});

// Copy services directory to dist
const copyServices = () => {
  try {
    if (!fs.existsSync(SERVICES_DIR)) {
      fs.mkdirSync(SERVICES_DIR, { recursive: true });
      console.log(`Created services directory at: ${SERVICES_DIR}`);
    }

    if (!fs.existsSync(DIST_SERVICES_DIR)) {
      fs.mkdirSync(DIST_SERVICES_DIR, { recursive: true });
      console.log(`Created dist services directory at: ${DIST_SERVICES_DIR}`);
    }
    
    const files = fs.readdirSync(SERVICES_DIR);
    if (files.length === 0) {
      console.log('No files found in services directory, creating placeholder');
      // Create a placeholder excelService.js if none exists
      const excelServicePath = resolve(SERVICES_DIR, 'excelService.js');
      const excelServiceContent = `const ExcelJS = require('exceljs');
const log = require('electron-log');

class ExcelService {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
    log.info('ExcelService initialized');
  }

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

  async loadWorkbook(filePath) {
    try {
      await this.workbook.xlsx.readFile(filePath);
      log.info(\`Loaded workbook from \${filePath}\`);
      return true;
    } catch (error) {
      log.error(\`Error loading workbook from \${filePath}:\`, error);
      throw error;
    }
  }

  async saveWorkbook(filePath) {
    try {
      await this.workbook.xlsx.writeFile(filePath);
      log.info(\`Saved workbook to \${filePath}\`);
      return true;
    } catch (error) {
      log.error(\`Error saving workbook to \${filePath}:\`, error);
      throw error;
    }
  }

  addWorksheet(name) {
    try {
      const worksheet = this.workbook.addWorksheet(name);
      log.info(\`Added worksheet: \${name}\`);
      return worksheet;
    } catch (error) {
      log.error(\`Error adding worksheet \${name}:\`, error);
      throw error;
    }
  }

  getWorksheet(name) {
    try {
      const worksheet = this.workbook.getWorksheet(name);
      if (!worksheet) {
        throw new Error(\`Worksheet \${name} not found\`);
      }
      return worksheet;
    } catch (error) {
      log.error(\`Error getting worksheet \${name}:\`, error);
      throw error;
    }
  }
}

const excelService = new ExcelService();
module.exports = { excelService };`;
      fs.writeFileSync(excelServicePath, excelServiceContent);
      console.log(`Created excelService.js at ${excelServicePath}`);
    }
    
    fs.readdirSync(SERVICES_DIR).forEach(file => {
      const srcFile = resolve(SERVICES_DIR, file);
      const distFile = resolve(DIST_SERVICES_DIR, file);
      fs.copyFileSync(srcFile, distFile);
      console.log(`Copied ${srcFile} to ${distFile}`);
    });
    
    console.log('Services directory copied successfully');
    return true;
  } catch (error) {
    console.error('Error copying services directory:', error);
    return false;
  }
};

copyServices(); 