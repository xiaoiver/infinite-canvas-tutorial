> Historical numeric-array prototype. The final implementation is being revised to retain Float32 GPU inputs. These figures document the initial tradeoff and are not final implementation results.

# Reuse local stroke geometry in Core and ECS

Following #709, both renderers reuse the CPU cap/join/travel arrays for an unchanged adaptive curve level when a screen stroke page is rebuilt. Translation and painter order are packed afresh; submission counts and geometry precision are unchanged. This targets repeated local geometry work rather than drawcall count. The 2,400-card smooth-interaction goal remains open.

## Cache and fallback contract

StrokeBatch uses a weak map keyed by the existing adaptive curve-level array, retaining only one cap/join combination per level. Its values contain numeric arrays, without shapes, devices or builder closures. It does not keep a curve level alive; the existing four-level LRU and per-context current-level ownership determine level lifetime. Source edits change the level identity; cap/join changes replace its entry. Other shader-only paint/width/placement state continues through existing planning and packing. The ECS composite-geometry fallback uses its original builder, because a Path component can coexist with a higher-priority geometry source.

Full/unsupported/export passes retain the original builder and independent precision contexts. The cache does not affect document/history data, visibility, LOD, interaction geometry, eligibility, page retirement or GPU ownership. No dependency is added. Shared Core/ECS tests cover page retirement, original full-path equivalence, source/style edits, immutable retained arrays, allocation rollback, culling/reentry, migration, same-frame deletion and resource teardown.

## Qualified measurement

Serial clean captures on 2026-11-24 use Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Final source `976e1699b1d309da0823ccb81a8fcaa58e137a6d`, tree `99371de6801a08b8fbde70e62e1760e6ee4cda5f`; reference `91865f79d4eb748063fdc99b27abdb9443e97c00`, tree `ab762b116ce6dee4afe71a9e2b1ba61177806664`. Both retain #709 startup/idle fixes, identical neutral builder seams, helpers and instrumentation; only the two StrokeBatch files differ. These measurements do not compare against the older startup regression.

[Complete raw evidence](stroke-local-geometry-number-arrays.jsonl) contains six captures, input hashes, source blobs, serial exit records, per-operation CPU scopes, native counters, resources, page heap and actual visibility. Every increase is retained. Nearest-rank percentiles use `ceil(n*q)-1`. Samples are a single serial pair, not statistical confidence intervals.

## Core/ECS curved-stroke control

Both scenes start with 2,400 visible cubic strokes in ten ordered pages. Ten translations of one path, six precision changes and four offscreen/reentry pans retain the existing workload. Each step asserts matching actual position, visibility, native counters and resources across revisions. Core operation wall time includes synchronous action/render; ECS includes awaited frame settling, so the backend timing boundaries differ. Geometry CPU is a nested synchronous scope; local-builder CPU is a subset, not an additive total.

| Backend | Action (samples) | Actual visible range |  Wall p50/p95/max ms, before → after | Geometry CPU p50/p95/max ms, before → after | Local builder calls, total before → after |
| ------- | ---------------- | -------------------: | -----------------------------------: | ------------------------------------------: | ----------------------------------------: |
| core    | edit (10)        |            2400–2400 |       12.1/47.6/47.6 → 8.3/16.7/16.7 |                 5.2/34.2/34.2 → 2.3/4.0/4.0 |                                  2560 → 0 |
| core    | zoom (6)         |             660–2400 |  45.1/120.7/120.7 → 68.3/131.9/131.9 |           26.0/50.5/50.5 → 34.4/101.5/101.5 |                               8760 → 1980 |
| core    | pan (4)          |               0–2400 |      1.1/119.6/119.6 → 1.4/86.2/86.2 |             0.0/109.7/109.7 → 0.0/79.5/79.5 |                                  4800 → 0 |
| ecs     | edit (10)        |            2400–2400 |    63.6/104.8/104.8 → 62.9/95.1/95.1 |               5.5/10.6/10.6 → 6.2/11.7/11.7 |                                  2560 → 0 |
| ecs     | zoom (6)         |             660–2400 | 98.6/192.6/192.6 → 113.5/147.7/147.7 |           31.9/110.5/110.5 → 30.7/76.1/76.1 |                               8760 → 1980 |
| ecs     | pan (4)          |               0–2400 |  63.8/164.2/164.2 → 64.2/163.9/163.9 |               0.0/99.5/99.5 → 0.0/73.5/73.5 |                                  4800 → 0 |

All native counters and resource maps match step by step. Translation still replaces the same dynamic GPU buffers; the optimization reuses local CPU input, not whole translated pages. Full native draw/index/upload/create/delete records remain in the raw inputs.

## Retained page heap cost

Chrome collects garbage only after all timed micro operations and again after renderer destruction. These are aggregate page V8 heap samples, not per-cache or GPU-memory accounting. The fixture retains its application/document references after destruction; this column is not a claim that all CPU data is released. Weak entries do not extend the lifetime of the existing curve-level keys.

