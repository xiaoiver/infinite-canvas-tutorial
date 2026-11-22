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

## Validation and remaining blocker

Source and benchmark typechecks, repository lint, four Core suites (22 tests), four ECS suites (82 tests), image/legacy-image browser regressions (five tests), both benchmark protocols and the workflow production build passed in the original Node 24/Chromium 140 SwiftShader environment. The six-test workflow interaction suite also passed. The complete local tooling run had 37 passes and four failures from unavailable cached workspace dependencies. Full native snapshot suites could not run there because the headless-gl binding was unavailable.

GitHub CI has subsequently passed the full Core/ECS native suites, all Chromium browser shards, the other WebKit groups, documentation/preview builds and dependency audit on published candidate heads. **The new ECS image-sharing WebKit regression is still failing, so this draft is not ready to merge.** Fresh checks on the final branch head remain authoritative.

The test replays private uploads and shared uploads serially, requiring complete pixel equality, nonblank alpha-bearing content, full and node PNG exports, edits, culling reentry, owner deletion, batchable reconstruction, borrowed texture ownership and GPU teardown. ECS captures native default-framebuffer RGBA only after a complete world execution containing a fresh main-context draw. Temporary observers restore the original method and unsubscribe on completion, failure or destruction. Core captures synchronously after an unchanged camera projection redraw because its drawing buffer is not preserved. No case, pixel assertion or export assertion is skipped.

The export helper retains the one-frame `Screenshot` result and waits for both `Screenshot` and `RasterScreenshotRequest` to retire before starting another export. The former helper could time out when the previous export coroutine removed a following node export. This is a test synchronization correction, with no renderer export change.

The paired fixture preloads immutable PNG snapshots through the normal ECS platform URL decoder. Historical paired timing data used canvas-created snapshots; real-workflow measurements always used the workflow's unchanged PNG URL path. No new timing benefit is inferred from fixture changes.

### Reproducing the outstanding WebKit failure

The original executor disconnected. A temporary Vercel Sandbox running Docker reproduced the failure with the exact CI browser image, `mcr.microsoft.com/playwright:v1.55.1-noble` (digest `sha256:2f29369043d81d6d69a815ceb80760f55e85f5020371ad06a4d996f18503ad1c`). Install the frozen lockfile and run:

```sh
pnpm exec playwright test -c playwright.webkit.config.ts __tests__/browser/image-sharing.spec.ts --grep "ecs shares"
```

The private-upload control fails its first nonblank screen assertion with seven colored opaque pixels, before shared mode starts. Native draws are submitted, the WebGL error is zero, and the backing size and viewport are 1,000 × 720. Traces also show the small visible region; this is not established to be a PNG encoder fault. Per-draw inspection found the empty scene intact and the first background draw after inserting an image still covering the sampled points; the next background draw lost the outer pixels.

Replacing only ECS `SDF.ts` and `Drawcall.ts` with their merged-master versions at `d92ff52c8a7aefd5181bf28da9c5076ed9fe1cff`, while keeping the same fixture, reproduced the same seven-pixel failure. This establishes that the test also exposes a problem without the new texture-sharing implementation; it does not yet establish the root cause or an upstream browser defect. Shared-memory sizes of 64 MB and 1 GB both failed. Unsuccessful diagnostic upload/context/viewport experiments are not retained in product code or CI jobs. The nonblank assertion remains mandatory.

A separate ignored diagnostic copy using Playwright 1.65.0 and its matching WebKit 2388 browser image completed the same ECS private/shared replay: **17 checkpoints per mode**, texture counts 19 versus 9, exact pixel/export comparisons and zero tracked GPU leaks. It retained the 1,000 × 760 mobile viewport and DPR 3. The image digest was `sha256:9beb546099e11f52d62e505537914870e01a67e0e6b00ae41da4775324e73dbe`. Running the old WebKit 2203 binary with the old 1.55.1 client inside that newer image still produced seven colored pixels. This narrows the failure to the older browser/client combination rather than simply the image's host libraries; it does not identify the upstream defect. This newer-environment result is diagnostic only: repository Playwright versions and the CI image remain unchanged, and the current CI failure still blocks this draft.

After this blocker is resolved, investigate curve/image batching in **both Core and ECS** against the real workflow workload, preserving painter order, intersections, picking, selection, drag feedback, history and full-precision export. Texture sharing leaves 4,802 draws and the dominant curve submission cost. Smoothness acceptance still needs fixed hardware, browser, refresh rate, viewport and DPR, measured presentation cadence and input feedback. **The 2,400-node smooth-interaction target has not yet been reached.**
