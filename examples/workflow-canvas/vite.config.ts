import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import wasm from '../../packages/site/node_modules/vite-plugin-wasm';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: '../../node_modules/.vite/workflow-canvas',
  plugins: [wasm()],
  resolve: {
    alias: Object.fromEntries(
      ['ecs', 'device-api'].map((name) => [
        `@infinite-canvas-tutorial/${name}`,
        fileURLToPath(
          new URL(`../../packages/${name}/src/index.ts`, import.meta.url),
        ),
      ]),
    ),
  },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  build: { target: 'esnext', outDir: 'dist' },
  server: { host: '127.0.0.1', port: 4180, strictPort: true },
});
