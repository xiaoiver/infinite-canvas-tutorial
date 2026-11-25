# Exact Bezier subdivision with fewer temporary arrays and comparisons

This follow-up to #729 targets render-time curve subdivision in Core and ECS.
Both implementations use the same changes:

- Build the quadratic/cubic de Casteljau midpoint triangles directly. Preserve
  the same midpoint operations, control ordering and left-first traversal. Each
  cubic split avoids three temporary rows plus their three slices; a quadratic
  split avoids two rows plus two slices. Point tuples and child controls remain
  independently allocated.
- Compare only the diagonal and upper triangle of the symmetric tangent-pair
  matrix. `angle(a,b)` and `angle(b,a)` have the same numeric operands. Keep every
  diagonal because its rounding can matter at tiny angle limits, and retain the
  original `<=` comparison, including its nonfinite behavior. A straight cubic
  span needs nine acos calls including limits/end checks instead of twelve;
  a quadratic needs six instead of seven.

Flatness, angle/end limits, the 0.25 physical-pixel error budget, depth/segment
caps, seam merging, endpoints, cache/hysteresis policy and ellipse/line paths are
unchanged. Logical `Curve.getPoints/getLength`, text layout, authored data,
history, picking, culling and export policies retain their existing paths. No
retained cache, dependency, shader or GPU storage policy is added.

## Exact samples and reproduction

Before editing the sampler, the old implementation produced the checked-in
Float64 corpus in `__tests__/fixtures/bezier-subdivision.json`. Its public baseline
is merged #729; the recorded adaptive-file blob identifies the original source.
The corpus contains 64 independent quadratic/cubic paths: loops, reversals,
inflections, straight/repeated controls, signed zeros, large-coordinate Float32
collapse and fixed-seed cases. Six scale/radius combinations total **339,843
points per implementation**, including depth/segment-budget stress. Tests and the
benchmark require identical per-path counts and Float64-coordinate hashes, with
frozen source controls/paths. Existing screen-error and immutable-length tests
also pass in both backends.

```sh
mkdir -p .test-results
git worktree add --detach ../bezier-subdivision-reference f091d0bb15642b093f97833abe4180a426f6eab4
node scripts/bench-bezier-subdivision.cjs ../bezier-subdivision-reference .test-results/kernel.json
pnpm test:browser path-rendering.spec.ts path-instances.spec.ts core-path-instances.spec.ts stroke-batching.spec.ts camera-replay.spec.ts
pnpm test:browser:webkit path-rendering.spec.ts path-instances.spec.ts core-path-instances.spec.ts stroke-batching.spec.ts camera-replay.spec.ts
pnpm bench:workflow-input
pnpm bench:camera-replay
```

Use separate `WORKFLOW_INPUT_OUTPUT_DIR` and `CAMERA_REPLAY_OUTPUT_DIR` captures and
pin `WORKFLOW_CHROMIUM`. The stroke configuration is
`playwright.camera-replay-bench.config.ts`; the broader `bench:camera-replay` command
also runs the separate legacy Workflow replay. Existing real-input/paired scripts,
observers, assertions, timeouts and measurement boundaries are unchanged.

Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader and DPR 1 were used on the
shared cloud host. No other local suites ran during formal timing. Each render
workload ran control / candidate / candidate / control in fresh pages. All formal
captures record clean committed source:

| Variant | Commit | Tree |
| --- | --- | --- |

| Control | `f091d0bb15642b093f97833abe4180a426f6eab4` | `56144bc99b16153ac43d40567cc4ee4b55ed0cb7` |
| Candidate | `3c1194cd46ec9d4a201f7c14c0c07fea1a17a8b1` | `f085189b027858fa8471ecbb6e566bb507d79f44` |

The later report-only commit leaves measured production/tests unchanged. Raw
captures, source identities, producers/analysis and command logs are retained in
the private review bundle. A separate initial four-variant pilot and geometry-work
diagnostic are not pooled into formal timing.

## CPU-only sampling kernel

The reproducible Node script compiles the pure curve graph in the same realm,
constructs 64 frozen paths before timing, validates all baseline hashes, then
performs 40 warmup batches and twelve alternating samples of twenty fresh sampling
batches. Times are milliseconds per 64 paths, including allocation and GC;
parsing, cache lookup and GPU work are excluded. p95 is the maximum of twelve
sample means, not an individual-call tail or application FPS.

