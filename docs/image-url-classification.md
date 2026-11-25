# Image-layer URL classification during batch planning

After #727, a separate diagnostic of the real 2,400-card + 2,400-edge Workflow
wheel path observed 15,218 fallback `URL` constructions per 20-input traversal,
although only six 63-character Blob URLs were involved. Each of two traversals
had the same count. The diagnostic wraps only the constructor calls with base
`https://local.invalid/`, used solely by `isLikelySvgResourceUrl`; its timings are
not used as performance results. The candidate makes zero such calls during both
post-load traversals. Classification still happens for each layer's first URL
and after URL changes.

## Scope and Core/ECS parity

ECS now keeps a weak fill-layer-keyed snapshot of the current raw URL and its SVG
classification. The same layer and URL reuse the Boolean, including `false`.
An in-place URL edit replaces the sole saved value; replacing a layer uses a new
key. No history of URL values is retained. The cache contains no entity, decoded
bitmap, GPU lease or scene snapshot. Weak keys follow the layer's existing lifetime.

Only URL syntax classification is reused. Every eligibility check still reads
current decoded-bitmap readiness/closure, fill count/type/blend, effects, geometry,
opacity and transform. The original URL detector, SVG fallback/rerasterization,
texture description/pool, GPU pages, culling, export, document and history paths
are unchanged. Missing and malformed URLs keep their previous full-path behavior.

Core's `eligibleImageRect` in `packages/core/src/utils/image-batching.ts` already
uses `ImageBitmap` directly and reads its current dimensions. It has no URL parsing
in this path, so its runtime needs no corresponding cache. Its regression now
warms eligibility before closing/replacing the bitmap and checking a singular
transform. Both backends run the same image/browser and performance workloads;
only ECS needs a package changeset for this optimization.

## Reproduction and source identity

```sh
pnpm test:ecs --runTestsByPath __tests__/ecs/image-batching.spec.ts __tests__/ecs/fill-image-svg-reraster.spec.ts --runInBand --coverage=false
pnpm test:browser image-batching.spec.ts image-sharing.spec.ts
pnpm test:browser:webkit image-batching.spec.ts image-sharing.spec.ts
pnpm bench:workflow-input
pnpm bench:image-batching
```

For comparisons, run each benchmark sequentially in control / candidate /
candidate / control checkouts. Use `WORKFLOW_INPUT_OUTPUT_DIR` for separate wheel
captures, `IMAGE_BATCH_BENCH_OUTPUT` for separate image JSON files, and
`WORKFLOW_CHROMIUM` to pin the same browser. The two ordinary benchmark scripts,
workloads, timing boundaries, assertions and observers are unchanged. Raw captures,
the ignored counting diagnostic, command logs and exact audit script are retained
in the private review bundle. No diagnostic timing is pooled into ordinary results.

Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1 were used on the shared
cloud host. Ordinary captures ran with no concurrent local checks and recorded
clean committed source:

| Variant | Commit | Tree |
| --- | --- | --- |

| Control | `7db938a28db6f0139688d3a443b0ace61727b27e` | `ef955492b5a21734d90b96b32a41b3f09542936f` |
| Candidate | `9b93c5f81917c49e918dedbdb13d693469b07b22` | `8f01a93722af30418140df7b34521da8b9860b60` |

The later report-only commit leaves the measured implementation unchanged.

## Real Workflow trusted-wheel input

Each fresh page loads 2,400 cards and 2,400 edges, then performs two 20-event trusted
wheel traversals from Overview. The outer viewport is 1,500 × 980; the canvas is
1,148 × 914. One engine execution completes each event. Engine time excludes the
subsequent membership/resource observer; input-to-frame ends at engine completion,
not physical presentation. Observer p50/p95 ranges 2.3–3.2 / 3.6–7.9 ms.
Workflow uses ECS; these timings do not describe a Core application.

| Capture | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input-to-frame p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| control-1 | 0 | 14.1 / 95.4 | 695.6 | 14.4 / 95.6 |
| control-1 | 1 | 14.7 / 69.5 | 574.2 | 14.9 / 69.8 |
| candidate-1 | 0 | 13.0 / 69.2 | 651.2 | 16.6 / 69.4 |
| candidate-1 | 1 | 17.4 / 53.5 | 479.5 | 17.9 / 53.6 |
| candidate-2 | 0 | 18.2 / 123.9 | 665.1 | 18.4 / 125.2 |
| candidate-2 | 1 | 13.9 / 67.2 | 569.1 | 14.2 / 67.4 |
| control-2 | 0 | 16.5 / 105.5 | 812.9 | 17.7 / 105.7 |
| control-2 | 1 | 18.3 / 73.9 | 584.1 | 18.6 / 74.1 |

