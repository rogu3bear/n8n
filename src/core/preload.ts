import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'check-docker',
      'check-docker-running',
      'get-docker-version',
      'get-docker-installation-guide',
      'get-cli-installation-instructions',
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },
  openExternal: (url: string) => {
    return ipcRenderer.invoke('open-external', url);
  },
}); 