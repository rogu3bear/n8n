module.exports = {
  app: {
    getPath: jest.fn().mockImplementation((name) => {
      if (name === 'userData') return '/mock/user/data/path';
      if (name === 'logs') return '/mock/logs/path';
      return '/mock/path';
    }),
    getName: jest.fn().mockReturnValue('n8n-electron-wrapper'),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
    quit: jest.fn(),
    whenReady: jest.fn().mockResolvedValue(undefined)
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn().mockResolvedValue(undefined),
    loadFile: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn()
    }
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  safeStorage: {
    encryptString: jest.fn().mockImplementation((str) => Buffer.from(str)),
    decryptString: jest.fn().mockImplementation((buf) => buf.toString())
  },
  shell: {
    openExternal: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn()
  }
}; 