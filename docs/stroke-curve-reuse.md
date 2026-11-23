# Screen stroke curve reuse in Core and ECS

This follows #704. It reduces repeated parsing/flattening when ordered stroke pages are rebuilt or reenter the viewport. **It does not meet the smooth 2,400-node Workflow goal.** The actual Workflow measurements below include steady/drag regressions and poor completion cadence.

## Final behavior and ownership

-   Existing `pathInstancing` remains the opt-in switch; its default is unchanged. Only eligible screen `StrokeBatch` pages share geometry. Complex styles retain their previous renderers.
-   A device/shape weak cache owns parsed commands and at most four pooled LRU precision levels. Every page/camera receives a separate `PathGeometryCache.fork()` context with its own hysteresis/current level. Active contexts may additionally reference their current level. A source version change invalidates every context's fast path. No shape, bounds, serialized data, history or interaction geometry is replaced.
-   Full renderers and exports create independent caches. DPR, transform and stroke-radius precision rules remain unchanged. Both backends pass the same context isolation and source-edit contract.
-   Immutable vertex IDs and the existing index buffer survive geometry rewrites. Two dynamic data buffers are still replaced, with original usage hints and exact active sizes. Allocate replacements before releasing the old pair; partial allocation failure releases only the new resources. Retired pages remain retired and release GPU ownership; this is not an offscreen GPU cache.
-   A capacity-reuse trial reduced allocation counts further but worsened geometry CPU scopes in some samples. The final code keeps fresh dynamic storage; it does not assume that reusing a buffer improves latency. GPU wait attribution was not measured.

## Environment, provenance and boundaries

Measured on 2026-11-23: Debian 13, Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader, DPR 1. Functional checks separately use pinned Chromium 149.0.7827.55 and Playwright 1.61.1's WebKit. No representative hardware GPU or native WebGPU result is claimed.

The measured final source is local `988a82b6545698b51006e07206b0e317f40c76fc`, tree `d28851b90e6888b09f8dbc23ebd9aef39e5273dd`. Qualified runs start from clean commits. The paired baseline is local `302b895ebdd9ce8b6e80751fe47969e8b5f97534`; its eight renderer files match #704's merge `bf0437dbe6c5fe0f849129ae89163ceb19c983eb`, with identical final benchmark fixtures. Local benchmark-reference commits are not release branches.

[Full samples and superseded trials](./stroke-curve-reuse-benchmark.jsonl) are JSON Lines: each line contains a named run, qualification/limitations, original input SHA-256, eight production-file Git blob IDs and all captured values. Invalid v1 Core translation samples are explicitly marked: they dirtied geometry without changing `Path.position`. They are not final movement evidence. V2 asserts actual coordinates and curve-source preservation in both backends. The archive also retains the rejected capacity/shared-hysteresis trials, not just the selected result.

## Paired 2,400-curve workload

Both backends start with **2,400 actually visible cubic Path strokes in ten ordered pages**, the same four curve variants/style, 800×600 canvas and DPR 1. Twenty fixed operations cover ten actual translations, six zoom steps (0.26/0.52/0.13 twice), and two full offscreen/reentry cycles. Actual visible counts are 2,400/1,320/660/0 as applicable. Visibility, drawcalls, submitted indices and array vertices match the baseline at every step in each backend. All allocation/resource teardown checks pass.

CPU columns are **sums of synchronous method scopes over the stated operations**, not frame p50/p95. Precision and geometry scopes are separate. Core's operation wall time surrounds one synchronous fixture render; ECS also waits for frame boundaries. Do not compare those operation wall times as cross-backend frame costs. Raw counters include all work in each operation interval.

| Backend | Fixed operations       | Precision CPU ms, old → new | Geometry CPU ms, old → new | Native buffer creates, old → new |
| ------- | ---------------------- | --------------------------: | -------------------------: | -------------------------------: |
| core    | 10 actual translations |                 11.3 → 13.2 |                67.4 → 70.0 |                          30 → 20 |
| core    | 6 fixed zoom steps     |               405.2 → 155.7 |              344.1 → 213.0 |                        142 → 118 |
| core    | 2 visible reentries    |                 294.3 → 8.1 |              178.8 → 214.1 |                        100 → 100 |
| ecs     | 10 actual translations |                 37.4 → 34.2 |               71.7 → 100.6 |                          30 → 20 |
| ecs     | 6 fixed zoom steps     |               356.0 → 121.0 |              416.8 → 270.5 |                        142 → 118 |
| ecs     | 2 visible reentries    |                361.1 → 10.3 |              190.4 → 142.9 |                        100 → 100 |

Per translated dirty page, native buffer creation falls from **3 to 2**, not zero. Empty pages still retire; each all-visible reentry creates 50 native buffers in either implementation. Reentry saves CPU curve work while geometry packing, uploads and fresh GPU resources still cost time. The table deliberately retains worse edit/Core reentry geometry scopes; allocation counts alone are not a latency result.

## Actual Workflow: 2,400 cards and 2,400 edges

