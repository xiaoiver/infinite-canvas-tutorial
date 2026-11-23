# Ordered image rectangles in Core and ECS

Ordinary immutable image rectangles can now share ordered GPU pages in both renderers, including alternating image sources. In the real [Workflow canvas](https://infinitecanvas.cc/example/workflow-canvas), **2,400 visible cards and 2,400 visible cubic edges** retain their geometry while drawcalls fall from **2,412 to 22**. This follows stroke batching in #703 and texture sharing in #702.

The CPU-side improvement does **not** establish smooth interaction. In this software renderer, `world.execute()` p50/p95 improves from **37.0/47.4 to 12.0/19.1 ms**, but completion intervals remain much longer. The 2,400-node smooth-interaction goal is still unmet.

## Scope and API

`imageBatching` defaults to **false** in both Core and ECS. Core exposes `canvas.imageBatching`; ECS exposes `api.setImageBatchingEnabled(boolean)`. The Workflow example explicitly enables it, alongside `pathInstancing`, and marks its card entities batchable with a runtime hint. Original documents/history are unchanged; global LOD defaults stay off.

Each page accepts at most **256 adjacent rectangles and eight texture variants**. Different images, affine transforms and per-object opacity retain their original order. A ninth variant or a painter barrier starts another page; the planner never seeks a matching texture farther ahead. Six vertex attributes fit WebGL1's minimum budget, and eight statically named samplers avoid dynamically indexed sampler arrays. There are no atlas copies or texture-array dependencies.

Core accepts native immutable ImageBitmap fills. ECS accepts a single decoded, unfiltered image layer and uses the ordinary renderer's intrinsic dimensions, target raster size, object-fit, object-position and rasterizer identity. SVG fills retain their existing reraster path. Rounded rectangles, visible strokes, shadows, filters, clips, node blend processing, wireframe, attenuation, extruded shapes, mutable sources and borrowed textures keep the existing renderer. ECS also checks ancestor effects and requires a ready native bitmap; unresolved images use the normal decode path first.

The new vertex layout shares the ordinary SDF fragment coverage. The default fragment shader retains its original sampler declarations and sampling expression; a shader factory supplies only the image-page sampler section. Core's transparent stroke RGB is preserved at antialiased edges. This matters even when the stroke has no visible ink.

Picking, hover, selection, edits/history and camera migration still use original entities. Camera-only frames reuse instance rows; actual row changes use sparse uploads. Culling/reentry, same-frame removal and page retirement cannot revive old draws. Raster exports select the full path independently of the new screen option, including Core's existing capture planner.

## Texture ownership and metadata

Pages acquire device-scoped, reference-counted leases from the existing immutable image pool. Reordering sampler slots reuses live leases. A complete new binding is created before removed variants are released; failed uploads/bindings roll back newly acquired leases and preserve the preceding live set for cleanup/retry. Private bindings retire before textures can be freed. Borrowed textures remain caller-owned. No inactive GPU palette is retained after a variant leaves a page, and empty pages release all leases.

ECS caches decoded raster **descriptions**, not GPU textures, in a WeakMap keyed by entity. The signature includes the layer/source generation, geometry dimensions, intrinsic dimensions, DPR, API and adapter. Material edits invalidate descriptions even while batching is disabled. Camera/culling-only plans reuse them, avoiding repeated original-document lookups. This CPU metadata cache does not extend GPU texture lifetime.

## Reproduction and provenance

```sh
pnpm install --frozen-lockfile
pnpm exec tsc -p __tests__/browser/tsconfig.bench.json
pnpm exec tsc -p examples/workflow-canvas/tsconfig.bench.json
pnpm bench:image-batching
pnpm bench:workflow
```

Run benchmarks serially. `WORKFLOW_CHROMIUM` can select an installed Chromium executable. `IMAGE_BATCH_BENCH_OUTPUT` and `WORKFLOW_BENCH_OUTPUT` override raw JSON paths. Each comparison uses the same candidate source with image batching disabled/enabled; stroke instancing stays enabled in both Workflow modes. The diagnostic URL switch is not shipped as product UI.

[Machine-readable measurements](./image-batching-benchmark.json) retain every elapsed sample, Workflow camera/interval sample, native-work histogram, resource snapshot, phase mean, slow-frame attribution, pixel hash and teardown result. Both the final trial and the initial navigation regression are retained.

Final measurements used clean local commit `499a6b4` (tree `212ca46fe22587953424cc3dcc69477388118810`), published with the identical tree as `eb779d3`. Initial trial `c5d6d3f` (tree `3df6a4b00d985e8c2ab0d5a0eecbfeeb6b0b3f0f`) is published unchanged as `406b50e`. Documentation commits do not change measured runtime code.

The environment was Debian 13, Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Core paired timings cover synchronous camera/render work, excluding rAF waits. ECS paired/Workflow timings cover asynchronous `world.execute()`, including native blocking and waits. These are not GPU timers or presentation measurements. Percentiles use nearest rank. Ordinary/profiled runs remain separate, and no fixed speedup factor is promised.

## Paired Core/ECS image workload

Each fresh page renders **1,000 actually visible 24 × 22 rectangles** using six alternating immutable PNG sources, warms 15 small-pan frames and records 30. Viewport is 1,000 × 760; canvas is 1,000 × 720. Core uses the existing ordered planner in both modes to provide an ordered full reference. The fixture prepares nine sources for sampler-limit regressions but uses six in this measurement. Pixel hashes match exactly within each backend.

| Backend / mode        | Drawcalls | CPU p50 / p95 ms | Live buffers | Allocated buffer bytes |
| --------------------- | --------: | ---------------: | -----------: | ---------------------: |
| Core / full reference |     1,001 |       8.6 / 30.1 |        4,003 |                208,228 |
| Core / image pages    |         5 |        1.0 / 4.3 |           15 |                 82,372 |
| ECS / full reference  |     1,001 |      17.5 / 19.5 |        3,003 |                248,308 |
| ECS / image pages     |         5 |        3.6 / 5.0 |           15 |                 82,452 |

Each frame retains 6,000 indices, four array vertices and one 192-byte scene uniform upload, with no instance-row upload during camera-only movement. Main-context textures remain 13; programs/shaders/VAOs remain 2/4/2. Setup/configuration wall time is 160/59 ms in Core and 471/289 ms in ECS, full/pages respectively; this excludes initial source decoding and application startup.

ECS retains its separate offscreen context during execution (one buffer, five textures, six framebuffers), then releases every tracked resource. Core returns exactly to its captured external-device initialization baseline. Instrumented methods are restored in every case.

## Real 2,400-card Workflow

Viewport is 1,500 × 980; canvas is 1,148 × 914. Each overview trial confirms 4,801 document entities and **2,400 visible cards plus 2,400 visible edges**. Five warmup frames precede 30 recorded overview frames.

| Main-context work / resource    |          Disabled |        Enabled |
| ------------------------------- | ----------------: | -------------: |
| Drawcalls, every overview frame |             2,412 |             22 |
| Native indices / array vertices |       614,406 / 4 |    614,406 / 4 |
| Uniform upload per frame        |         1 × 192 B |      1 × 192 B |
| Live buffers / allocated bytes  | 7,256 / 3,478,156 | 86 / 3,078,076 |
| Live textures                   |                14 |             14 |
| Programs / shaders / VAOs       |         3 / 6 / 3 |      4 / 8 / 4 |

The enabled overview submits ten image pages, ten stroke pages and two other existing draws. The extra program is the image-page shader; the normal full image path was also exercised during asynchronous startup. The separate offscreen context is unchanged. All trials pass zero-GL-error, tracked teardown and instrumentation restoration checks.

| `world.execute()` elapsed, ms | Disabled p50 / p95 | Enabled p50 / p95 |
| ----------------------------- | -----------------: | ----------------: |
| Ordinary overview             |        37.0 / 47.4 |       12.0 / 19.1 |
| Profiled overview             |        39.8 / 55.3 |       11.6 / 18.2 |
| Ordinary time-driven tour     |       22.2 / 277.4 |      19.0 / 251.3 |
| Profiled time-driven tour     |       19.5 / 254.3 |      20.7 / 238.5 |
| Ordinary focused pointer drag |        22.3 / 32.2 |       19.4 / 37.0 |
| Profiled focused pointer drag |        20.8 / 47.1 |       19.3 / 26.9 |

Tours are time-driven ten-second UI trajectories, so slower cases visit different camera samples/visible subsets: 34/27 ordinary frames and 36/36 profiled frames, disabled/enabled. Their distributions are not fixed-workload speed ratios. The profiled tour median and ordinary drag p95 regress and remain reported. Cold overview still stalls: worst captured frame is 855.1/611.0 ms across the two disabled trials and 457.6/511.5 ms across the enabled trials.

The native-pointer drag runs in the same 2,400-node document after zooming to a readable scale. **45 cards and 42 edges are actually visible**, rather than all 2,400. Twenty outward/returning pointer steps must move the selected node and settle back; connected rendered endpoints are checked against current ports. All four cases report zero connection error. Sample counts are 25/26 ordinary and 26/25 profiled, disabled/enabled.

### Completion cadence and remaining work

A short `world.execute()` is not a presented frame. Ordinary overview completion intervals are **760.6/1,203.6 → 633.0/1,523.5 ms** p50/p95 in this software-rendered environment. Ordinary tour intervals are **131.8/963.8 → 310.7/1,009.9 ms**; ordinary drag intervals are **57.8/105.4 → 68.6/186.9 ms**. These include work/waits outside the measured execution boundary and do not show smooth interaction. No hardware GPU or presentation-timing attribution is available here.

In the enabled profiled overview, stroke submission still averages 4.8 ms and image-page submission 1.6 ms exclusive. The three slowest profiled navigation frames take 270.1/238.5/201.6 ms, with **211.1/187.9/111.5 ms in stroke submission** and **31.0/29.6/71.5 ms in planning**. Next work should address curve geometry rebuilding during zoom/visibility changes and investigate GPU completion/frame scheduling on representative hardware. Static drawcall reduction alone does not satisfy the interaction goal.

### Retained initial regression

The initial candidate reduced overview draws but made ordinary tour p95 **239.1 → 679.6 ms** and profiled tour p95 **257.2 → 647.0 ms**. The slowest profiled enabled frame spent **373.2 ms in planning** and **165.8 ms in image-page submission**. Repeated original-document raster-option lookups and releasing/reacquiring unchanged page textures caused this avoidable overhead.

The final implementation reuses raster descriptions and live texture leases. Its corresponding slow-frame costs fall to 31.0 ms planning and 5.1 ms image submission in the slowest profiled enabled tour frame. Both initial and corrected measurements, including remaining regressions, are preserved; no trial was discarded to select a favorable result.

## Validation

-   Core image contracts/lifecycle: 25 passed; ECS image/transition checks: 83 passed. An additional disabled-option metadata invalidation check also passed.
-   Chromium: all 24 selected browser cases passed. WebKit: all corresponding 24 cases passed on pinned Playwright 1.61.1, including actual WebGL1, mixed full/page sources, pixel equivalence, exports, borrowed/mutable/effect fallback and ownership teardown.
-   Both image shaders compile through the actual GLSL-to-WGSL compiler. Native WebGPU rendering was not available locally.
-   Native ECS hover/selection, undo/redo, camera migration, parent/affine placement, painter barriers, source changes, culling/reentry and same-frame deletion retain original geometry/data. Partial uploads/binding failures roll back resources; reordered palettes retain live leases and removed variants release immediately.
-   The real Workflow interaction suite passed 6/6. Renderer/browser/benchmark typechecks, changed-file lint, 42 tooling checks and normal commit hooks passed. Both initial and final paired/Workflow benchmark scripts passed all assertions.
-   Local Chromium is cached version 140; exact pinned Chromium is covered separately by PR CI. Headless WebKit WPE uses the verified bundled runtime with GUI-only host validation disabled; no cases or assertions are skipped. Hardware GPU validation and smooth-interaction acceptance remain outstanding.
