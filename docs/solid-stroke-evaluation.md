# Solid stroke page specialization: measured, then withheld

The next investigation after #734 tested unused dash work in **both Core and
ECS**. Existing stroke pages accept ordinary solid paths; dashed and unsupported
styles use the full path. Two local implementations preserved geometry, exports,
interaction and ownership in the selected regressions, but neither established a
stable application improvement. **Neither runtime implementation is included in
this PR.** Production sources, dependencies and defaults remain byte-identical
to `39ab05099d39d13e0a8a7407b6f2221afeeb937a`.

The retained change adds a real solid → dashed → solid mutation regression in
both renderers, including nonzero and negative dash offsets. It compares page
output against disabled-batching full output at each edit and checks page
eligibility. The compiler regression now explicitly compiles both full stroke
and solid page variants for both backends. These tests protect subsequent work;
they are not evidence of a performance improvement.

## Exact experimental sources

All ordinary measurements used clean committed source and the same control:

| Variant            | Local commit                               | Tree                                       |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| Control            | `39ab05099d39d13e0a8a7407b6f2221afeeb937a` | `20a7e9dbc7fd724a64d08466cf6701724fbedd53` |
| A: stream + shader | `900559052e707a21ebd2c513f6368b7f72117ea6` | `1de60efaae13900fb3608b296d2ba79a5cad02c4` |
| B: shader only     | `329e977d5d29433f11788aca4e9ec10ac1017a76` | `448438cb65aaa98e2014687771bce40f6f81ced7` |

These are experimental local source identities, not the final test/report PR
head. Exact patches from the control are included in
`docs/perf-experiments/solid-stroke-A.patch` and `solid-stroke-B.patch` so the
rejected variants are reproducible without relying on a private worktree.
The private review archive retains their source bundle, raw captures, strict
step audits and command logs, including failed preliminary checks. No favorable
rerun replaces an unfavorable capture.

A removes the unused per-instance travel allocation/upload/binding for eligible
pages and omits dash shader calculations. Every writable segment buffer remains
fresh; device constant leases and full-path data are retained. B restores all
packing, buffers, layouts and uploads to the control and only specializes the
shaders. The ECS solid fragment path retains the original `max(0, alpha)` clamp.
Both leave all dashed/full/export shader behavior in place.

## Measurement protocol

Node 24.22.3, Chromium 140.0.7339.186, SwiftShader, DPR 1, shared cloud host.
Each variant ran sequentially in **control / candidate / candidate / control**
order, with a fresh page per capture. A and B form separate experiments, each
with its own controls; their timings must not be pooled. No test suites, CDP,
phase wrappers or stream counters ran during ordinary captures.

The real Workflow uses ECS, 2,400 cards + 2,400 edges, 20 trusted wheel inputs
per traversal, first and warm traversals, outer viewport 1,500 × 980 and actual
canvas 1,148 × 914. It waits for each target before issuing the next input.
Input-to-frame ends at completed engine execution, excluding the subsequent
membership/resource observer; it is not physical presentation time or continuous
gesture FPS. The separate Core/ECS trace uses the same 2,400 strokes, 12 poses,
800 × 600 surface and first/warm traversals, including overview, detail,
offscreen culling, reentry and idle. For 12 poses, p95 is the maximum pose.
Do not mix this API-driven trace with Workflow trusted input.

## A: combined stream and shader experiment

### Real Workflow

| Capture     | Backend | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input/operation-to-frame p50 / p95 (ms) |
| ----------- | ------- | --------- | --------------------- | ----------------- | --------------------------------------- |
| control-1   | ecs     | 0         | 11.8 / 78.3           | 670.1             | 12.0 / 78.4                             |
| control-1   | ecs     | 1         | 11.8 / 53.8           | 464.6             | 12.1 / 54.0                             |
| candidate-1 | ecs     | 0         | 19.3 / 81.1           | 659.8             | 19.6 / 81.5                             |
| candidate-1 | ecs     | 1         | 14.4 / 59.2           | 449.7             | 14.8 / 59.4                             |
| candidate-2 | ecs     | 0         | 15.4 / 84.5           | 662.0             | 15.6 / 84.8                             |
| candidate-2 | ecs     | 1         | 22.1 / 77.1           | 648.3             | 22.9 / 77.6                             |
| control-2   | ecs     | 0         | 14.6 / 62.5           | 570.4             | 14.8 / 63.8                             |
| control-2   | ecs     | 1         | 14.1 / 52.2           | 433.5             | 15.4 / 52.5                             |

