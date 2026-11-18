# Experimental small-text LOD (phase 1)

Implements the first vertical slice of [the LOD proposal, #673](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/673), directly on master. The design PR does not need to be merged first. No geometry LOD, subtree bitmap cache, new dependency, or default visual change is included.

## Enable and disable

```ts
api.setTextLODEnabled(true);
api.setTextLODEnabled(false);
```

The switch is queued for the next ECS frame and belongs to one canvas. It defaults to `false`. A custom ECS bootstrap can also pass `textLOD: true` to `api.createCanvas`.

`ComputedLOD` stores only the current `full` / `text-proxy` level and owning camera. Neither it nor the canvas switch is part of a serialized node, history delta, or collaboration payload. Disabling removes the runtime component and restores the existing full drawcalls.

## Decision and rendering

The local font em axis is projected through `GlobalTransform` and the camera view-projection matrix into the canvas's logical CSS dimensions. Rotation, nested affine transforms, reflection and nonuniform scale are handled without using device pixels. Nonfinite, projective, singular or invalid bounds/metrics fall back to full.

The experimental thresholds are strict: enter proxy below **6 CSS px**, leave above **8 CSS px**. Between them, retain the previous level. Camera migration resets hysteresis. `ComputeLOD` runs after viewport culling and interaction writers, before `Last`/`MeshPipeline`. Separate ECS change queries observe optional component additions/removals; parent backlink changes also cover detach/reattach within one frame. The disabled default skips the text scan. Changed frames can scan the current text population; this phase does not provide an incremental spatial LOD index.

Ordinary solid-filled horizontal text uses one untextured Mesh quad per nonempty line. It keeps line widths, empty-line spacing, SDFText's local layout convention, transform, color, paint/node opacity and render order. It does not generate glyph quads or an atlas. Proxies deliberately remain unbatched in this slice, so object drawcall count need not decrease. No selectable proxy node is created.

Bitmap/path/physical text, emoji/BiDi shaping, decoration, stroke, shadows, textures, size attenuation, wireframe, clip chains, filters and node blending conservatively retain full rendering. Selected, highlighted and editing entities (including selected/highlighted ancestors) force full without waiting for a camera zoom.

The renderer listens for level and metrics changes, then uses the existing pending queue. Retirement, culling and camera ownership take precedence when consuming it. Only the current representation is retained; empty shared text batches are evicted on a LOD transition. Retiring Mesh/SDFText bindings are removed from the render cache before their private buffers/atlases die. Programs and layouts remain reusable.

## Interaction and exports

Picking, marquee, snapping and editing continue to use the original entities, visibility, bounds and geometry. LOD does not write `Culled`, `ComputedVisibility`, `Text`, `Font`, or document style components.

Raster screenshot and animation rendering use an explicit `export` batch intent, including the independent partial-export path. Export managers cannot choose TextProxy and cannot consume the screen's geometry/material dirty flags. They are destroyed in `finally`; a screen redraw is scheduled after success or failure. Snapshotting screenshot request fields avoids using an ECS component accessor after coroutine cleanup. Failed screenshots clear their request so subsequent screen frames recover. SVG and Canvas2D export continue to read original document data.

Temporary full raster export managers currently recreate export drawcalls for each animation frame. This favors isolation and predictable cleanup; animation throughput with large LOD scenes remains unmeasured.

## Reproduce validation

Use the repository's Node 20 / pnpm 9.15.9 setup. See [the ECS test environment guide](./running-ecs-tests.md).

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --coverage=false \
  __tests__/ecs/text-lod.spec.ts __tests__/ecs/batch.transitions.spec.ts \
  __tests__/ecs/render-cache.spec.ts
pnpm exec playwright install chromium
pnpm exec playwright test -c playwright.text-lod.config.ts
pnpm bench:text-lod
# Optional smaller run:
TEXT_LOD_COUNTS=1000 pnpm bench:text-lod
```

The renderer-only Playwright configuration uses the production ECS/WebGL renderer, native resource probes and a source Vite fixture. It can run after installing just root tooling and ECS dependencies:

```sh
pnpm install --frozen-lockfile --filter . --filter '@infinite-canvas-tutorial/ecs...'
```

The benchmark uses fresh browser pages, an 800×600 logical canvas, DPR 1, fixed two-line labels and 100 columns. It seeds at overview zoom 0.024 and alternates 0.024/0.0241, discarding 15 warmup frames. It reports measured `world.execute()` elapsed p50/p95, submitted drawcalls/index-derived vertices, **actual visible entities** and native live resource counts. These elapsed times include ECS and CPU submission, not GPU timer-query measurements. Raw results are written incrementally to `.test-results/text-lod-benchmark.json`. The default run compares 1,000 and 10,000 nodes, off then on, serially.

GPU time, GPU byte usage, geometry-upload bytes and crossing-time percentiles are not instrumented. Counts are live native objects, not a GPU-memory estimate. Absolute timings depend on the browser, software renderer, host load and startup/cache state; no speedup factor is promised.

## Recorded validation and measurement

Results below are from the cloud Linux environment on 2026-11-18, Node 24.22.3 and Chromium 140 / SwiftShader. The supported Node 20 CI environment remains the recommended setup.

-   ECS package typecheck: passed after building device-api.
-   Repository-wide `eslint . --max-warnings=0`: passed.
-   Fifteen applicable ECS suites: **313 tests passed**, covering LOD decisions/triggers/migration, cache/batch lifecycle, selection layout, snapping, document history, glyph metrics/atlas ownership, Canvas2D rendering and app lifecycle.
-   Chromium: **4 tests passed**, covering native hover/click/marquee, editing, hysteresis, feature-off pixel equality, original bounds/document equality, full/partial export equality, injected export failure, same-frame deletion, same-band geometry reuse, 12 crossing cycles and zero native resource leaks after destruction.
-   `api.text-resize.spec.ts`: could not start because headless-gl's native binding is unavailable (Node 24 build lacks X11 development libraries). No assertion failure was observed in that suite.
-   Full workspace installation: blocked by a registry 403 for an unrelated Radix UI archive; used the filtered install above. Full browser typecheck was attempted and blocked by 310 dependency-related errors across site/Web Components files (none in the new LOD fixture); the isolated browser fixture/test/benchmark typecheck passed. Full workspace typecheck, full ECS suite, the existing site-dependent browser suites (including cross-page collaboration), WebKit, native WebGPU, animation encoding and physical devices were not run.

The serial combined benchmark completed both 1,000-node modes, then reached its 600-second test limit while **seeding the 10,000-node full scene**. No 10,000-node full visible count or frame timing was obtained; the timeout is a measurement failure, not a completed comparison. Incremental results preserve the completed modes. A separate proxy-only run can be reproduced with:

```sh
TEXT_LOD_COUNTS=10000 TEXT_LOD_MODES=on pnpm bench:text-lod
```

| Actual visible texts | Mode              | CPU frame p50 / p95 (ms) | Drawcalls | Vertices | Live main-canvas buffers / textures |
| -------------------- | ----------------- | ------------------------ | --------- | -------- | ----------------------------------- |
| 1,000                | off               | 34.1 / 43.6              | 1,000     | 164,000  | 5,003 / 1,007                       |
| 1,000                | on                | 29.4 / 43.8              | 1,000     | 8,000    | 3,003 / 7                           |
| 10,000               | on (separate run) | 782.2 / 879.0            | 10,000    | 80,000   | 30,003 / 7                          |

Each completed mode recorded 89 frames after warmup. The offscreen device additionally retained one buffer and five textures in both modes. The proxy's extra cached program/layout accounts for one more program/vertex-array object; these remained bounded across crossings. The 1,000-node p95 did **not** improve in this run. This slice reduces submitted glyph work and atlas resources; it does not remove per-object CPU submission costs or establish a general frame-time speedup.

The separate 10,000-node proxy run completed in about 1.5 minutes. Its high CPU frame time means this slice alone does not make that overview interactive. The 10,000-node full mode has no comparable frame sample; the cause of its long construction time was not established. See [the raw results and explicit incomplete-run record](./text-lod-benchmark.json).

## CI follow-up (2026-11-18)

At head `487da22`, [unit run 44275171051](https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/44275171051) still failed the old export cleanup assertion: it expected `showUIs()` on the renderer's shared batch manager. Export now owns a separate disposable batch manager, so restoring shared UI is not the contract. The regression now checks both a rendering exception and an empty-target early return: the export batch and temporary renderer are released exactly once, an existing screen renderer is retained untouched, the partial renderer cache is empty, and the camera is scheduled for a screen redraw. All four renderer lifecycle assertions pass locally after this change. No production export behavior was changed to satisfy the test.

The same head's [dependency audit](https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/44275261879) reports [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), a picomatch repeated-extglob ReDoS affecting versions through 4.0.7. The lockfile resolves picomatch 4.0.4 through existing build/test/release tooling, including micromatch/fast-glob/Changesets; this PR adds no dependency and does not change the lockfile or overrides. The advisory, updated November 17, lists no patched version; the npm registry's latest release is also 4.0.7 as checked November 18. Updating to that release would remain vulnerable. No audit exception, severity suppression, or speculative local parser patch was added. The security check remains a known failing check pending an upstream fix or a separately reviewed mitigation.

## Integration with the ordered batching planner

The branch now includes master merge `882af47` from #675. Conflict resolution keeps the ordered planner and indexed binding eviction while preserving screen/export intent, text proxy dispatch, camera ownership tracking and export redraw recovery. Private full/proxy renderers migrate when the ordered plan is consumed; exports retain screen dirty markers. TextProxy continues to use the verified private Mesh path and does not opt into solid SDF instancing.

An additional combined browser regression places small text between two opt-in solid batches. It checks painter-order barriers across proxy/full selection transitions, cancellation, screen restoration, full and partial export pixel equality, and native GPU teardown. A deterministic test also verifies that export does not consume screen geometry/material markers. The integrated local run passes 230 ECS tests with the existing BatchManager/RenderCache coverage thresholds, the original four LOD browser regressions, and seven batching/combined browser regressions. Repository lint, ECS typecheck and both isolated browser harness/benchmark typechecks pass. The recorded benchmark tables above predate this integration and remain historical measurements, not new measurements of the integrated head.
