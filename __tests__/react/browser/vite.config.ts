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
  resolve: {
    alias: {
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
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  server: { host: '127.0.0.1', port: 4177, strictPort: true },
});