Warm Workflow engine p95 worsens in both pairs: **53.8 → 59.2 ms** and
**52.2 → 77.1 ms**. First-round p95 also worsens in both pairs. Reduced work
below does not justify a smoothness claim.

### Paired Core/ECS stroke trace

| Capture     | Backend | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input/operation-to-frame p50 / p95 (ms) |
| ----------- | ------- | --------- | --------------------- | ----------------- | --------------------------------------- |
| control-1   | core    | 0         | 6.6 / 48.7            | 168.1             | 6.6 / 48.8                              |
| control-1   | core    | 1         | 4.0 / 18.3            | 67.3              | 4.0 / 18.3                              |
| control-1   | ecs     | 0         | 13.2 / 117.2          | 348.4             | 21.5 / 119.6                            |
| control-1   | ecs     | 1         | 13.8 / 50.8           | 221.8             | 21.6 / 61.0                             |
| candidate-1 | core    | 0         | 5.8 / 59.9            | 196.5             | 5.8 / 59.9                              |
| candidate-1 | core    | 1         | 3.3 / 11.0            | 47.6              | 3.3 / 11.0                              |
| candidate-1 | ecs     | 0         | 9.9 / 83.5            | 295.7             | 16.7 / 95.8                             |
| candidate-1 | ecs     | 1         | 9.9 / 46.0            | 175.3             | 19.5 / 53.5                             |
| candidate-2 | core    | 0         | 3.7 / 47.0            | 120.9             | 3.7 / 47.0                              |
| candidate-2 | core    | 1         | 2.9 / 9.7             | 44.3              | 2.9 / 9.7                               |
| candidate-2 | ecs     | 0         | 10.3 / 62.8           | 263.5             | 23.2 / 68.3                             |
| candidate-2 | ecs     | 1         | 9.2 / 43.5            | 168.1             | 19.4 / 52.3                             |
| control-2   | core    | 0         | 6.0 / 51.1            | 148.6             | 6.0 / 51.1                              |
| control-2   | core    | 1         | 3.6 / 15.5            | 55.6              | 3.6 / 15.5                              |
| control-2   | ecs     | 0         | 9.8 / 58.2            | 239.7             | 24.2 / 58.3                             |
| control-2   | ecs     | 1         | 9.1 / 66.3            | 184.2             | 20.6 / 79.9                             |

Core warm totals improve in these captures, but first-round results vary. ECS
first-round p95 improves in one pair and worsens in the other. These scoped
results do not override the real Workflow regression.

### Certified work and resources

A separate diagnostic wraps only successful page creation/render/destruction,
marks its capture `stroke-stream-diagnostic`, and is excluded from timing.
Its work, native counters and live resources match the corresponding ordinary
capture within each variant. A strict cross-variant per-step audit certifies
identical geometry work, camera targets, visible identities, documents, surfaces,
page builds/rows/draws, all non-buffer resources, GPU gates and teardown. Only
travel-stream effects are permitted:

-   Each successful page build omits one create/allocation/upload. Bytes decrease
    by four per packed row in Core and twelve per packed row in ECS.
-   Live buffers decrease by the number of live pages, and live allocated bytes
    by the corresponding travel rows. Deletes account for before/after live pages.
-   Recorded ARRAY_BUFFER binds decrease by builds + draws, and vertex attribute
    pointers by draws. All other native counters remain equal.

