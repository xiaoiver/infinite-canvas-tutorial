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

CI runs `.github/workflows/browser-regression.yml` with six independent test
runners: two Chromium shards, WebKit Lottie, and three shards for the remaining
WebKit suites.
Each runner still uses one worker and the existing WebKit browser isolation.
The non-Lottie WebKit suites exceeded the 25-minute job budget in PR #402.
They now use three shards while Lottie retains its own runner. Static checks run
alongside the browser jobs. The existing `browser-regression` check succeeds only when
all jobs succeed; failure, cancellation and skipping cannot pass the gate.
New commits cancel older runs for the same PR or branch.

Run the same groups locally (one at a time; the fixture uses a fixed port):

```sh
pnpm test:browser --shard=1/2
pnpm test:browser --shard=2/2
PLAYWRIGHT_WEBKIT_GROUP=lottie pnpm test:browser:webkit
PLAYWRIGHT_WEBKIT_GROUP=other pnpm test:browser:webkit --shard=1/3
PLAYWRIGHT_WEBKIT_GROUP=other pnpm test:browser:webkit --shard=2/3
PLAYWRIGHT_WEBKIT_GROUP=other pnpm test:browser:webkit --shard=3/3
```

Without `PLAYWRIGHT_WEBKIT_GROUP`, the WebKit command still runs every suite.
`pnpm test:tooling` discovers the actual Playwright cases and checks that the
workflow groups cover each browser's tests exactly once.

Every completed group uploads its JSON results, timing report and any failure
screenshots/traces under a unique `browser-regression-*` artifact for seven
days. The job summary lists slow files and test attempts, including setup,
body and teardown durations. To produce the same report locally:

```sh
pnpm test:browser --reporter=list,./scripts/browser-timing-reporter.mjs
```

The reports are written to `.test-results/browser-timings.json` and
`.test-results/browser-timings.md`. The existing ECS suite remains a separate
regression check.

Lesson 12 dash rendering checks run in Chromium and WebKit. They compare rendered
stroke interiors with native Canvas2D for all cap/join combinations, offsets,
closed paths and rectangles, sharp corners, zoom, short dashes, dots, independent
subpaths, alignment and solid strokes. Edge antialiasing kernels may differ, so
the comparison ignores partially covered pixels. Offset animation also checks
that geometry is not rebuilt. These fixtures use the independent lesson 12
renderer. The same comparison cases also run against ECS, with additional
coverage for independent path/dash caps, screen-space stroke sizing, gradients,
paths, vector networks and sampled ellipses. ECS currently rebuilds geometry on
every Stroke write, so only the lesson fixture asserts uniform-only offset
updates. The core renderer is not covered by these fixtures.

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
rendering check. The React 18/19 CI matrix runs both browsers.

`.github/workflows/react.yml` builds and checks each React version once, then
restores its ESM/CJS build artifact into independent browser jobs. Each version
runs two Chromium shards and three WebKit shards, with one worker per runner
and the existing per-test WebKit isolation. Sharding distributes individual cases
evenly rather than keeping large files together; tests still run sequentially on
each runner. Only the selected browser is installed
on each runner. New commits cancel obsolete runs for the same PR or branch.

The existing `react (18.2.0)` and `react (19.2.3)` checks remain the merge gates.
Both require the complete checks/browser matrix to succeed; failures, skipped
jobs and cancellations cannot turn either gate green. `pnpm test:tooling`
discovers the actual tests and verifies each browser's shards cover them exactly
once for both React versions. Local unsharded commands still run the entire suite.

To run a CI shard locally, after the package build:

```sh
pnpm test:react:browser --shard=1/2
pnpm test:react:browser:webkit --shard=1/3
```

Each browser job uploads JSON results, setup/body/teardown timing summaries, and
failure screenshots/traces for seven days, including hidden files. Reports are
available for successful runs too. Use `--reporter=list,./scripts/browser-timing-reporter.mjs`
to generate timing reports locally. Set `PLAYWRIGHT_JSON_OUTPUT_FILE` and add the
`json` reporter to also save machine-readable results.

React suites using `isolated-webkit-test` attach a bounded `browser-lifecycle`
event trail on failure: navigation, page close/crash, Vite messages, page errors,
failed requests, and Chromium execution-context destruction. Capture uses
host-side state, so it also works when `page.evaluate()` cannot run. This adds
diagnostic evidence for the intermittent React 19 selection failure; it does not
claim that its underlying cause has been fixed. Keep assertions and retry policy
unchanged while investigating.

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

