# ECS polyline geometry LOD

This is the first narrow geometry LOD slice following [the 2D LOD plan](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/673) and text proxy batching in [#677](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/677). SVG Paths already have adaptive render-pass tessellation in `PathDrawcall` / `PathGeometryCache`. This change targets densely sampled ordinary `Polyline` strokes, including imported sampled ink. It does not change Core, the lesson renderers, pressure brushes or vector networks.

## Usage and scope

```ts
api.setPolylineLODEnabled(true);
// Restore the original point stream on the next ECS tick.
api.setPolylineLODEnabled(false);
```

The per-canvas runtime switch defaults to false and is independent of text LOD and `Renderable.batchable`. It is never serialized or recorded in undo/collaboration data. This reduces stroke segment instances; it does not combine separate polylines into one drawcall.

Eligible input is an open polyline with at least 32 finite samples, no fill, one solid stroke, center alignment and round joins. Endpoint samples and their adjacent samples remain exact, preserving cap direction. Dashes, markers, closed/disconnected/invalid paths, miter/bevel joins, rough/UI geometry, fill textures, wireframes, filters, clipping, blending and shadows keep full geometry. Selected/highlighted/editing shapes and descendants of such ancestors also stay full. Library picking, bounds, box selection, snapping, source points and SVG output remain on their existing geometry paths.

## Rendering and cache

The render pass supplies the opt-in flag and canvas DPR. `pathScreenMetrics` measures the largest local-to-screen singular value, including parent transforms, rotation, nonuniform scale, shear and reflection. Dividing the physical-pixel scale by DPR gives a conservative CSS-pixel scale. Invalid or singular transforms stay full.

Iterative Douglas–Peucker retains original samples with a centerline error budget of **0.25 CSS px**, using power-of-two scale buckets rounded upward. Refinement is immediate; coarsening waits until the current scale falls to one quarter of the retained bucket. Each drawcall retains at most four CPU levels. A bounded work budget falls back to the source instead of allowing quadratic simplification work on adversarial input. Geometry edits invalidate the cache even while interaction is forcing full. Panning inside a bucket does not rebuild geometry.

The error budget concerns the polyline centerline. Round joins avoid new miter spikes, but antialiasing and near-self-intersection coverage can still differ. This is an experimental opt-in, not a promise of identical screen pixels. Both whole and partial raster export pass `false` explicitly and use the complete source point stream. Export cleanup and screen redraw retain existing ownership rules. The simplified arrays belong to drawcalls and never replace `Polyline.points` or `ComputedPoints`; no extra GPU representation or renderable entity is retained.

## Reproduction and verification

```sh
pnpm exec jest -c jest.ecs.config.js --runTestsByPath \
    __tests__/ecs/polyline-lod.spec.ts \
    __tests__/ecs/path-adaptive.spec.ts \
    __tests__/ecs/smooth-polyline-dash.spec.ts --runInBand --coverage=false
pnpm exec playwright test -c playwright.polyline-lod.config.ts
pnpm exec playwright test -c playwright.polyline-lod-webkit.config.ts
pnpm bench:polyline-lod
```

The fixture is `/polyline-lod.html` on the existing source browser server. The isolated config only requires renderer dependencies. `POLYLINE_LOD_COUNTS=150,600` controls benchmark density. Each scene contains equal numbers of 512-sample solid polylines, existing adaptive cubic Paths and solid rectangles, laid out on a non-overlapping 20-column grid. All objects are explicitly opted into existing batching. The 800×600 canvas uses DPR 1 and zoom 0.2. Alternating 0.1-unit camera pans force real rendering without crossing precision buckets.

CPU samples time complete `world.execute()` calls after 15 warmup frames; they exclude initialization. The script writes the actual completed sample count and p50/p95, actual visible objects, planned drawcalls, native WebGL draw submissions, submitted index entries, geometry counters and live resource counts to `.test-results/polyline-lod-benchmark.json`. Native counts include the final compositing pass. The `vertices` diagnostic counts nine vertex slots per stroke instance plus other drawcalls' index entries; native submitted indices and stroke instance counts are less ambiguous work measures. These are software WebGL CPU measurements, not GPU timers or an FPS guarantee.

Pure tests cover error, reversals, seams/invalid data, bounded work, hysteresis, eviction and style/ancestor interaction eligibility. Browser tests cover same-bucket reuse, runtime off/on, interaction/style transitions, whole/partial export equality, culling reentry, same-frame deletion, resource cleanup and DPR 3 transformed pixels. The WebKit test list includes this suite. Native WebGPU and physical devices remain separate checks.

## Recorded local result

Linux, Node 24.22.3, Chromium 140.0.7339.186 / SwiftShader; 29 completed measured frames per case after 15 warmup frames. Raw data: [polyline-lod-benchmark.json](./polyline-lod-benchmark.json).

| Actual visible objects | LOD | Native drawcalls | Submitted indices | Stroke instances | CPU p50 / p95 (ms) |
| ---------------------- | --- | ---------------- | ----------------- | ---------------- | ------------------ |
| 150                    | off | 201              | 399,750           | 26,550           | 6.7 / 10.8         |
| 150                    | on  | 201              | 31,500            | 2,000            | 7.1 / 13.4         |
| 600                    | off | 801              | 1,599,000         | 106,200          | 24.7 / 36.5        |
| 600                    | on  | 801              | 126,000           | 8,000            | 25.3 / 31.8        |

The native submission and stroke instance reduction is clear. CPU p50 did not improve; p95 varied in opposite directions at the two densities, so these samples do not establish a CPU speedup. Main-canvas live buffers remained 853 / 3,403 at the two densities, and textures remained seven. This slice reduces geometry, not drawcalls or per-object resources. Keep it opt-in; eligibility/projection checks and remaining per-object submission are follow-up CPU work. No GPU time, GPU byte count or physical-device frame rate was measured.

Local validation passed: ECS and browser TypeScript, changed-file ESLint, MarkdownLint, six related Jest suites / 93 tests, Chromium / three browser cases, and nine browser CI partition/tooling checks. WebKit could not launch locally because GTK4, Graphene, WOFF2, HarfBuzz ICU, Hyphen, Manette and GLES libraries are missing; its assertions have not run locally. The existing WebKit CI matrix includes the new suite. The complete local ECS snapshot suite was not run because this Node 24 workspace lacks the optional native headless-GL binary. No dependency or security-audit configuration was changed.