Each Workflow traversal builds 69 pages. Native creates/deletes/allocations fall
**177 → 108**, uploads **326 → 257**. First/warm upload bytes fall
**21,113,128 → 17,830,576** / **21,147,976 → 17,859,616**, a reduction of
3,282,552 / 3,288,360 bytes. Packed rows are 273,546 / 274,030.
Each paired-backend traversal builds 38 pages with 237,541 packed rows and 48
stroke draws. Creates fall 95 → 57; Core uploads 125 → 87 and bytes
15,208,704 → 14,258,540; ECS uploads 116 → 78 and bytes
17,108,488 → 14,257,996. These are deterministic work reductions, not latency
or allocation-free claims.

## B: isolate the shader changes

### Real Workflow

| Capture     | Backend | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input/operation-to-frame p50 / p95 (ms) |
| ----------- | ------- | --------- | --------------------- | ----------------- | --------------------------------------- |
| control-1   | ecs     | 0         | 19.2 / 87.7           | 778.6             | 19.9 / 88.0                             |
| control-1   | ecs     | 1         | 20.7 / 60.5           | 522.5             | 21.0 / 60.8                             |
| candidate-1 | ecs     | 0         | 13.0 / 76.3           | 625.9             | 13.5 / 76.5                             |
| candidate-1 | ecs     | 1         | 21.1 / 72.6           | 590.3             | 23.2 / 72.8                             |
| candidate-2 | ecs     | 0         | 12.6 / 96.3           | 701.9             | 12.8 / 96.5                             |
| candidate-2 | ecs     | 1         | 14.6 / 67.7           | 538.5             | 14.8 / 69.3                             |
| control-2   | ecs     | 0         | 14.4 / 81.9           | 677.9             | 14.9 / 82.2                             |
| control-2   | ecs     | 1         | 16.1 / 71.1           | 510.6             | 16.3 / 71.3                             |

Warm engine p95 is **60.5 → 72.6 ms** in one pair and **71.1 → 67.7 ms** in the
other. Both warm totals increase. First-round outcomes also disagree. The
shader-only experiment does not establish a stable improvement.

### Paired Core/ECS stroke trace

| Capture     | Backend | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input/operation-to-frame p50 / p95 (ms) |
| ----------- | ------- | --------- | --------------------- | ----------------- | --------------------------------------- |
| control-1   | core    | 0         | 6.1 / 66.6            | 184.9             | 6.1 / 66.6                              |
| control-1   | core    | 1         | 3.1 / 11.8            | 45.6              | 3.1 / 11.8                              |
| control-1   | ecs     | 0         | 15.5 / 68.5           | 293.6             | 22.5 / 69.8                             |
| control-1   | ecs     | 1         | 9.1 / 36.4            | 171.3             | 18.9 / 49.1                             |
| candidate-1 | core    | 0         | 5.3 / 60.9            | 179.7             | 5.3 / 60.9                              |
| candidate-1 | core    | 1         | 2.8 / 10.9            | 44.5              | 2.8 / 10.9                              |
| candidate-1 | ecs     | 0         | 15.1 / 68.0           | 291.3             | 23.2 / 73.1                             |
| candidate-1 | ecs     | 1         | 10.3 / 43.7           | 177.1             | 20.1 / 55.5                             |
| candidate-2 | core    | 0         | 3.9 / 57.2            | 143.5             | 3.9 / 57.2                              |
| candidate-2 | core    | 1         | 2.8 / 15.8            | 54.3              | 2.8 / 15.8                              |
| candidate-2 | ecs     | 0         | 14.9 / 84.9           | 337.8             | 21.7 / 86.5                             |
| candidate-2 | ecs     | 1         | 10.5 / 57.2           | 199.3             | 16.7 / 65.3                             |
| control-2   | core    | 0         | 3.7 / 44.9            | 129.6             | 3.7 / 44.9                              |
| control-2   | core    | 1         | 2.7 / 10.9            | 43.5              | 2.7 / 10.9                              |
| control-2   | ecs     | 0         | 15.8 / 67.9           | 295.3             | 22.2 / 69.8                             |
| control-2   | ecs     | 1         | 13.0 / 51.3           | 213.7             | 25.8 / 56.1                             |

