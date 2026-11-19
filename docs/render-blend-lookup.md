# ECS render blend lookup

After [#678](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/678), fewer stroke segments did not establish a consistent CPU speedup. A Chromium CPU profile of the same 600-object mixed scene identified `buildFlushSegments` and `API.getNodeByEntity` in repeated blend decisions. Each uninstanced drawcall searched entity commands and then document nodes, including ordinary shapes and non-document UI. This adds document-size-dependent work to camera frames.

The renderer now reads the existing `NodeLayerBlendMode` component, whose value is already synchronized by deserialization and property/history updates. The frame decision is constant-time per drawcall and introduces no new cache or invalidation protocol. Batch eligibility and compositing use the same value. SDF material validation reuses the document nodes it already fetched for paint comparison instead of fetching them again for blend mode. The public `getNodeLayerBlendMode(api, entity)` document lookup remains unchanged.

This applies to ECS drawcalls for text and other graphics. It does not change batching membership rules, draw order, geometry, serialized documents, LOD defaults, or export precision. It does not optimize the rest of `getNodeByEntity` usage or remove all document lookups from material validation.

## Measurements

Reproduction uses the existing benchmark:

```sh
POLYLINE_LOD_COUNTS=600 pnpm bench:polyline-lod
```

Compare baseline `85dc4729` with this change. The script uses a fresh page per case, an 800×600 canvas, DPR 1, zoom 0.2, equal numbers of 512-sample polylines, adaptive Paths and rectangles, 15 warmup frames and 29 completed measured frames. Both focused runs used only the 600-object cases, without concurrent local checks. The focused optimized run preceded the focused baseline run; both were separate Chromium launches. Environment: Linux, Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader.

| Actual visible | Polyline LOD | Baseline CPU p50 / p95 (ms) | Optimized CPU p50 / p95 (ms) |
| -------------- | ------------ | --------------------------- | ---------------------------- |
| 600            | off          | 22.3 / 43.2                 | 18.9 / 33.1                  |
| 600            | on           | 20.2 / 32.8                 | 20.8 / 27.5                  |

The full-geometry case improved in this measurement; the LOD case's median did not improve. Smaller 150-object samples were also mixed. Short software-renderer samples are noisy and do not establish a universal CPU or FPS improvement. The change removes the repeated scan structurally; the unit regression rejects document lookup during blend planning.

Native work and resource counts were identical before and after: 801 drawcalls including final compositing, 1,599,000 submitted indices with LOD off / 126,000 with LOD on, 3,403 main-canvas buffers and seven textures. GPU time and GPU bytes were not measured.

Separate sampling profiles used 90 camera pans with three ECS frame boundaries per pan, after scene preparation. `buildFlushSegments` inclusive sample time fell from about 301 ms to about 5 ms across that diagnostic run; `getNodeByEntity` no longer appeared in the post-change sample. These are sampling attributions across the run, not per-frame timings or GPU measurements. Raw benchmark runs and exact profile summaries are in [render-blend-lookup-benchmark.json](./render-blend-lookup-benchmark.json). The initial optimized mixed run is retained as diagnostic data because a TypeScript check overlapped its late phase; headline values use the isolated focused runs.

## Validation and limits

-   ECS and browser TypeScript, changed-file ESLint and diff checks passed.
-   Three related Jest suites passed: 99 tests, including blend-component edit/undo/redo synchronization, batch transitions, and no document scans during normal/blended flush planning.
-   The final Chromium run passed 11 browser cases: all existing Canvas2D blend comparisons, Path/text blending, clipping, WebGL1 continuation, translucent paints, a new live normal → multiply → screen → normal / undo / redo pixel test, and all three polyline LOD cases.
-   An initial Path blend run timed out without a captured page error. Its isolated run and the final complete run passed with existing assertions and timeouts; no underlying flake fix is claimed.
-   WebKit could not launch locally because the host browser libraries are missing. The new case is in the existing WebKit blend suite and will run in CI. Native WebGPU, physical devices and the full local headless-GL suite remain unverified.

No dependencies, audit exceptions, CI retry policy or timeouts changed.
