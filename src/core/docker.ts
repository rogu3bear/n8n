import { exec } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';

const execAsync = promisify(exec);

export async function checkDockerInstallation(): Promise<boolean> {
  try {
    // Try to run docker --version
    await execAsync('docker --version');
    return true;
  } catch (error) {
    console.error('Docker is not installed:', error);
    return false;
  }
}

export async function checkDockerRunning(): Promise<boolean> {
  try {
    // Try to run docker info
    await execAsync('docker info');
    return true;
  } catch (error) {
    console.error('Docker is not running:', error);
    return false;
  }
}

export async function getDockerVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('docker --version');
    return stdout.trim();
  } catch (error) {
    console.error('Error getting Docker version:', error);
    return null;
  }
}

export function getDockerInstallationGuide(): string {
  const platform = process.platform;
  switch (platform) {
    case 'darwin':
      return 'https://docs.docker.com/desktop/install/mac-install/';
    case 'win32':
      return 'https://docs.docker.com/desktop/install/windows-install/';
    case 'linux':
      return 'https://docs.docker.com/engine/install/';
    default:
      return 'https://docs.docker.com/get-docker/';
  }
}

export function getCLIInstallationInstructions(): string {
  const platform = process.platform;
  switch (platform) {
    case 'darwin':
      return `
1. Install Homebrew if not already installed:
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. Install Docker CLI:
   brew install docker

3. Start Docker service:
   brew services start docker
      `;
    case 'linux':
      return `
1. Update package index:
   sudo apt-get update

2. Install prerequisites:
   sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common

3. Add Docker's official GPG key:
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

4. Add Docker repository:
   sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

5. Install Docker:
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io

6. Add your user to the docker group:
   sudo usermod -aG docker $USER
      `;
    default:
      return 'Please visit https://docs.docker.com/get-docker/ for installation instructions.';
  }
} 