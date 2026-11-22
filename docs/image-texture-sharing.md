# Immutable image texture sharing in Core and ECS

Repeated immutable image snapshots now share a device-scoped, reference-counted GPU texture across SDF image drawcalls in both renderers. In the actual [workflow canvas](https://infinitecanvas.cc/example/workflow-canvas), **2,400 visible cards and 2,400 visible cubic edges remain present**: main-context textures fall from **2,408 to 14**. This reduces resource allocation and the measured cold-entry stall; it does **not** establish a steady-frame speedup or smooth interaction. The existing runtime LOD defaults do not change.

## Ownership and scope

The key uses the actual decoded native `ImageBitmap` identity and GPU device, never just a URL. ECS also includes target pixel dimensions, decoded intrinsic dimensions, object-fit, object-position and DOM rasterizer identity. Different source generations, devices or raster variants cannot share a texture. Each drawcall holds a lease; the final release destroys the texture immediately and removes the entry. Failed uploads destroy their allocated texture and publish no pool entry. Released leases are idempotent. There is no retained GPU image cache after the last owner leaves.

This first step covers SDF primitive image fills (Rect, Circle and Ellipse). Core uploads the immutable snapshot directly. ECS shares only the single, unfiltered image-layer path; filters, clips/stencil, wireframe, node blend processing and multi-fill composition keep their existing private paths. Mesh/Path image fills are unchanged. Canvas, video, ImageData, mutable HTML images, closed bitmaps and sources not recognized as native ImageBitmap keep private uploads. Snapshot replacement does not mutate a peer's old texture. Existing per-entity SVG reraster scheduling still runs when a texture is shared.

Caller-provided GPU textures remain borrowed. Core previously destroyed these handles; this change fixes that ownership error and tests that only the caller destroys them. Core material rebuilds release the former owned image texture. ECS material rebuilds retire the cached non-instanced binding before acquiring the next image, so reusing the same texture descriptor cannot resurrect a destroyed binding. ECS also matches Core's retired-drawcall submission guard: an old queued drawcall cannot recreate geometry/material resources after destruction.

This is texture sharing, not drawcall merging. Existing batching and painter order remain in effect. Core may already batch compatible shapes using the same ImageBitmap under its default `batchable: true`; the controlled independent-image benchmark explicitly uses `batchable: false` in both renderers. Tests also cover `batchable: true` pixel equivalence. The workflow example retains its existing independent image drawcalls.

## Reproduction and measurement boundaries

```sh
pnpm exec tsc -p __tests__/browser/tsconfig.bench.json
IMAGE_SHARING_BENCH_OUTPUT=.test-results/image-textures.json pnpm bench:image-textures
WORKFLOW_BENCH_OUTPUT=.test-results/image-workflow.json pnpm bench:workflow
```

Run benchmarks serially. The paired image diagnostic uses fresh private-upload and shared pages on the **same candidate source**, two immutable 64 × 48 snapshots and 1,000 actually visible image Rects, 15 warmup and 30 measured pan frames. Only that test fixture disables pool sharing to construct the private reference; this is not a public feature switch. The paired fixture supplies known decoded snapshots; the separate workflow diagnostic uses the real example's unmodified URL decode path. Exact RGBA, nonblank content, native work, GPU errors, teardown and instrumentation restoration are asserted.

Chromium 140.0.7339.186, Node 24.22.3, SwiftShader and DPR 1 were used. The image viewport is 1,000 × 760 (canvas 1,000 × 720); the workflow viewport is 1,500 × 980 (canvas 1,148 × 914). Image Core timing measures synchronous render work, excluding rAF waits. Image ECS and workflow timing cover complete asynchronous `world.execute()` calls, including native blocking and waits. These are elapsed CPU-side frame measurements, not pure JavaScript cost or GPU timers. Do not compare Core and ECS timings as the same boundary.

[Machine-readable results](./image-texture-sharing-benchmark.json) preserve all elapsed samples, actual counts, native-work histograms, phase means, checksums, teardown records and raw-file hashes. Workflow baseline `bd7a9a7` has tree `8afdef86eb04b3c17591dc7272fda6682e73fec2`, identical to merged #701 (`d92ff52`). Initial candidate `5cd0df8` has tree `b9c09d252cc8641d9a04aec927f919d838626609`. Final candidate `c0deb3d` adds only the retired ECS drawcall guard and its regression; its tree `e0c0741ddaa682c7699c2fc884d1af64c5d5764d` was published unchanged as `a74080e`. All measured trees were clean. The paired run uses that final published source. Documentation-only commits do not change renderer code.

## Paired independent-image control

| Backend / mode           | Visible images | Textures | Frame p50 / p95 ms | Setup wall ms |
| ------------------------ | -------------: | -------: | -----------------: | ------------: |
| Core / private reference |          1,000 |    1,007 |          5.7 / 9.9 |         190.3 |
| Core / shared            |          1,000 |        9 |         5.6 / 11.4 |         115.9 |
| ECS / private reference  |          1,000 |    1,007 |        15.6 / 19.5 |         916.2 |
| ECS / shared             |          1,000 |        9 |        15.7 / 21.8 |         506.4 |

Each of the 30 frames in each case submits 1,001 draws, 6,000 indices, four array vertices and one 192-byte uniform upload. Each main context retains 3,003 buffers, two programs, four shaders, two VAOs and six framebuffers. Allocated buffer bytes remain 248,228 in Core and 248,308 in ECS. Private/shared pixels match exactly within each backend. No steady speedup is claimed; both p95 values increased in this trial. Setup includes fixture scene creation and settling, not just texture upload.

ECS also has its existing separate offscreen context (one buffer, five textures, six framebuffers). After teardown it releases every tracked GPU resource. The external Core device retains its initialization fallback resources (one buffer, five textures); teardown returns exactly to that captured baseline, as in the existing mixed-renderer harness. Neither renderer destroys caller-owned textures, and instrumented methods are restored.

## Real 2,400-card workflow

| Main-context work / resource    |           Baseline | Both candidate trials |
| ------------------------------- | -----------------: | --------------------: |
| Actual visible cards / edges    |      2,400 / 2,400 |         2,400 / 2,400 |
| Document entities               |              4,801 |                 4,801 |
| Drawcalls / indices             |    4,802 / 614,406 |       4,802 / 614,406 |
| Array vertices / uniform upload |          4 / 192 B |             4 / 192 B |
| Live buffers / allocated bytes  | 19,206 / 4,051,756 |    19,206 / 4,051,756 |
| Live textures                   |              2,408 |                    14 |
| Programs / shaders / VAOs       |          3 / 6 / 3 |             3 / 6 / 3 |

The separate offscreen context remains at one buffer, five textures and six framebuffers. Original probe labels call both contexts `offscreen`; results preserve creation order, with the main renderer second. Every run reports GL error zero and passes method restoration and tracked resource teardown.

Steady overview warms five frames and measures 30. Both candidate trials are retained, including regressions:

| Complete ECS frame, ms | Baseline p50 / p95 | Initial candidate p50 / p95 | Final candidate p50 / p95 |
| ---------------------- | -----------------: | --------------------------: | ------------------------: |
| Ordinary               |      555.8 / 801.4 |               720.6 / 797.0 |             745.6 / 855.9 |
| Profiled               |      504.1 / 726.9 |               771.7 / 853.6 |             603.7 / 814.1 |

**Steady overview did not improve in these trials.** The slowest captured cold-overview frame falls from 12,326.5 ms to 917.4 / 1,015.4 ms in the ordinary pages, and from 14,313.1 ms to 838.8 / 959.0 ms in the fresh profiled pages. Phase instrumentation is disabled during both cold captures. These are single cold trials per page, not a distribution of repeated cold loads.

The example's own elapsed-time tour reports a different window:

| Approximately 10-second tour | Baseline FPS / p95 ms | Initial candidate FPS / p95 ms | Final candidate FPS / p95 ms |
| ---------------------------- | --------------------: | -----------------------------: | ---------------------------: |
| Ordinary                     |           4.4 / 384.1 |                    5.2 / 275.1 |                  2.2 / 356.9 |
| Profiled                     |           3.0 / 326.0 |                    3.7 / 596.5 |                  5.5 / 247.6 |

Slower frames skip intermediate camera views because the tour advances by elapsed time. Driver captures include click/result observation and view restoration waits; they have separate samples and must not replace the UI tour figures. This variance does not establish a navigation FPS benefit. The final profiled steady run spends mean exclusive 394.2 ms in SmoothPolyline submissions and 49.5 ms in SDF submissions; native blocking inside those calls is included. That identifies the next area to investigate, not pure GPU cost.

## Validation and next step

Local source/benchmark typechecks, repository lint, four Core suites (22 tests), four ECS suites (82 tests after adding the retirement case), image/legacy-image browser regressions (five tests), both benchmark protocols and the workflow production build pass. The unchanged six-test workflow interaction suite covers zoom, drag and curve endpoints, scale transitions, tour cancellation, narrow screens, settings and export. A local pnpm launcher mismatch required invoking the same Vite binary directly with an ignored test config; project configuration is unchanged.

The complete tooling run has 37 passes and four failures from missing cached workspace dependencies (`unplugin-vue-macros`, `shadcn`, `zod`), including SDK Hono dependency resolution. All nine browser CI partition/reporting tests pass. Local full native snapshot suites and WebKit are not run: this Node 24 environment lacks the headless-gl native binding and WebKit. GitHub CI on the published PR head is the remaining validation source; do not treat this local list as an all-green CI claim. Documentation-site iframe tests are not rerun locally in this resource-only change.

Next, investigate image/curve batching against this same real workload in both Core and ECS, preserving painter order, intersections, picking, selection, drag feedback, history and full-precision export. Texture sharing establishes safe ownership but leaves 4,802 draws and the curve submission cost. Final smoothness acceptance still needs fixed hardware, browser, refresh rate, viewport and DPR, measured presentation cadence and input feedback. **The 2,400-node smooth-interaction target has not yet been reached.**