| Backend | Scale / radius | Points | Control p50 / p95 (ms) | Candidate p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| core | 0.0625 / 0.125 | 1116 | 0.870 / 1.377 | 0.581 / 1.082 |
| core | 0.5 / 1 | 2190 | 1.456 / 1.528 | 0.931 / 1.018 |
| core | 4 / 8 | 5718 | 3.919 / 4.824 | 2.420 / 2.962 |
| ecs | 0.0625 / 0.125 | 1116 | 0.820 / 1.420 | 0.568 / 0.858 |
| ecs | 0.5 / 1 | 2190 | 1.470 / 1.666 | 0.943 / 1.051 |
| ecs | 4 / 8 | 5718 | 3.882 / 5.166 | 2.493 / 3.110 |

All tested coordinates/counts match exactly. Kernel medians fall about 31–38% in
this environment. This is an isolated render-sampling result, not an application
speedup factor, measured whole-heap saving or reduced geometry quality.

## Real 2,400-card + 2,400-edge trusted-wheel input

Each fresh page runs two 20-event trusted traversals from Overview, one completed
engine execution per event. Outer viewport is 1,500 × 980; canvas 1,148 × 914.
Engine time excludes the following membership/resource observer. Input-to-frame
ends at engine completion, not GPU/display presentation; these are elapsed scopes,
not OS CPU counters. Observer p50/p95 ranges 2.8–3.2 / 3.4–9.4 ms. Workflow is ECS,
so these values do not describe a Core application.

| Capture | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input-to-frame p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| control-1 | 0 | 17.0 / 99.1 | 851.2 | 17.3 / 99.3 |
| control-1 | 1 | 20.9 / 70.9 | 592.9 | 21.2 / 71.0 |
| candidate-1 | 0 | 17.4 / 82.5 | 743.6 | 17.6 / 82.7 |
| candidate-1 | 1 | 12.5 / 65.9 | 539.9 | 16.8 / 66.1 |
| candidate-2 | 0 | 16.8 / 102.2 | 763.7 | 16.9 / 102.4 |
| candidate-2 | 1 | 13.7 / 80.9 | 650.1 | 13.9 / 81.1 |
| control-2 | 0 | 15.7 / 80.0 | 678.7 | 15.9 / 80.2 |
| control-2 | 1 | 18.3 / 73.9 | 584.3 | 18.5 / 74.3 |

All corresponding targets, one-execution counts, visible IDs, canvas surfaces,
all native counters, allocated bytes and live resources match across four captures
and both traversals. Visible cards/edges range 36–2,400. Native work remains
3–22 draws, 15,516–633,846 indices and four array vertices; allocated buffer bytes
94,772–3,171,388. Documents, GPU gates/injected-error positive control,
synthetic-input rejection and pending-input teardown pass.

Warm candidate input medians are 13.9–16.8 ms versus 18.5–21.2 ms in controls, but
p95 is mixed: 66.1–81.1 ms versus 71.0–74.3 ms. The second candidate is slower in
engine totals and tails than its second control in both traversals. First-traversal
input p95 reaches 102.4 ms. The kernel saving does not establish stable smooth
2,400-node interaction; no fixed whole-application gain is claimed.

## Same qualified 2,400-stroke Core/ECS trace

Both backends receive the same geometry and twelve requested poses per traversal,
including Overview, detail, pan, idle, offscreen and reentry. Two traversals run per
fresh page. Viewport/canvas is 1,000 × 760 / 800 × 600. Core synchronous and ECS
complete awaited boundaries remain separate. Idle steps are included; at twelve
poses nearest-rank p95 is the maximum. Observer p50/p95 ranges 0.1–0.2 / 0.2–0.9 ms
for Core and 0.4–0.7 / 0.6–5.0 ms for ECS.

