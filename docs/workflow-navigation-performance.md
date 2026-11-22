# Workflow navigation at 2,400 nodes

The performance acceptance workload is the real [workflow canvas](https://infinitecanvas.cc/example/workflow-canvas): **2,400 image cards and 2,400 cubic edges**, plus one selection rectangle (4,801 document entities). All cards and edges must remain visible in overview. Navigation, selection, dragging connected cards, document data and full-precision export must stay correct. Reducing document counts or silently hiding visible content does not meet this target.

This first change removes an ordinary Path's unused transparent fill channel in **Core and ECS**. ECS represents the public `fills: []` form by omitting `FillLayers`; both absent and empty/all-disabled layers are unpainted. Core's corresponding case is `fill: 'none'`. Masks/clipping, effects, external fill textures, wireframes and rough/custom geometry keep their existing fill renderer. Filled Paths keep their full path. Runtime LOD switches and their defaults do not change.

The browser transition regression also exposed a VAO binding inconsistency in the local device backend. Creating an input layout now restores the device's previously bound VAO rather than leaving native GL at null while its cache still names another layout. WebGL1/2 tests exercise creation followed by a cached submission. Core uses the external device package; its equivalent empty-fill, transform, zoom and export cases are tested separately.

## Measurement

Reproduce from the repository root:

```sh
pnpm exec tsc -p examples/workflow-canvas/tsconfig.bench.json
WORKFLOW_BENCH_OUTPUT=.test-results/workflow-navigation.json pnpm bench:workflow
EDIT_PHASES_BENCH_OUTPUT=.test-results/edit-phases.json pnpm bench:edit-phases
```

[Machine-readable results](./workflow-navigation-benchmark.json) contain provenance, every measured elapsed sample, native-work histograms, resource counts, phase means and raw-file hashes. The baseline diagnostic tree is `162b3459aad4df664019b7855bb41ca54a49fe28` (published as `6a6a009`); the optimized tree is `b6a4df98b14d11fa957aa75772b850f4a03028b6` (published as `3899fc2`). The local measured commits have identical respective trees; publication changed commit metadata, not source contents.

Chromium 140.0.7339.186, Node 24.22.3, SwiftShader, viewport 1,500 × 980, actual canvas 1,148 × 914 CSS px, DPR 1. Each steady case warms five frames and records 30 complete `world.execute()` calls. Actual ECS culling state confirms 2,400 visible cards and 2,400 visible edges. Ordinary and profiled cases use fresh pages; the synchronous phase wrappers are enabled only for the profiled case. These elapsed times include native blocking and asynchronous waits; they are not pure JavaScript CPU time or GPU timer measurements.

The diagnostic entry is separate from `main.ts`. Normal example build output was checked for absence of the benchmark hooks. Both before/after workflow runs completed their method-restoration and tracked GPU-resource teardown assertions.

## Real overview results

| Per-frame work / main-context resource |    Before |     After |
| -------------------------------------- | --------: | --------: |
| Drawcalls                              |     7,202 |     4,802 |
| Submitted indices                      |   638,406 |   614,406 |
| Array vertices                         |         4 |         4 |
| Uniform upload                         | 1 × 192 B | 1 × 192 B |
| Live buffers                           |    26,406 |    19,206 |
| Allocated buffer bytes                 | 4,678,956 | 4,051,756 |
| Live textures                          |     2,408 |     2,408 |
| Programs / shaders / VAOs              | 4 / 8 / 4 | 3 / 6 / 3 |

The other tracked offscreen context remains at one buffer, five textures and six framebuffers. The existing probe labels both contexts `offscreen`; the JSON preserves those original labels and creation order. The latter entry is the example's main rendering context. Teardown assertions cover the native resource kinds tracked by the probe.

| Complete ECS frame, ms   | Before p50 / p95 | After p50 / p95 |
| ------------------------ | ---------------: | --------------: |
| Ordinary steady overview |  792.0 / 1,346.0 |   764.8 / 856.3 |
| Profiled steady overview |  732.8 / 1,256.9 |   246.4 / 770.9 |

The slowest cold overview frame was **12,294.3 → 14,152.0 ms** in the ordinary trial and **13,571.7 → 12,934.5 ms** in the fresh profiled trial (instrumentation is still off during both cold captures). Cold resource creation remains a serious stall. Do not fold these frames into a steady-state figure or hide them as warmup.

The example's own time-based navigation tour reported:

| Approximately 10-second tour | Before FPS / p95 ms | After FPS / p95 ms |
| ---------------------------- | ------------------: | -----------------: |
| Ordinary                     |         5.0 / 336.0 |        4.5 / 355.0 |
| Profiled                     |         3.8 / 830.5 |        3.7 / 384.6 |

The tour advances by elapsed time, so slower frames skip intermediate views. These are not identical per-frame workloads. Its UI report covers its own tour window; raw driver `time-driven-tour` captures also include click/result-observation and view restoration waits. The JSON keeps their separate boundaries. The difference between ordinary and profiled runs is another reason to avoid claiming a whole-frame speedup from one sample set. Native work and buffer reductions are deterministic here; **smooth interaction has not been achieved in this software-rendered environment**.

## Core and ECS full-path control

The same existing mixed-renderer edit benchmark runs on both backends: 1,000 actually visible objects, 200 full text labels, 10 edited nodes/frame, 15 warmup + 30 measured frames, text batching off/on, screen LOD and Path instancing off. Its Paths are solid-filled, so this change should preserve their full drawing work. Before/after native counters, resources and allocated buffer bytes match exactly in every mode. All cases restore original methods, report GL error zero and pass teardown checks.

| Backend / text batching | Ordinary before p50 / p95 ms | Ordinary after p50 / p95 ms | Drawcalls before / after |
| ----------------------- | ---------------------------: | --------------------------: | -----------------------: |
| Core / off              |                   6.5 / 10.5 |                  8.1 / 14.2 |                603 / 603 |
| Core / on               |                   8.8 / 17.0 |                  8.9 / 13.9 |                407 / 407 |
| ECS / off               |                  24.0 / 32.4 |                 23.0 / 32.3 |                602 / 602 |
| ECS / on                |                  23.0 / 30.0 |                 21.6 / 32.9 |                407 / 407 |

The JSON also reports profiled results separately. These control measurements use their existing fixture CPU boundaries, which differ from the complete asynchronous workflow frame. No CPU speedup is claimed for this unaffected filled-Path workload.

## Remaining work and acceptance

The six cached PNG/Blob URL sources still result in approximately one GPU texture per card. Next, evaluate device-scoped, reference-counted sharing of immutable raster-image textures in Core and ECS, preserving raster size, object-fit, alpha, edits, exports and peer ownership. Then use this same workload to prioritize image and curve batching while preserving painter order and interaction geometry. Small-text LOD alone cannot help the card labels: they are already baked into the card images.

Final smoothness acceptance still needs a fixed target machine, browser, viewport, DPR and refresh rate. Check sustained zoom/pan presentation cadence, long frames, cold entry and input-to-visible feedback on that hardware, alongside the functional regressions. SwiftShader measurements identify work and resource pressure; they cannot certify hardware-accelerated interaction on the user's device.
