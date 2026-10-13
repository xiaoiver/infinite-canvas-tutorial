import { defineConfig } from 'vite';

export default defineConfig({
  // Keep the lazy WASM URL relative to the package during development.
  optimizeDeps: { exclude: ['@infinite-canvas-tutorial/device-api'] },
  esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ['react', 'react-dom'] },
});
