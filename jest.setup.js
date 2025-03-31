// Set timeout
jest.setTimeout(30000);

// Mock console methods
console.log = jest.fn();
console.warn = jest.fn();
console.info = jest.fn();
console.debug = jest.fn();
// Keep console.error for debugging
console.error = console.error;

// Set environment variables
process.env.MAX_WORKFLOW_SIZE = '10485760'; // 10MB
process.env.MAX_NODES = '1000';

// Mock fetch API
global.fetch = jest.fn();
global.Response = jest.fn();
global.Headers = jest.fn();

// Mock URL
global.URL = jest.fn().mockImplementation((url) => ({
  href: url,
  origin: 'http://localhost',
  protocol: 'http:',
  host: 'localhost',
  hostname: 'localhost',
  port: '',
  pathname: '/',
  search: '',
  hash: ''
}));

// Mock Electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path'),
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    webContents: {
      on: jest.fn(),
      send: jest.fn()
    }
  })),
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
  }
}));

// Mock fs promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn()
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn(),
  resolve: jest.fn(),
  dirname: jest.fn()
}));

// Mock os
jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/mock/home'),
  platform: jest.fn().mockReturnValue('darwin'),
  arch: jest.fn().mockReturnValue('x64')
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn()
}));

// Use fake timers
jest.useFakeTimers();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
}); 