import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    electron([
      {
        // Main process entry point
        entry: 'src/core/main.js',
        vite: {
          build: {
            outDir: 'dist/main',
            sourcemap: true,
            rollupOptions: {
              external: ['electron', 'electron-log', 'exceljs']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist/renderer',
    sourcemap: true,
    rollupOptions: {
      input: {
        renderer: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@services': resolve(__dirname, 'src/services')
    }
  },
  server: {
    port: 5678,
    strictPort: true,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
    }
  }
});

// Copy services directory to dist
const copyServices = () => {
  const srcServices = resolve(__dirname, 'src/services');
  const distServices = resolve(__dirname, 'dist/main/services');
  
  if (!fs.existsSync(distServices)) {
    fs.mkdirSync(distServices, { recursive: true });
  }
  
  fs.readdirSync(srcServices).forEach(file => {
    const srcFile = resolve(srcServices, file);
    const distFile = resolve(distServices, file);
    fs.copyFileSync(srcFile, distFile);
  });
};

copyServices(); 