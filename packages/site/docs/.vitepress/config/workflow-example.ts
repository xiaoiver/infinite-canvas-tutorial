import { build, createServer, type Plugin } from 'vite';
import { resolve } from 'node:path';

const configFile = resolve(
  __dirname,
  '../../../../../examples/workflow-canvas/vite.config.ts',
);

/** Keep the standalone app in its own document, module graph and CSS scope. */
export function workflowExample(): Plugin {
  return {
    name: 'docs-workflow-example',
    async configureServer(server) {
      const base = `${server.config.base}workflow-canvas/`;
      const example = await createServer({
        configFile,
        base,
        cacheDir: resolve(
          __dirname,
          '../../../../../node_modules/.vite/workflow-docs',
        ),
        server: { middlewareMode: true, hmr: false },
      });
      server.middlewares.use((request, response, next) => {
        if (request.url?.startsWith(base)) {
          example.middlewares(request, response, next);
        } else {
          next();
        }
      });
      server.httpServer?.once('close', () => {
        void example.close();
      });
    },
  };
}

/** Run after VitePress emits its site, so the app survives dist cleanup. */
export async function buildWorkflowExample(outDir: string) {
  await build({
    configFile,
    // Relative assets also work when docs are hosted below a base path.
    base: './',
    build: {
      outDir: resolve(outDir, 'workflow-canvas'),
      emptyOutDir: true,
    },
  });
}
