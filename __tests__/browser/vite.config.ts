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
  plugins: [
    wasm(),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag: string) => tag.startsWith('ic-'),
        },
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['loro-crdt'],
    esbuildOptions: { target: 'esnext' },
  },
  root: fileURLToPath(new URL('./fixtures', import.meta.url)),
  resolve: {
    alias: {
      // The lasso fixture mounts the documentation's real shared example world.
      // Resolve its plugins from source so CI needs no generated esm/lib folders.
      ...Object.fromEntries(
        [
          ['webcomponents/spectrum', 'webcomponents/src/spectrum/index.ts'],
          ['webcomponents', 'webcomponents/src/index.ts'],
          ['eraser/spectrum', 'plugin-eraser/src/spectrum/index.ts'],
          ['eraser', 'plugin-eraser/src/index.ts'],
          [
            'laser-pointer/spectrum',
            'plugin-laser-pointer/src/spectrum/index.ts',
          ],
          ['laser-pointer', 'plugin-laser-pointer/src/index.ts'],
          ['filter', 'plugin-filter/src/index.ts'],
          ['yoga', 'plugin-yoga/src/index.ts'],
          ['vello', 'plugin-vello/src/index.ts'],
          ['figma', 'plugin-figma/src/index.ts'],
          ['mermaid', 'plugin-mermaid/src/index.ts'],
        ].map(([name, path]) => [
          `@infinite-canvas-tutorial/${name}`,
          fileURLToPath(new URL(`../../packages/${path}`, import.meta.url)),
        ]),
      ),
      '@infinite-canvas-tutorial/lasso/spectrum': fileURLToPath(
        new URL(
          '../../packages/plugin-lasso/src/spectrum/index.ts',
          import.meta.url,
        ),
      ),
      '@infinite-canvas-tutorial/lasso': fileURLToPath(
        new URL('../../packages/plugin-lasso/src/index.ts', import.meta.url),
      ),
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