B retains exact per-step native counters, live resource maps and allocated
buffer bytes, in addition to geometry, views, membership and document equality.
The independent stream diagnostic also retains exact page/row/draw counts. It
therefore isolates shader changes from the allocation/upload changes in A.

## Common workload correctness

Across both variants, corresponding Workflow steps retain 36–2,400 actual
visible cards and 36–2,400 edges, 3–22 drawcalls, 15,516–633,846 indices and four
array vertices. The membership sets, not only totals, are checked. Each ordinary
input produces exactly one completed engine execution. Documents remain equal;
GPU gates pass, injected-error detection and synthetic-wheel rejection stay
active, and destruction with pending input reports no leak. No `Culled` state,
LOD selection policy, history or original geometry is changed.

The paired trace retains exact visible indices, surfaces, camera values,
submission counts and teardown, including offscreen/reentry and idle poses.
Individual observer durations remain in the raw data and are excluded from
engine CPU windows. None of these captures demonstrates physical GPU throughput
or guarantees a 60 Hz frame budget on user hardware.

## Reproduce the experiments

Use separate clean checkouts of the control. Apply **one** patch per checkout,
commit it before capture, then verify `git write-tree` equals the table above.
Do not apply A and B cumulatively.

```sh
git apply --unidiff-zero --check /path/to/solid-stroke-A.patch
git apply --unidiff-zero --index /path/to/solid-stroke-A.patch
git write-tree
# Commit this source before recording its provenance.
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/path/to/output pnpm bench:workflow-input
CAMERA_REPLAY_OUTPUT_DIR=/path/to/other-output pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
```

Pin `WORKFLOW_CHROMIUM` to the same browser in both checkouts. Repeat each
ordinary workload sequentially control/candidate/candidate/control. Use existing
`compareWorkflowInputs` and `compareReplays` to qualify captures. A deliberately
changes native buffer work, so it additionally needs the retained row-certified
stream audit rather than weakening the ordinary qualification. B qualifies
with exact native/resource parity. Do not remove diagnostic mode markers to
present instrumented captures as ordinary timing.

## Validation and remaining work

A passed 82 related Core cases, 102 ECS cases, 100 tooling cases, Core/ECS/browser/
Workflow typechecks, repository ESLint with zero warnings, and 43 selected
Chromium 149 plus 43 WebKit browser cases. B passed 81 Core and 101 ECS cases,
Core/ECS typechecks, repository ESLint, and the same 43 + 43 browser cases.
Both passed eight ordinary captures and four independent counted-work captures.
Compiler tests use bundled GLSL → WGSL translation, not physical WebGPU execution.
WebKit uses the installed browser with host-requirement preflight skipped;
rendering assertions remain unchanged. Node 24 and cached dependencies/direct
CLIs differ from the declared pnpm 9.15.9 environment. No dependency was added.

Final test/report-only validation is recorded in the PR. The runtime variants
remain withheld. The next investigation should profile the **current production
baseline** at long trusted-input frames, identify CPU self time versus native
submission/wait/GC, and target the dominant stage in both backends where it
applies. The 2,400-node smooth-interaction target remains open; fewer allocations
or simpler shader source alone is insufficient evidence.

## Production profiling follow-up

Two separate baseline CDP attempts retained raw trace/profile data but failed
the existing strict analyzer with `Invalid CPU sample delta`. Chromium 140
returned one negative delta (-1 µs); Chromium 149 returned 185 negative deltas
(minimum -3,976 µs). These attempts are rejected diagnostics, not qualified CPU
attribution or ordinary timing. No deltas were clamped, reordered or discarded
to manufacture a profile. They do not affect the ordinary A/B captures above.
Before selecting another runtime change, qualify independent trace/phase
attribution or resolve the profiler producer anomaly while preserving clock
and sample validation. No dominant function or phase is claimed from these
invalid profiles.