| Capture | Backend | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Operation-to-frame p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- |
| control-1 | core | 0 | 16.1 / 108.5 | 303.1 | 16.1 / 108.5 |
| control-1 | core | 1 | 13.6 / 34.2 | 157.2 | 13.6 / 34.2 |
| control-1 | ecs | 0 | 13.6 / 99.0 | 374.8 | 20.5 / 104.3 |
| control-1 | ecs | 1 | 18.4 / 60.2 | 236.7 | 24.9 / 63.9 |
| candidate-1 | core | 0 | 15.3 / 69.5 | 250.8 | 15.3 / 69.5 |
| candidate-1 | core | 1 | 14.7 / 37.9 | 166.2 | 14.7 / 37.9 |
| candidate-1 | ecs | 0 | 14.4 / 107.5 | 354.3 | 24.3 / 110.7 |
| candidate-1 | ecs | 1 | 10.9 / 52.5 | 192.1 | 16.6 / 68.4 |
| candidate-2 | core | 0 | 17.3 / 91.6 | 286.8 | 17.3 / 91.6 |
| candidate-2 | core | 1 | 10.6 / 24.8 | 111.4 | 10.6 / 24.8 |
| candidate-2 | ecs | 0 | 14.5 / 95.7 | 361.1 | 26.9 / 108.5 |
| candidate-2 | ecs | 1 | 13.3 / 66.5 | 259.2 | 23.4 / 77.1 |
| control-2 | core | 0 | 17.0 / 158.8 | 347.2 | 17.0 / 158.8 |
| control-2 | core | 1 | 12.2 / 29.1 | 133.8 | 12.2 / 29.1 |
| control-2 | ecs | 0 | 18.8 / 85.4 | 426.4 | 19.5 / 95.9 |
| control-2 | ecs | 1 | 14.4 / 66.9 | 222.8 | 25.6 / 76.7 |

First-traversal engine totals are lower for both backends in both pairs, with
mixed tail and warm results. Within each backend/traversal, every corresponding
view, surface, visible index, page count, native counter and live resource matches.
Visibility ranges 0–2,400; native draws 0–11, indices 0–999,000, array vertices 0–4.
Documents, teardown and both `--require-native-parity` comparisons pass. No GPU
work, storage or drawcall reduction is claimed.

## Warm page preparation: separate diagnostic

A separately labeled real-input runner wraps only `PathGeometryCache.get` and
`StrokeBatch.createGeometry`. It distinguishes the prior context hit, an existing
shared level and an actually newly sampled array by inspecting current/level
identities around the original synchronous call. It records page builds, packed
shapes and 15-float instance rows. No geometry or return value is replaced. Its
timings and extra host checkpoints are excluded from ordinary tables.

The diagnostic retains exact ordinary candidate targets, native counters,
membership, surfaces, allocated bytes and resources. Per-step counts sum exactly
to both traversal totals; cache categories sum to get calls.

| Traversal | Gets | Same context | Reused level | Newly sampled | Page builds | Shapes packed | Rows packed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 14992 | 4244 | 6178 | 4570 | 69 | 14992 | 273546 |
| 1 | 14992 | 9576 | 5062 | 354 | 69 | 14992 | 274030 |

Only 354 of 14,992 warm queries need new sampling, while 69 page builds still pack
274,030 rows. This identifies repeated page preparation/packing as the next work
item alongside sampling misses. A follow-up should measure source/placement
stability, copy work and memory/lifetime tradeoffs before choosing reuse or a
storage-layout change. This patch does not broaden cache budgets or retain pages.

## Validation and limits

Passed locally:

- 36 Core and 48 ECS unit cases: exact Float64 corpus, symmetric-pair call counts,
  repeated controls, frozen author data, quarter-pixel error, precision/cache
  behavior, bounds, quality budgets and stroke reuse/ownership.
- 56 Chromium 149 and 56 WebKit browser cases: native Canvas curve references,
  1–64x zoom, mirrored parents, DPR 3/thin edges/joins, fills/strokes, painter
  order, interaction/history, WebGL1, full exports, culling/reentry, same-frame
  deletion and native lifecycle.
- The exact-point kernel benchmark, four ordinary wheel and four paired stroke
  captures, strict comparisons and separate geometry-work parity audit.
- Repository zero-warning ESLint; Core/ECS, new test contracts and browser/Workflow
  benchmark typechecks; 48 tooling cases; Markdown/format checks.

The initial new Core corpus test used an unexported cubic constructor through the
barrel. Its test-only direct import was corrected and the full focused Core run
passes; public exports were not changed. An ignored scoped test typecheck needed
its inherited type roots corrected to existing Node/Jest declarations; no dependency
or repository configuration changed.

Node CLIs ran directly with installed pnpm 11 rather than requested 9.15.9.
WebKit uses the existing host-requirement precheck override with real assertions
unchanged. Generated Husky helpers are absent, so checks ran explicitly before
committing. Full package/site builds, complete suites and physical-device GPU,
presentation or sustained wheel/pinch testing were not run locally. The smooth
2,400-node target remains open.
