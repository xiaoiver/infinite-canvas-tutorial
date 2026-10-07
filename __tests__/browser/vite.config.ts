import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import wasm from '../../packages/site/node_modules/vite-plugin-wasm';

// Reuse VitePress's Vue compiler to exercise the actual documentation component.
const siteRequire = createRequire(
  fileURLToPath(new URL('../../packages/site/package.json', import.meta.url)),
);
const vue = createRequire(siteRequire.resolve('vitepress'))(
  '@vitejs/plugin-vue',
);

export default defineConfig({
  // Keep source-based browser tests separate from the compiled React fixture.
  cacheDir: fileURLToPath(
    new URL('../../node_modules/.vite/browser-tests', import.meta.url),
  ),
  plugins: [wasm(), vue()],
  optimizeDeps: {
    exclude: ['loro-crdt'],
    esbuildOptions: { target: 'esnext' },
  },
  root: fileURLToPath(new URL('./fixtures', import.meta.url)),
  resolve: {
    alias: {
      '@infinite-canvas-tutorial/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
      vue: fileURLToPath(
        new URL(
          '../../packages/site/node_modules/vue/dist/vue.runtime.esm-bundler.js',
          import.meta.url,
        ),
      ),
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
