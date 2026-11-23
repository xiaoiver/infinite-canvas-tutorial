import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from './text-lod.vite.config';
export default defineConfig({
  ...base,
  cacheDir: fileURLToPath(
    new URL('../../node_modules/.vite/stroke-batching', import.meta.url),
  ),
  optimizeDeps: {
    entries: ['core-path-instances.html'],
    esbuildOptions: { target: 'esnext' },
  },
});