| Backend | Used page heap after operations, bytes before → after | Used page heap after renderer destruction, bytes before → after |
| ------- | ----------------------------------------------------: | --------------------------------------------------------------: |
| core    |                                   31144280 → 39916212 |                                             21549820 → 30321752 |
| ecs     |                                   45299124 → 56180648 |                                             32343816 → 43217560 |

GPU resources return to the existing strict ownership baseline (Core) or zero live resources (ECS). A weak CPU cache can still increase retained heap while its source levels remain live; evaluate that cost with the measured work reduction.

## Actual Workflow at 2,400 cards

All 2,400 cards and 2,400 edges are visible in overview in a 4,801-node document. Actual/requested palettes match `#171b18`; starting/ending cameras, visible counts, buffers, textures and allocated bytes match in paired states. Native-pointer drag has two retained preparation frames, matching targets/final positions and zero connected endpoint error. The tour is time driven, so trajectory sample density varies with scheduling. Cold transition precedes profiler activation.

| Capture  | Operation                   | Frames before/after | Engine CPU p50/p95/max ms, before → after | Completion interval p50/p95/max ms, before → after |
| -------- | --------------------------- | ------------------: | ----------------------------------------: | -------------------------------------------------: |
| profile  | cold-overview-transition    |                 6/6 |         2.8/574.6/574.6 → 3.7/529.2/529.2 |                18.5/591.3/591.3 → 28.8/532.8/532.8 |
| profile  | steady-overview             |               30/30 |                 3.6/4.1/4.2 → 2.7/4.1/5.7 |                    16.6/18.6/18.6 → 16.6/20.3/22.1 |
| profile  | time-driven-tour            |               69/83 |       13.4/125.4/231.4 → 12.8/115.0/159.0 |                77.9/649.9/907.9 → 59.8/512.1/745.8 |
| profile  | focused-native-pointer-drag |               34/35 |           13.0/22.4/23.3 → 11.0/24.6/25.9 |                 33.5/106.3/121.6 → 24.9/81.7/110.8 |
| ordinary | cold-overview-transition    |                 6/7 |         3.2/457.4/457.4 → 2.5/443.3/443.3 |                14.6/471.3/471.3 → 17.0/455.8/455.8 |
| ordinary | steady-overview             |               30/30 |                 3.5/4.1/4.7 → 2.9/4.2/5.6 |                    16.7/18.1/20.1 → 16.5/21.4/24.0 |
| ordinary | time-driven-tour            |               93/76 |        11.6/135.1/159.5 → 11.9/98.7/171.6 |              61.1/371.0/1343.6 → 59.0/676.0/1555.4 |
| ordinary | focused-native-pointer-drag |               41/38 |            3.7/21.6/23.8 → 11.0/21.4/23.3 |                  10.3/84.4/94.2 → 16.1/102.9/128.6 |

Both static overview captures keep zero draws. Active-view p95/max values remain the criterion for smooth interaction; these software-rendering results are not native GPU or physical presentation measurements.

## Local builder profile

| Tour scope                    | Mean CPU ms/frame, before → after | Calls total, before → after |
| ----------------------------- | --------------------------------: | --------------------------: |
| stroke.local (exclusiveMs)    |                         4.1 → 0.9 |                24300 → 7004 |
| stroke.geometry (inclusiveMs) |                        10.7 → 9.0 |                   126 → 153 |
| path.precision (exclusiveMs)  |                         5.7 → 3.7 |                   153 → 176 |
| batch.plan (exclusiveMs)      |                         6.9 → 6.5 |                   130 → 160 |

## Reproduce and validation

```bash
pnpm bench:stroke-reuse
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
```

Use the same browser binary (`WORKFLOW_CHROMIUM`), clean commits and serial runs. The reference restores only the two StrokeBatch files from #709 while retaining the neutral builder hook, heap probe and identical instrumentation. Heap GC occurs after timings. Functional checks use Chromium 149 and pinned WebKit/WPE separately.

-   Core 16 and ECS 10 unit cases passed, including the shared cache/full-path contract, allocation rollback and ECS composite-source regression.
-   Chromium 42 and WebKit 42 browser cases passed on the frozen production commit: precision/DPR/reflections, joins/caps, painter barriers, direct edits, history/picking, migration, full raster export, culling/reentry/deletion, startup transparency and idle/wake/resource checks. A first Chromium attempt was interrupted by an edit-triggered Vite reload; the complete frozen rerun passed without assertion changes.
-   The six real Workflow functional cases passed. Five typechecks and normal commit lint hooks passed; benchmark typechecking reran after the heap fields were added. All six clean serial benchmark captures passed.
-   The replacement local environment has pnpm 11 rather than the repository-required pnpm 9, so the initial functional server command failed before tests. A local-only configuration invokes the already-installed Vite directly; source/dependencies/lockfile are unchanged. Pinned WebKit bypasses GUI host validation without skipping behavioral checks.
-   Native GPU/WebGPU, physical presentation latency and exact per-cache retained-memory attribution remain unmeasured. Whole-repository CI is separate from these local results.
