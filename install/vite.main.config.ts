import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/main',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'src/core/main.js') },
      external: ['electron', 'electron-log', 'keytar'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/core'),
    },
  },
}); 