import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// A renderer-only fixture also runs with just root tooling and ECS dependencies.
export default defineConfig({
  root: fileURLToPath(new URL('./fixtures', import.meta.url)),
  cacheDir: fileURLToPath(
    new URL('../../node_modules/.vite/text-lod', import.meta.url),
  ),
  optimizeDeps: { entries: ['text-lod.html'] },
  resolve: {
    alias: {
      '@infinite-canvas-tutorial/ecs': fileURLToPath(
        new URL('../../packages/ecs/src/index.ts', import.meta.url),
      ),
      '@infinite-canvas-tutorial/device-api': fileURLToPath(
        new URL('../../packages/device-api/src/index.ts', import.meta.url),
      ),
    },
  },
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
});
