import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { exec } from 'child_process';
import {
  checkDockerInstallation,
  checkDockerRunning,
  getDockerVersion,
  getDockerInstallationGuide,
  getCLIInstallationInstructions
} from '../main/docker';

jest.mock('child_process');

describe('Docker Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDockerInstallation', () => {
    it('should return true when Docker is installed', async () => {
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'Docker version 20.10.8' });
      });
      const result = await checkDockerInstallation();
      expect(result).toBe(true);
    });

    it('should return false when Docker is not installed', async () => {
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('command not found: docker'));
      });
      const result = await checkDockerInstallation();
      expect(result).toBe(false);
    });
  });

  describe('checkDockerRunning', () => {
    it('should return true when Docker daemon is running', async () => {
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'Docker info output' });
      });
      const result = await checkDockerRunning();
      expect(result).toBe(true);
    });

    it('should return false when Docker daemon is not running', async () => {
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Cannot connect to the Docker daemon'));
      });
      const result = await checkDockerRunning();
      expect(result).toBe(false);
    });
  });

  describe('getDockerVersion', () => {
    it('should return Docker version when available', async () => {
      const version = 'Docker version 20.10.8';
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: version });
      });
      const result = await getDockerVersion();
      expect(result).toBe(version.trim());
    });

    it('should return null when Docker version command fails', async () => {
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('command not found: docker'));
      });
      const result = await getDockerVersion();
      expect(result).toBeNull();
    });
  });

  describe('getDockerInstallationGuide', () => {
    it('should return correct URL for macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const result = getDockerInstallationGuide();
      expect(result).toBe('https://docs.docker.com/desktop/install/mac-install/');
    });

    it('should return correct URL for Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const result = getDockerInstallationGuide();
      expect(result).toBe('https://docs.docker.com/desktop/install/windows-install/');
    });

    it('should return correct URL for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const result = getDockerInstallationGuide();
      expect(result).toBe('https://docs.docker.com/engine/install/');
    });
  });

  describe('getCLIInstallationInstructions', () => {
    it('should return Homebrew instructions for macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const result = getCLIInstallationInstructions();
      expect(result).toContain('brew install docker');
    });

    it('should return apt-get instructions for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const result = getCLIInstallationInstructions();
      expect(result).toContain('apt-get install');
    });

    it('should return default instructions for unsupported platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'unknown' });
      const result = getCLIInstallationInstructions();
      expect(result).toContain('https://docs.docker.com/get-docker/');
    });
  });
}); 