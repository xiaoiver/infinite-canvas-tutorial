import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const reactModules =
  process.env.REACT_TEST_MODULES ||
  fileURLToPath(
    new URL('../../../packages/react/node_modules', import.meta.url),
  );

export default defineConfig({
  logLevel: 'error',
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: fileURLToPath(
    new URL('../../../node_modules/.vite/react-tests', import.meta.url),
  ),
  resolve: {
    alias: {
      // Optimized chunks cannot use the original package's pnpm dependency links.
      '@infinite-canvas-tutorial/device-api': fileURLToPath(
        new URL('../../../packages/device-api/esm/index.js', import.meta.url),
      ),
      '@infinite-canvas-tutorial/webcomponents/events': fileURLToPath(
        new URL(
          '../../../packages/webcomponents/esm/event.js',
          import.meta.url,
        ),
      ),
      '@infinite-canvas-tutorial/webcomponents/spectrum': fileURLToPath(
        new URL(
          '../../../packages/webcomponents/esm/spectrum/index.js',
          import.meta.url,
        ),
      ),
      '@infinite-canvas-tutorial/webcomponents': fileURLToPath(
        new URL(
          '../../../packages/webcomponents/esm/index.js',
          import.meta.url,
        ),
      ),
      '@infinite-canvas-tutorial/react': fileURLToPath(
        new URL('../../../packages/react/esm/index.js', import.meta.url),
      ),
      '@infinite-canvas-tutorial/ecs': fileURLToPath(
        new URL('../../../packages/ecs/esm/index.js', import.meta.url),
      ),
      react: resolve(reactModules, 'react'),
      'react-dom': resolve(reactModules, 'react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  optimizeDeps: {
    // Linked package rebuilds do not invalidate Vite's dependency cache.
    force: true,
    // Scan the excluded renderer too: its dependencies would otherwise be
    // discovered after startup and force a reload during the first test.
    entries: ['index.html', '../../../packages/device-api/esm/index.js'],
    // Keep each new page from requesting the built workspace modules one by one.
    include: [
      '@infinite-canvas-tutorial/react',
      '@infinite-canvas-tutorial/ecs',
      '@infinite-canvas-tutorial/webcomponents',
      '@infinite-canvas-tutorial/webcomponents/spectrum',
    ],
    // Preserve the original module URL for the lazy shader compiler WASM asset.
    exclude: ['@infinite-canvas-tutorial/device-api'],
    esbuildOptions: { target: 'esnext' },
  },
  server: { host: '127.0.0.1', port: 4177, strictPort: true },
});
