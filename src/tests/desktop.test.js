const { app } = require('electron');
const path = require('path');
const fs = require('fs');

describe('Desktop App Tests', () => {
  beforeAll(() => {
    // Ensure we're in the correct environment
    process.env.NODE_ENV = 'test';
  });

  test('app should be defined', () => {
    expect(app).toBeDefined();
  });

  test('app should have required methods', () => {
    expect(typeof app.getVersion).toBe('function');
    expect(typeof app.getPath).toBe('function');
    expect(typeof app.quit).toBe('function');
  });

  test('config directory should be accessible', () => {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'n8n-config');
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.statSync(configPath).isDirectory()).toBe(true);
  });

  test('app should have correct version format', () => {
    const version = app.getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
}); 