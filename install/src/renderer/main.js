// Renderer process main.js
import { createApp } from 'vue';
import App from './App.vue';

// Create and mount the Vue app
const app = createApp(App);
app.mount('#app');

// Handle IPC messages from main process
window.electron.on('message', (message) => {
  console.log('Received message from main process:', message);
});

// Expose electron APIs to window
window.electron = {
  ipcRenderer: {
    send: (channel, data) => {
      // Implementation will be added later
    },
    on: (channel, func) => {
      // Implementation will be added later
    }
  }
}; 