# Native stroke page packing in Core and ECS

The post-#726 trusted-wheel profile still samples `packStrokeInstances` while
visible stroke pages change. A local CDP diagnostic attributed about 16 and 28 ms
of self samples to it over the two 20-input traversals. These are qualitative
samples from a separately instrumented run, not frame-time measurements.

Both renderers now advance page offsets directly, copy the fixed four-triple
native window explicitly, read placement once per path, and copy each path's
travel stream contiguously. This removes the nested 12-element copy loop and
repeated placement reads. Core retains travel stride 1; ECS retains stride 3.
The point windows, flags, path boundaries, depth and float32 conversion are
unchanged, including partial windows and missing travel values.

Every call still allocates two fresh exact-size arrays. No GPU buffer, cache,
shader, eligibility, culling, export, document or scheduling policy changed.
A shared contract and independent row oracle verify byte equality, sparse and
partial inputs, immutable sources and independent previous snapshots in both
implementations. Existing browser checks exercise actual drawcalls and ownership.

## Reproduction and source qualification

```sh
mkdir -p .test-results
git worktree add --detach ../stroke-page-reference b7029098d702ad383a2346190e25cd97c9bfe289
node scripts/bench-stroke-packing.cjs ../stroke-page-reference .test-results/packing.json
pnpm bench:workflow-input
pnpm bench:camera-replay
```

For comparisons, use the same browser executable and run each existing benchmark
sequentially in control / candidate / candidate / control checkouts. The stroke
capture is `playwright.camera-replay-bench.config.ts`; the broader
`bench:camera-replay` command also runs the separate legacy Workflow replay.
Set `WORKFLOW_INPUT_OUTPUT_DIR` or `CAMERA_REPLAY_OUTPUT_DIR` per capture, and
`WORKFLOW_CHROMIUM` when pinning the browser.

These results used Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader and DPR 1
on the shared cloud host. Every ordinary capture recorded clean committed source:

| Variant | Commit | Tree |
| --- | --- | --- |
| Control | `b7029098d702ad383a2346190e25cd97c9bfe289` | `4643efe3d1c5096ad666bfac7b132064e7aee19b` |
| Candidate | `b7e74758948f1447d2d0c04730df90c2ae4c3d8a` | `554c974ee8b3ba4ecf6ce165baa6a41cc2376cc4` |

The later report-only commit leaves the measured implementation unchanged.
Raw captures, CDP profiles, command logs and the exact parity audit are retained
with the private review bundle. Phase wrappers and CDP were off in all ordinary
captures. No measurements from the diagnostic profile are pooled below.

## CPU-only packing diagnostic

Each page has 256 independent paths. Each variant receives 400 warmup calls,
then 16 alternating samples of 400 fresh allocations. Times include allocation
and GC; p95 is the largest of these 16 sample means, not an individual-call tail.
Mixed pages deterministically contain 2–48 rows per path. The script verifies
exact byte parity before timing and records both source identities.

| Backend | Rows/path | Control p50 / p95 (ms/page) | Candidate p50 / p95 (ms/page) |
| --- | --- | --- | --- |
| core | 2 | 0.012 / 0.106 | 0.010 / 0.055 |
| core | 12 | 0.081 / 0.172 | 0.059 / 0.116 |
| core | 48 | 0.285 / 0.568 | 0.215 / 0.441 |
| core | mixed | 0.146 / 0.245 | 0.106 / 0.123 |
| ecs | 2 | 0.012 / 0.032 | 0.011 / 0.037 |
| ecs | 12 | 0.080 / 0.103 | 0.067 / 0.075 |
| ecs | 48 | 0.331 / 0.469 | 0.259 / 0.329 |
| ecs | mixed | 0.168 / 0.292 | 0.130 / 0.286 |

This establishes a local packing reduction, strongest for longer and mixed pages.
The two-row ECS tail did not improve. It does not establish an application speedup.

## Real 2,400-card + 2,400-edge Workflow wheel input

This is the unchanged trusted-input benchmark from `docs/workflow-input-benchmark.md`,
with early navigation from #726: 20 trusted wheel events per traversal, two
traversals per fresh page, 1,500 × 980 outer viewport and 1,148 × 914 canvas.
One engine execution completes each input. Engine CPU timing excludes the following
membership/resource observer; input-to-frame ends at completed engine execution,
not physical display presentation. Observer p50/p95 was 2.2–3.6 / 3.4–7.7 ms.
This example uses ECS and is not evidence of Core application performance.

| Capture | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input-to-frame p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| control-1 | 0 | 21.1 / 90.4 | 870.7 | 21.4 / 90.6 |
| control-1 | 1 | 18.6 / 60.9 | 602.3 | 20.6 / 61.1 |
| candidate-1 | 0 | 31.9 / 122.6 | 1025.4 | 32.5 / 123.1 |
| candidate-1 | 1 | 21.7 / 72.9 | 592.3 | 23.9 / 73.1 |
| candidate-2 | 0 | 18.0 / 109.6 | 857.4 | 18.2 / 109.8 |
| candidate-2 | 1 | 14.9 / 78.0 | 633.7 | 15.1 / 78.3 |
| control-2 | 0 | 16.6 / 106.9 | 808.4 | 17.0 / 107.1 |
| control-2 | 1 | 15.7 / 76.7 | 558.9 | 15.8 / 76.8 |

