# Browser lifecycle regression

Run from the repository root after installing the workspace dependencies:

```sh
pnpm exec playwright install --with-deps chromium webkit
pnpm test:tooling
pnpm exec tsc -p __tests__/browser/tsconfig.json
pnpm test:browser
pnpm test:browser:webkit
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
these tests do not download models or cover inference, WebGPU, or a production
collaboration server.

Touch transformer tests use trusted Chromium touch events at phone viewport
sizes, different camera zooms, and DPR 3. They cover padded corner and edge
resizing, rotation, consecutive gestures, selection, and undo/redo. The separate
WebKit suite uses an iPhone profile and native touchscreen taps; drag tests use
DOM PointerEvents because Playwright does not expose native WebKit touch drags.
Physical iOS Safari still requires a device check.

Object-snapping regressions cover independent grid/object switches, one-pixel
movement and release, references off the grid, zoom-independent CSS-pixel
thresholds, equal spacing, hidden references, nested groups and rotated parents.
Resize checks exercise corners, edges, endpoints, multi-selection, aspect-ratio
and centered scaling, rotated handles, guide cleanup and undo/redo. The WebKit
suite also checks touch attraction/release and padded-corner object snapping.

Multi-selection rotation checks compare the rendered frame and all anchors with
the rotating shapes, including reversal, angle wrapping, a pinned pivot,
consecutive gestures, Escape and undo/redo. The WebKit suite also checks touch
rotation and the final frame after release.

Flip regressions cover all corner/edge handles, reversing across zero size,
aspect-ratio and centered constraints, rotated and previously mirrored shapes,
multi-selection, rotation after flipping, undo/redo and rendered gradient pixels.
Asymmetric path, polyline and vector-network checks catch double reflection; the
WebKit suite also checks flipping from a padded touch corner.

CI runs these checks in `.github/workflows/browser-regression.yml` and uploads
failure screenshots and traces from `.test-results/browser` and
`.test-results/webkit`. The existing ECS suite remains a separate regression
check.

Lesson 12 dash rendering checks run in Chromium and WebKit. They compare rendered
stroke interiors with native Canvas2D for all cap/join combinations, offsets,
closed paths and rectangles, sharp corners, zoom, short dashes, dots, independent
subpaths, alignment and solid strokes. Edge antialiasing kernels may differ, so
the comparison ignores partially covered pixels. Offset animation also checks
that geometry is not rebuilt. These fixtures use the independent lesson 12
renderer; they do not cover the core or ECS renderer's dashed strokes.

## React playground touch regression

The React suite mounts the production English and Chinese documentation
playgrounds. Build the React package and its workspace dependencies first:

```sh
pnpm --filter '@infinite-canvas-tutorial/react...' build
pnpm exec playwright install --with-deps chromium webkit
pnpm test:react:browser
pnpm test:react:browser:webkit
```

Both browsers use native taps to select shapes and activate undo/redo. Chromium
uses trusted touch drags; WebKit uses DOM touch PointerEvents for resizing.
Assertions cover geometry, the React inspector, history, and isolation from the
second canvas. These are interaction checks, not a physical iOS or WebKit visual
rendering check. The React 18/19 CI matrix runs both browsers and uploads failure
traces and screenshots from `.test-results/react` and `.test-results/react-webkit`.

Drawing preference checks in `__tests__/react/browser/drawing-preferences.spec.ts`
mount the real settings controls with two React canvases. They cover history and
redo preservation, uncommitted document changes, validation and recovery,
canvas/tool isolation, legacy and layered paint, and actual rectangle/pencil
creation. The React 18/19 matrix runs these checks in Chromium and WebKit.

## Commit checks

`pnpm test:tooling` verifies that ESLint actually checks TypeScript, TSX, and Vue,
understands their runtime globals, and excludes generated, cached, and vendored
files. The application in `packages/app` retains its own ESLint configuration.
`pnpm lint` checks the remaining repository with zero warnings allowed; CI runs
the same command, while the commit hook checks changed files.

Normal commits check every staged matching file. During a merge, the hook checks
staged files that differ from the incoming `MERGE_HEAD`, including conflict
resolutions and additional staged edits. Unmodified incoming files are
excluded, so merging upstream does not rewrite unrelated files. A temporary Git
repository regression test exercises both modes, including paths with spaces.

Markdown processing runs sequentially: case corrections, Prettier, then
MarkdownLint. Prettier owns list numbering and spacing (`MD029` and `MD030` are
disabled), avoiding conflicts with the repository's four-space Markdown indent.
Nested lists use the same four-space indent in MarkdownLint (`MD007`).
