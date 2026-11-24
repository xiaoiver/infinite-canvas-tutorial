> Historical eager-Float32 experiment. Its cold-frame and zoom regressions are retained; the final candidate uses repeat-use admission. These figures are not final candidate results.

# Reuse local stroke geometry in Core and ECS

Following #709, both renderers reuse the CPU cap/join/travel arrays for an unchanged adaptive curve level when a screen stroke page is rebuilt. Translation and painter order are packed afresh; submission counts and geometry precision are unchanged. This targets repeated local geometry work rather than drawcall count. The 2,400-card smooth-interaction goal remains open.

## Cache and fallback contract

StrokeBatch uses a weak map keyed by the existing adaptive curve-level array, retaining only one cap/join combination per level. Its values contain tightly packed Float32 arrays matching the final GPU input representation, without shapes, devices or builder closures. Byte-level tests compare the final GPU upload bytes after normal packing; full/unsupported builders retain their original numeric arrays. It does not keep a curve level alive; the existing four-level LRU and per-context current-level ownership determine level lifetime. Source edits change the level identity; cap/join changes replace its entry. Other shader-only paint/width/placement state continues through existing planning and packing. The ECS composite-geometry fallback uses its original builder, because a Path component can coexist with a higher-priority geometry source.

Full/unsupported/export passes retain the original builder and independent precision contexts. The cache does not affect document/history data, visibility, LOD, interaction geometry, eligibility, page retirement or GPU ownership. No dependency is added. Shared Core/ECS tests cover page retirement, original full-path equivalence, source/style edits, immutable retained arrays, allocation rollback, culling/reentry, migration, same-frame deletion and resource teardown.

## Qualified measurement

Serial clean captures on 2026-11-24 use Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Final source `f84ab7ce8687ef8b203dea134252ab785b926a13`, tree `ae28cb11b1a23cc6dcd47d34f7df6c2127d17cc9`; reference `2bfc912460967b05cb1e95c434042626e49265b3`, tree `2b9655904b00d5a0ab64b84215361962cc479450`. Both retain #709 startup/idle fixes, identical neutral builder seams, helpers and instrumentation; only the two StrokeBatch files differ. These measurements do not compare against the older startup regression.

[Complete raw evidence](stroke-local-geometry-eager-float32.jsonl) contains six captures, input hashes, source blobs, serial exit records, per-operation CPU scopes, native counters, resources, page heap and actual visibility. Every increase is retained. Nearest-rank percentiles use `ceil(n*q)-1`. Samples are a single serial pair, not statistical confidence intervals.

## Core/ECS curved-stroke control

Both scenes start with 2,400 visible cubic strokes in ten ordered pages. Ten translations of one path, six precision changes and four offscreen/reentry pans retain the existing workload. Each step asserts matching actual position, visibility, native counters and resources across revisions. Core operation wall time includes synchronous action/render; ECS includes awaited frame settling, so the backend timing boundaries differ. Geometry CPU is a nested synchronous scope; local-builder CPU is a subset, not an additive total.

| Backend | Action (samples) | Actual visible range |  Wall p50/p95/max ms, before → after | Geometry CPU p50/p95/max ms, before → after | Local builder calls, total before → after |
| ------- | ---------------- | -------------------: | -----------------------------------: | ------------------------------------------: | ----------------------------------------: |
| core    | edit (10)        |            2400–2400 |       13.8/38.1/38.1 → 9.9/13.4/13.4 |                 6.2/15.1/15.1 → 3.0/4.1/4.1 |                                  2560 → 0 |
| core    | zoom (6)         |             660–2400 |  52.7/179.2/179.2 → 53.4/158.0/158.0 |             33.5/45.8/45.8 → 19.5/88.4/88.4 |                               8760 → 1980 |
| core    | pan (4)          |               0–2400 |      1.6/63.2/63.2 → 1.8/116.8/116.8 |             0.0/53.2/53.2 → 0.0/105.7/105.7 |                                  4800 → 0 |
| ecs     | edit (10)        |            2400–2400 |      63.3/89.5/89.5 → 78.3/80.5/80.5 |                 5.2/8.8/8.8 → 3.3/14.0/14.0 |                                  2560 → 0 |
| ecs     | zoom (6)         |             660–2400 | 89.0/180.2/180.2 → 147.1/229.6/229.6 |           26.1/93.8/93.8 → 57.4/139.7/139.7 |                               8760 → 1980 |
| ecs     | pan (4)          |               0–2400 |  64.4/146.7/146.7 → 62.9/164.1/164.1 |               0.0/77.6/77.6 → 0.0/78.1/78.1 |                                  4800 → 0 |

All native counters and resource maps match step by step. Translation still replaces the same dynamic GPU buffers; the optimization reuses local CPU input, not whole translated pages. Full native draw/index/upload/create/delete records remain in the raw inputs.

## Retained page heap cost

Chrome collects garbage only after all timed micro operations and again after renderer destruction. These are aggregate page samples: used V8 heap plus ArrayBuffer/external-string backing storage, excluding embedder/GPU memory. Both raw fields are preserved separately. They are not per-cache accounting. The fixture retains its application/document references after destruction; this column is not a claim that all CPU data is released. Weak entries do not extend the lifetime of the existing curve-level keys.

