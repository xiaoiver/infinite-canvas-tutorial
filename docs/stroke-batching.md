# Ordered stroke batching in Core and ECS

Compatible translated Path strokes now share ordered GPU pages in both renderers. In the real [workflow canvas](https://infinitecanvas.cc/example/workflow-canvas), **2,400 visible cards and 2,400 visible cubic edges** retain their full geometry while drawcalls fall from **4,802 to 2,412**. This is a submission optimization; it does not simplify curves or establish smooth interaction on all devices.

## Scope and behavior

The existing `pathInstancing` canvas option remains **false by default**. It now covers compatible solid strokes as well as repeated filled Paths. The Workflow example explicitly enables it and marks its edge entities batchable through a runtime rendering hint. Original serialized nodes and history are unchanged. Other callers must opt in and use batchable Paths.

A page contains at most 256 adjacent Paths with matching solid stroke color, opacity, width, alignment, cap, join and miter policy. Geometry may differ between Paths. This first implementation accepts only pure world translations and unfilled Paths. Dashes, gradients, textures, filters/shadows, clipping, node blend processing, wireframe, attenuation and unsupported transforms keep the existing full path. ECS also rejects nonempty arrow markers and 3D extrusion. Painter barriers are never crossed to seek a matching later style.

Each original native four-point stroke window keeps its flags and travel values. Packed rows add only per-path translation and painter depth; independent paths are never connected. Joins, caps and segment counts are preserved. A shader attribute reuses the otherwise unused wireframe location, keeping WebGL1 within eight attribute locations. Actual Core and ECS GLSL variants also compile through the WebGPU compiler; native WebGPU rendering remains unverified locally.

Camera-only frames reuse page geometry. Geometry/style changes, member placement/order changes and page membership changes invalidate the affected page. A drag can rebuild the page containing the changed edge; sparse updates within a page are a possible later optimization. Empty/retired pages release their resources and cannot submit again. The original Paths remain the source for picking, hover, selection, history, culling and export. Raster capture selects the full renderer independently of the screen flag.

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm exec tsc -p __tests__/browser/tsconfig.bench.json
pnpm exec tsc -p examples/workflow-canvas/tsconfig.bench.json
pnpm bench:stroke-batching
pnpm bench:workflow
```

Run benchmarks serially. `WORKFLOW_CHROMIUM` optionally selects an installed Chromium executable. `STROKE_BENCH_OUTPUT` and `WORKFLOW_BENCH_OUTPUT` select the raw JSON output paths. Both comparisons use the same candidate source with the flag disabled/enabled. The workflow diagnostic entry uses `strokeBatching=0/1`; shipped HTML continues to load the ordinary application entry.

The [machine-readable results](./stroke-batching-benchmark.json) retain every elapsed sample, camera position, native-work histogram, resource snapshot, exclusive phase mean and source provenance. Core was measured on clean local commit `0974fac` (tree `c837ce0595d7ca44fbd28e68d050cf39c2d40eb2`), published with the identical tree as `a316ba5`. Workflow was measured on clean `29659ac` (tree `35f9dba8fbf006a7f7f4084b5a1e85155c873013`), published unchanged as `7a891b7`; that follow-up changes only benchmark HTML transform ordering. Documentation commits do not change measured runtime code.

Measurements used Debian 13, Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Core measures synchronous camera/render work, excluding rAF waits. Workflow measures complete asynchronous ECS `world.execute()` calls, including native blocking and waits. These are CPU-side elapsed measurements, not pure JavaScript time or GPU timers. Do not compare the two timing boundaries directly. Core reports its upper median and sample 29 of 30 for p95; Workflow uses nearest-rank percentiles. Instrumented and ordinary trials remain separate.

## Core: 2,400 visible cubic strokes

The fixture fits every curve in the viewport, warms 10 camera frames and records 30 alternating small pans per mode.

| Measurement                             |        Disabled |     Enabled |
| --------------------------------------- | --------------: | ----------: |
| Actual visible curves                   |           2,400 |       2,400 |
| Drawcalls                               |           2,401 |          11 |
| Native indices / array vertices         |     999,000 / 4 | 999,000 / 4 |
| CPU frame p50 / p95, ms                 | 527.6 / 1,100.4 |  6.2 / 15.0 |
| Array-buffer binds / attribute pointers | 16,801 / 16,801 |     81 / 81 |
| Element-buffer binds                    |           2,400 |          10 |
| Live buffers / textures                 |      12,003 / 7 |      53 / 7 |
| Programs / shaders / VAOs               |       2 / 4 / 2 |   3 / 6 / 3 |

Each measured frame uploads one 192-byte scene uniform and no vertex rows. Switching modes in the same Core device retains the old compiled program in its normal render cache; the extra program is not an active per-path allocation. Teardown returns exactly to the captured external-device baseline. This synthetic curve-only result must not be substituted for the real Workflow result below.

## Real Workflow: 2,400 cards and 2,400 edges

Viewport is 1,500 × 980; the actual canvas is 1,148 × 914. Every overview trial confirms 4,801 document entities and 2,400 visible cards plus 2,400 visible edges. Each ordinary/profiled trial uses a fresh page, five warmup frames and 30 measured overview frames.

| Main-context work / resource    |           Disabled |           Enabled |
| ------------------------------- | -----------------: | ----------------: |
| Drawcalls, every overview frame |              4,802 |             2,412 |
| Native indices / array vertices |        614,406 / 4 |       614,406 / 4 |
| Uniform upload per frame        |          1 × 192 B |         1 × 192 B |
| Live buffers / allocated bytes  | 19,206 / 4,051,756 | 7,256 / 3,478,156 |
| Live textures                   |                 14 |                14 |
| Programs / shaders / VAOs       |          3 / 6 / 3 |         3 / 6 / 3 |

The remaining 2,412 draws are 2,400 independent card submissions, ten stroke pages and two other passes. The separate offscreen context remains at one buffer, five textures and six framebuffers. All four trials report zero GL error and pass tracked-resource teardown and instrumentation restoration assertions.

| Complete ECS frame, ms    | Disabled p50 / p95 | Enabled p50 / p95 |
| ------------------------- | -----------------: | ----------------: |
| Ordinary overview         |      116.9 / 774.3 |       40.9 / 52.0 |
| Profiled overview         |      477.7 / 842.1 |       41.9 / 57.9 |
| Ordinary time-driven tour |       26.6 / 803.6 |      16.1 / 199.1 |
| Profiled time-driven tour |       12.5 / 210.3 |      30.8 / 204.4 |

The time-driven ten-second tours render different camera samples and visible subsets when frame rate changes: 35/46 ordinary frames and 54/33 profiled frames, disabled/enabled respectively. Their distributions are not fixed-workload speed ratios; the profiled tour median regresses and is retained. Cold overview entry still stalls: worst captured frame is 942.9/962.2 ms in the two disabled trials and 738.9/798.6 ms in the enabled trials. This optimization does not remove cold preparation work.

In the profiled enabled overview, mean exclusive SDF/card submission remains **31.9 ms** of a roughly 42 ms complete frame; stroke-page submission is **4.6 ms**. The baseline has substantial variance, and no fixed speedup factor is promised. The 16.7 ms frame budget and the user's smooth 2,400-node interaction goal remain unmet. The next priority is compatible card-image submission across the alternating image sources, implemented in both renderers while preserving painter order and texture ownership. Hardware GPU validation and a repeatable drag workload are also still needed.

## Validation

-   Core stroke contracts and batch lifecycle: 18 passed; ECS stroke and transition tests: 76 passed.
-   Chromium: ten new stroke cases passed; real Workflow interaction suite: six passed.
-   WebKit: all 31 selected cases passed across the complete run and a clean two-case WebGL1 rerun. One original ECS WebGL1 run was interrupted by Vite navigation during the local rebase; it passed after source stabilization.
-   Both backends cover nonblank pixel equivalence, overlaps/caps/joins/style fallback, painter barriers, native segment preservation, camera-only uploads, original picking, parent transforms, history, culling/reentry, camera migration, exports, same-frame deletion and teardown.
-   Core/ECS/browser/benchmark TypeScript checks, changed-file lint, 42 tooling tests and normal commit hooks passed. Both benchmark scripts passed. GitHub CI is tracked on the draft PR separately.
-   Local WebKit uses the pinned Playwright 1.61.1 engine. Headless WPE runs with local GUI-library validation disabled; no browser tests or assertions are skipped. Chromium 149 from the pinned toolchain is covered by CI rather than the older cached local Chromium. Native hardware GPU rendering and native WebGPU execution were not available locally.
