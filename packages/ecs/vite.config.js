import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Keep the lazy WASM URL relative to the package during development.
  optimizeDeps: { exclude: ['@infinite-canvas-tutorial/device-api'] },
  root: path.resolve('./examples'),
  server: { port: 8080, open: '/' },
});