### ECS text rendering and editing

`ecs-text.spec.ts` uses local Gaegu and Noto fonts, the ECS renderer, and the Spectrum text editor. It compares glyph ink against Canvas, counts rasterization and atlas uploads during actual transformer resize gestures, checks atlas invalidation for new content/fonts, and verifies editor corners after rotation, camera changes, flips, and parent transforms. Both Chromium and WebKit run this suite.

Manual check: open `/example/pretext`, enlarge the text containing `hijk`, resize repeatedly, rotate from outside a corner, and double-click to edit. The `j` descender should remain complete, resizing should reuse existing glyphs, and the editor should retain the text angle.

Blend-mode regressions compare GPU pixels (including alpha) with native Canvas2D
for the 16 CSS modes, and with clamped channel-sum references for linear burn and
dodge. They cover node and paint-layer blending, transparent backdrops, node
opacity, path fills plus strokes, text, clipping, three-layer accumulation and a
normal draw after the blended nodes. Chromium and WebKit both run these checks,
including a forced WebGL1 fallback. The SDF cases also guard against mediump
packed-flag overflow on mobile GPUs.

## Lottie import baseline

`lottie.spec.ts` compares fixed frames of ECS output against the pinned
`lottie-web` Canvas renderer: position animation, animated single-path trim
returning to full coverage, reversed trim endpoints, wrapped offsets and empty
static round-cap trims. Silhouette comparisons allow a one-pixel edge difference;
interior color/alpha checks still detect missing geometry or unintended fading.
The same fixture verifies autoplay=false, seek/stop, repeat rendering, unrelated
node preservation and cleanup on player/canvas destruction. Pure ECS-folder
specs cover clock continuity, finite/infinite loops, forward/reverse segments,
trim arithmetic and non-mutating JSON-pointer diagnostics.

These are scoped import regressions, not a whole-format compatibility suite.
Text, masks, effects, multi-path/fill trim and other unsupported features remain
listed in lesson 36. Lottie tests run in Chromium and the separate WebKit suite.

## 3D gizmo projection and gestures

`gizmo.spec.ts` runs the complete 3D renderer in Chromium and WebKit. It checks
pointer commits, undo/redo, and Escape cancellation. GPU pixel assertions locate
the Z arrow independently of the picker on landscape and portrait canvases,
including DPR 2, camera zoom/rotation, and positive/negative object depth. The
same visible handle must start a translation and map a known CSS-pixel movement
to the expected document depth. A separate overlap check verifies that the
visible X arrow receives the press where it covers a rotation ring.

Pure projection/constraint math, tilted local rings, depth-plane dragging,
multi-canvas lifecycle, and history are also covered by ECS Jest tests. Standard
camera math is tested separately from these linked-camera browser scenarios.

`gizmo-worlds.spec.ts` checks GPU pixels on two canvases in one World, destroys
one canvas while continuing to edit the other, and exits/restarts the App with
fresh canvases. A separate test attempts a concurrent World and checks that its
expected Becsy rejection cannot replace the active renderer. Becsy still forbids
concurrent Worlds sharing component types; this is failure isolation, not support
for simultaneous Apps. Both tests run in Chromium and WebKit.

ECS resource tests keep references to submitted bindings and inspect their
buffers after every draw has been recorded. This catches multi-selection UBO
overwrites with deferred submission semantics. Browser tests currently use
WebGL; they do not certify a native WebGPU backend.

`gizmo-extrude.spec.ts` checks rectangle extrusion through the full renderer:
XY preview/commit with an independently sampled arrow pixel, cancellation,
undo/redo, and Z movement that preserves thickness through deletion and document
reload. It also guards clearing a 3D selection and disabling extrusion before
resizing with the 2D transformer.
These cases run in both browsers; parent-coordinate conversion, local rotation
and source/companion invalidation are covered separately by ECS tests.

`gizmo-invalidation.spec.ts` changes the linked camera or source document while
mesh/extrusion handles are held. It checks rollback to the current document,
ignoring a late release without a history entry, and a fresh drag in the new view.
Both Chromium and WebKit run these cases.