The existing real example is measured with image and path batching enabled on both sides. Overview has **2,400 visible cards + 2,400 visible cubic edges**, 4,801 document nodes, a 1,148×914 canvas in a 1,500×980 viewport, and DPR 1. It still submits **22 drawcalls / 614,406 indices**, with 86 main-context buffers, **3,078,076 allocated buffer bytes**, 14 textures, and a single 192-byte scene uniform upload in steady camera frames. Those counts/bytes are unchanged; the auxiliary offscreen context remains separate.

Below, CPU is `world.execute()` wall time, including engine work and any waits inside that boundary. `profile` adds synchronous nested scopes. It is not GPU time or FPS. Percentiles use the repository's `ceil(n × fraction) − 1` definition.

| Capture  | Operation        | Captured frames, old → new | CPU p50/p95 ms, old → new |
| -------- | ---------------- | -------------------------: | ------------------------: |
| ordinary | steady overview  |                    30 → 30 |     11.7/17.9 → 14.7/19.7 |
| ordinary | time-driven tour |                    22 → 34 |   17.8/208.4 → 25.9/207.3 |
| ordinary | native drag      |                    23 → 25 |       18.1/27.3 → 21.6/32 |
| profile  | steady overview  |                    30 → 30 |       13.2/17.5 → 15.3/22 |
| profile  | time-driven tour |                    27 → 53 |     20.1/280 → 16.7/191.4 |
| profile  | native drag      |                    27 → 24 |     17.8/33.9 → 23.7/53.2 |

Tours are time driven, so different speeds visit different camera samples. Native drag sends the same twenty out/back pointer moves in the same 2,400-card document at readable zoom, with **45 cards / 42 edges actually visible**. Event coalescing and captured-frame counts vary. All four baseline/final ordinary/profiled drag endpoint checks have zero error. These captures do not establish a causal end-to-end speedup. In particular, ordinary steady and drag CPU percentiles regress, while ordinary tour p95 is essentially unchanged. Profiled drag's largest slow-frame component remains `edit.apply` (about 47 ms in the final maximum frame); stroke geometry is about 1 ms there.

Completion intervals between consecutive completed engine frames remain much worse than the CPU scopes:

| Capture  | Operation        | Completion interval p50/p95 ms, old → new |
| -------- | ---------------- | ----------------------------------------: |
| ordinary | steady overview  |               706.5/1423.4 → 528.3/1432.6 |
| ordinary | time-driven tour |               462.1/1283.3 → 190.7/1042.7 |
| ordinary | native drag      |                   58.3/146.4 → 58.5/155.5 |
| profile  | steady overview  |                 695.9/1461.4 → 438.9/1140 |
| profile  | time-driven tour |                    340.9/827.7 → 83/847.4 |
| profile  | native drag      |                   65.6/146.4 → 63.2/108.5 |

These intervals include work/waits outside `world.execute()`. They are not a native presentation or GPU-completion measurement. Cold overview maxima remain hundreds of milliseconds (ordinary 573.4 → 483.4 ms; profiled 548.1 → 578.9 ms). The smooth-interaction target remains open. Next work should investigate edit application/coalescing, remaining stroke packing/upload stalls and completion scheduling on representative hardware.

## Reproduce

Run serially with the same browser binary; do not overlap benchmarks:

```bash
pnpm bench:stroke-reuse
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 WORKFLOW_BENCH_OUTPUT=.test-results/curve-profile.json pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 WORKFLOW_BENCH_OUTPUT=.test-results/curve-ordinary.json pnpm bench:workflow
```

`WORKFLOW_CHROMIUM` can select a cached binary; leaving it unset uses the installed pinned browser. That changes the environment compared with these Chromium 140 measurements. The Workflow script's normal default still runs all four image-option/profiling cases; the filters above select the affected path for this comparison.

For a paired baseline, create another worktree from this PR, restore the following production paths from `bf0437d`, and commit that reference so provenance is clean. Keep the same final benchmark/fixture files:

```bash
git restore --source=bf0437d -- packages/core/src/drawcalls/PathDrawcall.ts packages/core/src/drawcalls/StrokeBatch.ts packages/core/src/drawcalls/SmoothPolyline.ts packages/core/src/utils/path-rendering.ts packages/ecs/src/drawcalls/PathDrawcall.ts packages/ecs/src/drawcalls/StrokeBatch.ts packages/ecs/src/drawcalls/SmoothPolyline.ts packages/ecs/src/utils/path-rendering.ts
```

## Validation

-   Core: 35 related unit/lifecycle tests; ECS: 121 related unit, adaptive precision, transition, export and lifecycle tests passed.
-   Two new real-position browser smoke cases passed. Final full Chromium/WebKit results are recorded in the PR after completion.
-   Core, ECS, browser and benchmark typechecks, changed-file ESLint, `git diff --check` and normal commit hooks passed.
-   Paired final/baseline scripts and both final Workflow captures passed, including original curve strings, actual movement, connection checks, resource teardown and instrumentation restoration.
-   Headless WebKit uses the bundled WPE runtime with GUI-only host validation disabled; no assertions or cases are skipped. Native hardware GPU/WebGPU and whole-repository CI are not local results.