All four captures and both traversals have exactly matching target views, visible
IDs, canvas surfaces, all native submission/upload counters, allocated buffer bytes
and live resource counts at corresponding steps. Visible cards range 36–2,400;
visible edges 36–2,400. Native submissions are 3–22 drawcalls, 15,516–633,846
indices and four array vertices. Live allocated buffer bytes range 94,772–3,171,388.
Full documents remain equal, round GPU error gates pass, the injected-error
positive control is detected, synthetic wheel input is rejected and teardown
with pending input reports no leak.

There is no consistent end-to-end improvement. Warm candidate input p95 is
73.1–78.3 ms versus 61.1–76.8 ms in controls. Keep this as a local packing change;
do not claim that 2,400-node interaction is now smooth or quote a speedup factor.

## Same qualified 2,400-stroke Core/ECS trace

The unchanged fixed trace has 12 views, two traversals, an 800 × 600 canvas,
overview/detail, offscreen culling, reentry and idle steps. Each backend receives
the same geometry, trace and source variants. Core synchronous and ECS awaited
operation boundaries are retained separately. Idle steps are included; with only
12 poses, p95 is the maximum pose time. These timings are not mixed with trusted
Workflow input. Observer p50/p95 is 0.1–0.2 / 0.2–3.7 ms for Core and
0.5–0.7 / 0.7–1.6 ms for ECS.

| Capture | Backend | Traversal | Engine p50 / p95 (ms) | Operation-to-frame p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| control-1 | core | 0 | 15.3 / 83.8 | 15.3 / 83.9 |
| control-1 | core | 1 | 16.8 / 42.1 | 16.8 / 42.1 |
| control-1 | ecs | 0 | 16.3 / 76.6 | 20.8 / 88.1 |
| control-1 | ecs | 1 | 13.1 / 59.8 | 19.7 / 61.4 |
| candidate-1 | core | 0 | 10.1 / 109.7 | 10.1 / 109.7 |
| candidate-1 | core | 1 | 16.9 / 26.3 | 16.9 / 26.3 |
| candidate-1 | ecs | 0 | 11.2 / 95.6 | 19.8 / 100.4 |
| candidate-1 | ecs | 1 | 13.1 / 48.8 | 17.8 / 54.1 |
| candidate-2 | core | 0 | 19.6 / 95.7 | 19.6 / 95.7 |
| candidate-2 | core | 1 | 15.8 / 24.9 | 15.8 / 24.9 |
| candidate-2 | ecs | 0 | 15.2 / 77.5 | 25.0 / 92.9 |
| candidate-2 | ecs | 1 | 15.5 / 69.6 | 22.0 / 85.3 |
| control-2 | core | 0 | 11.9 / 115.8 | 11.9 / 115.8 |
| control-2 | core | 1 | 15.5 / 25.8 | 15.5 / 25.8 |
| control-2 | ecs | 0 | 16.4 / 101.5 | 26.8 / 113.4 |
| control-2 | ecs | 1 | 12.2 / 64.2 | 20.5 / 64.8 |

Within each backend and traversal, all four captures have exactly matching target
views, visible indices, canvas surfaces, stroke-page counts, all native counters
and live resources. Visibility ranges 0–2,400, native draws 0–11, native indices
0–999,000 and array vertices 0–4. Documents and teardown pass. Both existing
`compare-camera-replay.mjs --require-native-parity` comparisons pass. Tail results
vary by capture and backend, so no stable whole-trace speedup is claimed.

## Validation and remaining work

Passed locally:

- 32 Core/pure packing unit cases and 17 ECS stroke unit cases.
- 16 Chromium 149 and 16 WebKit paired browser cases: pixels, precision revisits,
  ordering, caps/joins, style edits, picking, transforms/history, camera migration,
  WebGL1 attributes, full raster exports, culling/reentry, same-frame removal,
  fixed/transient camera replay and native resource teardown.
- Four ordinary trusted-wheel and four paired Core/ECS stroke benchmark captures;
  exact native-work/membership/resource parity at every corresponding pose.
- Repository zero-warning ESLint, both package no-emit typechecks, browser and
  Workflow benchmark TypeScript projects, 48 tooling cases and Markdown checks.

The installed pnpm is 11 while the repository requests 9.15.9; installed Node
CLIs were used directly. WebKit uses the environment's existing host-requirement
precheck override, with real assertions unchanged. The checkout lacks generated
Husky helpers; the listed checks ran explicitly before committing. Full package
and site builds, complete unit/browser suites, physical-device GPU/presentation
measurements and sustained wheel/pinch gestures were not run locally.

The next investigation should target remaining per-visible-entity classification
and batch-plan work, including image URL/eligibility lookups, and curve sampling
on precision misses. Preserve the current visibility/native-work controls and
continue to test Core/ECS together. The user-visible 2,400-node smoothness target
remains open; this patch reduces one measured CPU kernel only.
