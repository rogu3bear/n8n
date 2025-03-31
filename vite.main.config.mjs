import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.vite/build',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'keytar', 'sqlite3', 'mysql2', 'protobufjs', 'xml2js', 'jszip', 'exceljs'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}); 