| Backend | V8 used heap + backing storage after operations, bytes before → after | V8 used heap + backing storage after destruction, bytes before → after |
| ------- | --------------------------------------------------------------------: | ---------------------------------------------------------------------: |
| core    |                                                   39527207 → 43286405 |                                                    25670347 → 29429545 |
| ecs     |                                                   92113568 → 96219053 |                                                    74119033 → 78460558 |

GPU resources return to the existing strict ownership baseline (Core) or zero live resources (ECS). A weak CPU cache can still increase retained heap while its source levels remain live; evaluate that cost with the measured work reduction.

## Actual Workflow at 2,400 cards

All 2,400 cards and 2,400 edges are visible in overview in a 4,801-node document. Actual/requested palettes match `#171b18`; starting/ending cameras, visible counts, buffers, textures and allocated bytes match in paired states. Native-pointer drag has two retained preparation frames, matching targets/final positions and zero connected endpoint error. The tour is time driven, so trajectory sample density varies with scheduling. Cold transition precedes profiler activation.

| Capture  | Operation                   | Frames before/after | Engine CPU p50/p95/max ms, before → after | Completion interval p50/p95/max ms, before → after |
| -------- | --------------------------- | ------------------: | ----------------------------------------: | -------------------------------------------------: |
| profile  | cold-overview-transition    |                 7/6 |         4.2/414.4/414.4 → 3.0/459.2/459.2 |                16.2/427.0/427.0 → 16.6/473.1/473.1 |
| profile  | steady-overview             |               30/30 |                 3.1/4.1/4.1 → 4.0/4.8/7.4 |                    16.7/17.6/18.0 → 16.6/20.0/20.5 |
| profile  | time-driven-tour            |               79/86 |       13.7/131.2/180.0 → 12.9/104.4/255.9 |              53.7/693.4/1038.5 → 59.2/480.2/1047.7 |
| profile  | focused-native-pointer-drag |               38/35 |           12.8/23.5/24.8 → 13.7/24.7/30.4 |                 26.4/90.4/154.0 → 27.6/120.2/132.9 |
| ordinary | cold-overview-transition    |                 6/8 |         2.9/402.2/402.2 → 4.2/529.8/529.8 |                16.4/419.5/419.5 → 16.2/542.7/542.7 |
| ordinary | steady-overview             |               30/30 |                 3.0/4.0/4.5 → 3.3/4.4/4.6 |                    16.6/17.7/18.0 → 16.6/19.0/19.2 |
| ordinary | time-driven-tour            |               83/92 |       11.7/121.7/192.0 → 11.9/121.3/161.6 |              58.3/521.7/1126.0 → 59.7/463.7/1094.0 |
| ordinary | focused-native-pointer-drag |               35/48 |            14.5/27.4/29.0 → 3.8/24.6/26.5 |                    33.4/94.1/99.1 → 9.5/73.1/110.6 |

Both static overview captures keep zero draws. Active-view p95/max values remain the criterion for smooth interaction; these software-rendering results are not native GPU or physical presentation measurements.

## Local builder profile

| Tour scope                    | Mean CPU ms/frame, before → after | Calls total, before → after |
| ----------------------------- | --------------------------------: | --------------------------: |
| stroke.local (exclusiveMs)    |                         3.2 → 1.2 |                27351 → 8551 |
| stroke.geometry (inclusiveMs) |                        10.1 → 8.6 |                   143 → 153 |
| path.precision (exclusiveMs)  |                         4.5 → 4.3 |                   173 → 172 |
| batch.plan (exclusiveMs)      |                         6.1 → 5.2 |                   152 → 162 |

## Reproduce and validation

```bash
pnpm bench:stroke-reuse
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
```

Use the same browser binary (`WORKFLOW_CHROMIUM`), clean commits and serial runs. The reference restores only the two StrokeBatch files from #709 while retaining the neutral builder hook, heap probe and identical instrumentation. Heap GC occurs after timings. Functional checks use Chromium 149 and pinned WebKit/WPE separately.

-   Core 17 and ECS 11 unit cases passed, including the shared cache/full-path contract, allocation rollback and ECS composite-source regression.
-   Chromium 42 and WebKit 42 browser cases passed on the frozen production commit: precision/DPR/reflections, joins/caps, painter barriers, direct edits, history/picking, migration, full raster export, culling/reentry/deletion, startup transparency and idle/wake/resource checks. A first Chromium attempt was interrupted by an edit-triggered Vite reload; the complete frozen rerun passed without assertion changes.
-   The six real Workflow functional cases passed. Five typechecks and normal commit lint hooks passed; benchmark typechecking reran after the heap fields were added. All six clean serial benchmark captures passed.
-   The replacement local environment has pnpm 11 rather than the repository-required pnpm 9, so the initial functional server command failed before tests. A local-only configuration invokes the already-installed Vite directly; source/dependencies/lockfile are unchanged. Pinned WebKit bypasses GUI host validation without skipping behavioral checks.
-   Native GPU/WebGPU, physical presentation latency and exact per-cache retained-memory attribution remain unmeasured. Whole-repository CI is separate from these local results.

## Initial numeric-array experiment retained

[The initial report](stroke-local-geometry-number-arrays.md) and [all six raw captures](stroke-local-geometry-number-arrays.jsonl) preserve the first implementation, including its 9–11 MB used-heap increase, worse Core zoom and some Workflow tail/completion measurements. It is not substituted into the final Float32 comparison. The final representation stores the exact eventual Float32 GPU inputs; used heap and backing storage are counted together above.
