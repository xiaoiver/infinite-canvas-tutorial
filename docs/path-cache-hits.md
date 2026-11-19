# Current path precision cache hits

Camera-only profiling after [#681](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/681) still showed `PathGeometryCache.get` doing bookkeeping for unchanged precision levels. Both core and ECS now keep the current level reference. When the path string and the computed scale/radius buckets are unchanged, the cache returns that geometry directly, without constructing a string key or deleting/reinserting an already most-recent LRU entry.

Bucket computation, refinement/coarsening hysteresis, source invalidation and the four-level retention limit are unchanged. A precision transition still uses the existing LRU path. The current reference always names the most-recent retained level, so it does not retain a fifth geometry or allocate GPU resources. This changes CPU cache bookkeeping, not geometry, painter order, batching, LOD defaults or export precision. Core and ECS retain separate implementations with matching behavior.

This branch is independently based on master `b87079f4` (#680); it does not include the unmerged device change in #681.

## Reproduction and measurements

Run the focused microbenchmark and the existing mixed-scene frame benchmark separately:

```sh
pnpm exec jest -c jest.ecs.config.js --runTestsByPath scripts/path-cache.bench.spec.ts --testMatch '**/scripts/*.bench.spec.ts' --runInBand --coverage=false
POLYLINE_LOD_COUNTS=600 pnpm bench:polyline-lod
```

Baseline merge `b87079f4` has the same tree as measured checkout `57c49f28`. The new microbenchmark script was temporarily copied into that clean checkout and removed afterward. Run order was baseline micro, optimized micro, baseline frames, optimized frames, without concurrent local checks. Linux, Node 24.22.3; browser cases used Chromium 140.0.7339.186 and SwiftShader. All raw samples are in [path-cache-hits-benchmark.json](./path-cache-hits-benchmark.json).

The microbenchmark measures 100,000 cache calls per sample after three warmup samples, with ten measured samples. Stable calls keep one precision level; alternating calls switch between scale 2 and 16 as a control. These are Jest VM timings, not browser frame timings.

| Engine / workload  | Baseline p50 / p95 (ms) | Optimized p50 / p95 (ms) |
| ------------------ | ----------------------- | ------------------------ |
| core / stable      | 75.43 / 121.03          | 59.56 / 62.00            |
| ECS / stable       | 76.07 / 116.73          | 60.97 / 64.27            |
| core / alternating | 107.19 / 113.34         | 104.60 / 111.81          |
| ECS / alternating  | 108.04 / 122.72         | 110.45 / 119.53          |

Stable hits improve in this run. Alternating medians are mixed, including a small ECS regression. Geometry point-count checksums match for every sample. The additional current-level check does not remove the work needed during precision transitions.

The browser workload uses 600 actual visible objects: equal numbers of rectangles, adaptive Paths and 512-sample polylines, an 800×600 canvas, DPR 1, zoom 0.2, 15 warmup and 29 completed measured frames. Each case uses a fresh page; baseline/optimized runs use separate Chromium launches. CPU times include the existing native submission probe overhead. The mixed frame benchmark exercises ECS; core is measured separately by the microbenchmark and browser correctness tests.

| Polyline LOD | Baseline CPU p50 / p95 (ms) | Optimized CPU p50 / p95 (ms) |
| ------------ | --------------------------- | ---------------------------- |
| off          | 18.2 / 38.9                 | 17.3 / 34.2                  |
| on           | 17.5 / 26.4                 | 16.4 / 21.6                  |

Native work and resources match: 801 drawcalls including compositing, 1,599,000 submitted indices with LOD off / 126,000 on, one 192-byte scene uniform upload, and 3,403 main-canvas buffers / seven textures / five programs / five vertex arrays. Geometry build counts also match. Short software-renderer measurements do not establish a universal CPU or FPS speedup, and GPU time/allocated byte counts were not measured.

## Validation and limits

-   All 32 adaptive-path unit tests passed for core and ECS, including screen error, hysteresis, eviction, stroke radius, empty paths and source edits.
-   Forty-five Chromium browser cases passed: adaptive core/ECS curves at high zoom and DPR, blend/WebGL1 pixels, text/proxy/polyline LOD, interactions and resource cleanup. The added Path case checks whole/partial raster exports across precision transitions and source edits, and verifies teardown releases resources.
-   Core/ECS TypeScript, changed-file ESLint, Markdown lint and diff checks passed.
-   Local WebKit, the full native headless-GL suite, native WebGPU and physical devices were not run. The new Path case belongs to an existing WebKit CI suite; CI remains necessary.

No dependencies, GPU resources, audit exceptions, CI timeouts or retry policies were added or changed.
