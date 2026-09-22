# Browser lifecycle regression

Run from the repository root after installing the workspace dependencies:

```sh
pnpm exec playwright install chromium
pnpm test:tooling
pnpm exec tsc -p __tests__/browser/tsconfig.json
pnpm test:browser
```

Playwright starts the isolated Vite fixture on `127.0.0.1:4175`. To inspect it
manually, run `pnpm dev:browser-tests`. The fixture imports workspace source and
uses the site's existing WebAssembly and collaboration dependencies; package
builds, authentication, and environment secrets are not required.

The five browser tests cover:

-   Two canvases in one ECS world, including rendered pixel checks and independent undo/redo.
-   Repeated destruction and recreation, queued task cancellation, and release of native WebGL resources and global input listeners.
-   Lazy creation of a real browser worker, termination, rejection of active and queued operations, and isolation from another canvas's worker.
-   Yjs collaboration across browser pages, including undo/redo, deletion, and a late participant.
-   The same collaboration scenarios using Loro.

The probes wrap native resource creation and deletion without replacing the
renderer. Chromium uses software WebGL for reproducibility. The worker runs a
small deterministic protocol fixture through the production `WorkerClient`;
these tests do not download models or cover inference, WebGPU, other browsers,
or a production collaboration server.

CI runs these checks in `.github/workflows/browser-regression.yml` and uploads
failure screenshots and traces from `.test-results/browser`. The existing ECS
suite remains a separate regression check.

## Commit checks

`pnpm test:tooling` verifies that ESLint actually checks TypeScript, TSX, and Vue,
understands their runtime globals, and excludes generated and vendored files.
The application in `packages/app` retains its own ESLint configuration. Running
`pnpm lint` audits the remaining repository, including historical violations;
the commit hook checks changed files.

Normal commits check every staged matching file. During a merge, the hook checks
staged files that differ from the incoming `MERGE_HEAD`, including conflict
resolutions and additional staged edits. Unmodified incoming files are
excluded, so merging upstream does not rewrite unrelated files. A temporary Git
repository regression test exercises both modes, including paths with spaces.

Markdown processing runs sequentially: case corrections, Prettier, then
MarkdownLint. Prettier owns list numbering and spacing (`MD029` and `MD030` are
disabled), avoiding conflicts with the repository's four-space Markdown indent.
Nested lists use the same four-space indent in MarkdownLint (`MD007`).