Every corresponding step has exactly matching target views, one-execution count,
visible IDs, canvas surfaces, all native submission/upload counters, allocated
buffer bytes and live resource counts across all four captures. Visible cards and
edges each range 36–2,400; native work is 3–22 draws, 15,516–633,846 indices and four
array vertices. Allocated buffer bytes range 94,772–3,171,388. Full documents,
round GPU gates, injected-error positive control, synthetic-input rejection and
pending-input teardown pass.

Warm candidate input p95 is 53.6–67.4 ms versus 69.8–74.1 ms in these controls.
However, candidate first-traversal p95 reaches 125.2 ms; the first-traversal tail
and warm medians do not improve consistently. These samples show the repeated
parsing is removed, but do not establish stable smooth interaction or a general
speedup factor. The 2,400-node target remains open.

## Same qualified Core/ECS image workload

Each backend receives 1,000 visible ordered rectangles and six alternating immutable
PNG sources, with batching off/on in fresh pages. The viewport is 1,000 × 760 and
the canvas 1,000 × 720. Fifteen warmup pans precede 30 measured pans. Core synchronous
render and ECS complete awaited `world.execute` boundaries are retained separately.
Setup wall time is listed separately and is not a frame measurement.

| Capture | Backend | Batched | CPU p50 / p95 (ms) | Setup wall (ms) |
| --- | --- | --- | --- | --- |
| control-1 | core | no | 7.9 / 11.6 | 117 |
| control-1 | core | yes | 1.0 / 1.7 | 49 |
| control-1 | ecs | no | 15.3 / 18.2 | 487 |
| control-1 | ecs | yes | 3.0 / 14.8 | 306 |
| candidate-1 | core | no | 8.4 / 21.6 | 132 |
| candidate-1 | core | yes | 1.2 / 1.5 | 61 |
| candidate-1 | ecs | no | 16.6 / 26.1 | 455 |
| candidate-1 | ecs | yes | 2.4 / 3.1 | 255 |
| candidate-2 | core | no | 8.4 / 20.7 | 95 |
| candidate-2 | core | yes | 1.0 / 3.3 | 47 |
| candidate-2 | ecs | no | 12.4 / 17.7 | 384 |
| candidate-2 | ecs | yes | 3.7 / 18.7 | 272 |
| control-2 | core | no | 10.1 / 30.4 | 137 |
| control-2 | core | yes | 0.8 / 4.5 | 60 |
| control-2 | ecs | no | 14.9 / 20.5 | 471 |
| control-2 | ecs | yes | 2.7 / 4.1 | 272 |

Within each backend/mode, all four captures have identical pixel hashes, native
counters, visible count, allocated buffer bytes, live resource state and teardown.
The six-source workload uses 6,000 native indices and four array vertices per
measured pan in either mode; native buffer upload is 192 bytes. Batching uses five
draws; the full path uses 1,001. No parser reduction is claimed for unchanged Core
or batching-off controls.

| Backend | Batched | Buffer bytes | Live Buffers / Textures across probed contexts |
| --- | --- | --- | --- |
| core | no | 208228 | 4003 / 13 |
| core | yes | 82372 | 15 / 13 |
| ecs | no | 248308 | 3004 / 18 |
| ecs | yes | 82452 | 16 / 18 |

Core is a control for host variation here. ECS batched p95 varies 3.1–18.7 ms in
candidates versus 4.1–14.8 ms in controls, so this small scene does not demonstrate
a consistent frame-time improvement. All modes restore native ownership at
teardown, with no reported leak.

## Validation and limits

Passed locally:

- 23 Core image cases and 71 ECS image/SVG cases, including one classification
  per unchanged layer/URL, in-place edits, replacement layers, later decoding,
  closed/replaced bitmaps, dimensions, blend/enabled state, effects, singular
  transforms and malformed sources.
- 18 Chromium 149 and 18 WebKit paired image cases: pixels, painter order,
  affine/source/style edits, WebGL1, hover/selection, history, camera migration,
  full exports, culling/reentry, same-frame deletion, runtime disable, borrowed
  and mutable fallbacks, multi-page peers and native teardown.
- Four ordinary trusted-wheel and four paired image captures, with the exact
  rendering/resource parity above.
- Repository zero-warning ESLint, both package no-emit typechecks, both browser
  and Workflow benchmark TypeScript projects, 48 tooling cases and Markdown checks.

Installed Node CLIs were used directly; the installed pnpm is 11 and the repository
requests 9.15.9. WebKit uses the environment's existing host-requirement precheck
override, with real assertions unchanged. Generated Husky helpers are absent, so
checks ran explicitly before committing. Full package/site builds, complete test
suites, physical-device presentation and sustained wheel/pinch gestures were not
run locally. GPU probes establish native resource behavior; no whole-heap byte
saving is claimed for the weak classification cache.

The next profiling pass should inspect remaining per-visible-entity component
reads and batch-plan work, plus curve sampling on precision misses. Preserve the
current same-workload Core/ECS controls and exact visibility/native-work checks.
