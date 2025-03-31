// Mock Electron's app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(),
  },
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
})); 