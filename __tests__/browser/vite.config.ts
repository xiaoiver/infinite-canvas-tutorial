import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import wasm from '../../packages/site/node_modules/vite-plugin-wasm';

export default defineConfig({
  // Keep source-based browser tests separate from the compiled React fixture.
  cacheDir: fileURLToPath(
    new URL('../../node_modules/.vite/browser-tests', import.meta.url),
  ),
  plugins: [wasm()],
  optimizeDeps: {
    exclude: ['loro-crdt'],
    esbuildOptions: { target: 'esnext' },
  },
  root: fileURLToPath(new URL('./fixtures', import.meta.url)),
  resolve: {
    alias: {
      yjs: fileURLToPath(
        new URL(
          '../../packages/site/node_modules/yjs/dist/yjs.mjs',
          import.meta.url,
        ),
      ),
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
