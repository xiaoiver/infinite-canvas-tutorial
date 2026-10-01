# React framework starters

These independent projects target the first `@infinite-canvas-tutorial/react`
0.1.0 npm release. The package has not been published yet; registry installation
will become available after that release. They are outside the pnpm workspace
so library and documentation builds do not build example applications.

After publication, copy either directory into your own project and run:

```sh
npm install
npm run dev
```

-   **react-vite** uses React StrictMode, a scoped Provider, initial nodes, and hooks.
-   **react-nextjs** uses a Server Component page with a Client Component editor.
    The wrapper renders a loading fallback during SSR and acquires the browser
    runtime on mount. No `dynamic({ ssr: false })` is required. Use Node.js 20.9+.

Both examples start with one rectangle and an empty history. **Enlarge rectangle**
commits an edit; **Undo** restores its original width without removing it. The
shape counter uses `useCanvasSelector` and updates after initialization.
The built-in toolbars are hidden so the examples use their own React controls.

## Verify unreleased changes

From the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter '@infinite-canvas-tutorial/react...' build
pnpm test:react:package
```

The package check packs the actual workspace libraries, rewrites their workspace
dependencies, and builds these starters in an isolated temporary consumer. It
checks Vite on React 18/19 and Next.js on React 19, matching Next.js's peer range.
It also verifies both public package entries, CommonJS/ESM SSR, and TypeScript
resolution. Nothing is published to npm by these commands.

Set `REACT_PACKAGE_KEEP_ARTIFACTS=1` when running the package check to retain the
temporary consumer. In the printed `examples/react-vite` directory, run
`npm run preview`; in `examples/react-nextjs`, run `npm start` to inspect the
production builds in a browser without publishing the package first.

For a local canvas while developing the library, run `pnpm dev:react-tests` and
open the printed URL. The richer bilingual playground is available in the
[React documentation](https://infinitecanvas.cc/reference/react).
