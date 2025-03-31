// Mock the logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../utils/logger', () => ({
  logger: mockLogger
}));

// Make mockLogger available globally for tests
global.mockLogger = mockLogger; 