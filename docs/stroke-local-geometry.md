# Reuse local stroke geometry in Core and ECS

> Experimental draft; not recommended for merging as a navigation performance improvement. The final ordinary Workflow pair has CPU p95 124.2 → 153.9 ms. The deterministic 2,400-stroke control reduces local builds but retains about 3.5 MB (Core) / 4.7 MB (ECS) more V8 heap plus backing storage. All regressions and both earlier experiments remain below. Controlled replication and projection/batch-planning work are needed before shipping this candidate.

Following #709, both renderers reuse the CPU cap/join/travel arrays for an unchanged adaptive curve level when a screen stroke page is rebuilt. Translation and painter order are packed afresh; submission counts and geometry precision are unchanged. This targets repeated local geometry work rather than drawcall count. The 2,400-card smooth-interaction goal remains open.

## Cache and fallback contract

StrokeBatch uses a weak map keyed by the existing adaptive curve-level array, retaining only one cap/join combination per level. The first touch invokes the original builder and retains only cap/join metadata. A repeat page rebuild admits that level into Float32 storage; subsequent rebuilds reuse it. One-off precision levels therefore avoid retained buffer allocation. Its values contain tightly packed Float32 arrays matching the final GPU input representation, without shapes, devices or builder closures. Byte-level tests compare the final GPU upload bytes after normal packing; full/unsupported builders retain their original numeric arrays. It does not keep a curve level alive; the existing four-level LRU and per-context current-level ownership determine level lifetime. Source edits change the level identity; cap/join changes replace its entry. Other shader-only paint/width/placement state continues through existing planning and packing. The ECS composite-geometry fallback uses its original builder, because a Path component can coexist with a higher-priority geometry source.

Full/unsupported/export passes retain the original builder and independent precision contexts. The cache does not affect document/history data, visibility, LOD, interaction geometry, eligibility, page retirement or GPU ownership. No dependency is added. Shared Core/ECS tests cover page retirement, original full-path equivalence, source/style edits, immutable retained arrays, allocation rollback, culling/reentry, migration, same-frame deletion and resource teardown.

## Qualified measurement

Serial clean captures on 2026-11-24 use Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Final source `7c98e9b070667ee4e350666663a050c00a3f38dc`, tree `0e8f5abc2dfe24764f335aad40ce17d55551ac3a`; reference `d5b9dc549be800273d1ab4beb14f797f91746f1d`, tree `97bdb3f7370b997dde717b226bc0529cad7caca4`. Both retain #709 startup/idle fixes, identical neutral builder seams, helpers and instrumentation; only the two StrokeBatch files differ. These measurements do not compare against the older startup regression.

[Complete raw evidence](stroke-local-geometry-benchmark.jsonl) contains six captures, input hashes, source blobs, serial exit records, per-operation CPU scopes, native counters, resources, page heap and actual visibility. Every increase is retained. Nearest-rank percentiles use `ceil(n*q)-1`. Samples are a single serial pair, not statistical confidence intervals.

## Core/ECS curved-stroke control

Both scenes start with 2,400 visible cubic strokes in ten ordered pages. Ten translations of one path, six precision changes and four offscreen/reentry pans retain the existing workload. Each step asserts matching actual position, visibility, native counters and resources across revisions. Core operation wall time includes synchronous action/render; ECS includes awaited frame settling, so the backend timing boundaries differ. Micro work has the same synchronous diagnostic wrappers in both revisions; ordinary Workflow is the unprofiled control. Geometry CPU is a nested synchronous scope; local-builder CPU is a subset, not an additive total.

| Backend | Action (samples) | Actual visible range |  Wall p50/p95/max ms, before → after | Geometry CPU p50/p95/max ms, before → after | Local builder calls, total before → after |
| ------- | ---------------- | -------------------: | -----------------------------------: | ------------------------------------------: | ----------------------------------------: |
| core    | edit (10)        |            2400–2400 |      14.6/31.9/31.9 → 10.7/20.6/20.6 |                 6.5/17.4/17.4 → 3.5/5.5/5.5 |                                2560 → 256 |
| core    | zoom (6)         |             660–2400 | 105.6/150.9/150.9 → 76.6/145.9/145.9 |           41.7/134.9/134.9 → 36.3/73.2/73.2 |                               8760 → 5996 |
| core    | pan (4)          |               0–2400 |        5.4/81.4/81.4 → 1.3/67.4/67.4 |               0.0/72.8/72.8 → 0.0/57.5/57.5 |                                4800 → 108 |
| ecs     | edit (10)        |            2400–2400 |  78.9/162.4/162.4 → 75.9/161.8/161.8 |               8.3/16.4/16.4 → 6.1/13.7/13.7 |                                2560 → 256 |
| ecs     | zoom (6)         |             660–2400 | 130.3/212.0/212.0 → 95.5/146.1/146.1 |             56.5/97.8/97.8 → 35.2/70.2/70.2 |                               8760 → 5996 |
| ecs     | pan (4)          |               0–2400 |  63.2/212.4/212.4 → 63.8/160.9/160.9 |             0.0/125.6/125.6 → 0.0/72.5/72.5 |                                4800 → 108 |

All native counters and resource maps match step by step. Translation still replaces the same dynamic GPU buffers; the optimization reuses local CPU input, not whole translated pages. Full native draw/index/upload/create/delete records remain in the raw inputs.

## Retained page heap cost

Chrome collects garbage only after all timed micro operations and again after renderer destruction. These are aggregate page samples: used V8 heap plus ArrayBuffer/external-string backing storage, excluding embedder/GPU memory. Both raw fields are preserved separately. They are not per-cache accounting. The fixture retains its application/document references after destruction; this column is not a claim that all CPU data is released. Weak entries do not extend the lifetime of the existing curve-level keys.

| Backend | V8 used heap + backing storage after operations, bytes before → after | V8 used heap + backing storage after destruction, bytes before → after |
| ------- | --------------------------------------------------------------------: | ---------------------------------------------------------------------: |
| core    |                                                   39514477 → 43008991 |                                                    25657617 → 29152131 |
| ecs     |                                                   91865078 → 96539059 |                                                    74132999 → 78540472 |

GPU resources return to the existing strict ownership baseline (Core) or zero live resources (ECS). A weak CPU cache can still increase retained heap while its source levels remain live; evaluate that cost with the measured work reduction.

## Actual Workflow at 2,400 cards

All 2,400 cards and 2,400 edges are visible in overview in a 4,801-node document. Actual/requested palettes match `#171b18`; starting/ending cameras, visible counts, buffers, textures and allocated bytes match in paired states. Native-pointer drag has two retained preparation frames, matching targets/final positions and zero connected endpoint error. The tour is time driven, so trajectory sample density varies with scheduling. Cold transition precedes profiler activation.

| Capture  | Operation                   | Frames before/after | Engine CPU p50/p95/max ms, before → after | Completion interval p50/p95/max ms, before → after |
| -------- | --------------------------- | ------------------: | ----------------------------------------: | -------------------------------------------------: |
| profile  | cold-overview-transition    |               10/10 |         5.4/534.9/534.9 → 4.3/584.5/584.5 |                18.8/536.1/536.1 → 15.0/598.0/598.0 |
| profile  | steady-overview             |               30/30 |                 3.5/4.7/7.8 → 2.9/3.9/4.7 |                    16.6/20.1/21.9 → 16.6/17.6/18.5 |
| profile  | time-driven-tour            |               97/88 |       14.9/149.5/220.7 → 14.9/146.2/206.6 |               65.4/518.8/981.4 → 65.0/435.1/1148.2 |
| profile  | focused-native-pointer-drag |               40/39 |           11.6/24.4/26.0 → 12.6/24.5/30.3 |                 24.5/98.1/106.3 → 23.2/100.3/189.0 |
| ordinary | cold-overview-transition    |                7/10 |         3.4/558.8/558.8 → 5.1/466.6/466.6 |                16.5/591.7/591.7 → 16.3/478.9/478.9 |
| ordinary | steady-overview             |               30/30 |                 4.4/5.1/6.1 → 3.3/4.9/7.4 |                    16.6/18.8/21.8 → 16.6/19.3/20.5 |
| ordinary | time-driven-tour            |               76/78 |       12.0/124.2/221.3 → 13.5/153.9/221.9 |               63.9/660.8/1303.9 → 65.3/765.7/867.2 |
| ordinary | focused-native-pointer-drag |               36/35 |           12.9/22.4/24.9 → 12.2/22.7/22.8 |                32.9/144.9/176.2 → 25.9/128.3/203.1 |

Both static overview captures keep zero draws. Active-view p95/max values remain the criterion for smooth interaction; these software-rendering results are not native GPU or physical presentation measurements.

## Local builder profile

| Tour scope                    | Mean CPU ms/frame, before → after | Calls total, before → after |
| ----------------------------- | --------------------------------: | --------------------------: |
| stroke.local (exclusiveMs)    |                         3.3 → 1.8 |               30093 → 14636 |
| stroke.geometry (inclusiveMs) |                       11.0 → 10.5 |                   169 → 164 |
| path.precision (exclusiveMs)  |                         5.1 → 4.8 |                   196 → 183 |
| batch.plan (exclusiveMs)      |                         5.9 → 6.7 |                   184 → 168 |

## Reproduce and validation

```bash
pnpm bench:stroke-reuse
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
```

Use the same browser binary (`WORKFLOW_CHROMIUM`), clean commits and serial runs. The reference restores only the two StrokeBatch files from #709 while retaining the neutral builder hook, heap probe and identical instrumentation. Heap GC occurs after timings. Functional checks use Chromium 149 and pinned WebKit/WPE separately.

-   Core 17 and ECS 11 unit cases passed, including the shared cache/full-path contract, allocation rollback and ECS composite-source regression.
-   The eager Float32 control ran 42 Chromium + 42 WebKit cases, including precision/DPR/reflections, startup transparency and idle/wake. The final admission policy reran all 12 affected stroke cases in each browser on the frozen candidate: pixel parity, painter barriers, cap/join/source/style edits, history/picking, migration, full raster exports, culling/reentry/deletion and ownership. A first prototype Chromium run was interrupted by an edit-triggered Vite reload; complete frozen reruns passed without changing existing pixel, readiness or export assertions.
-   The six real Workflow functional cases passed. Five typechecks and normal commit lint hooks passed; benchmark typechecking reran after the heap fields were added. All six clean serial benchmark captures passed.
-   The replacement local environment has pnpm 11 rather than the repository-required pnpm 9, so the initial functional server command failed before tests. A local-only configuration invokes the already-installed Vite directly; source/dependencies/lockfile are unchanged. Pinned WebKit bypasses GUI host validation without skipping behavioral checks.
-   Native GPU/WebGPU, physical presentation latency and exact per-cache retained-memory attribution remain unmeasured. Whole-repository CI is separate from these local results.

## Initial numeric-array experiment retained

[The initial report](stroke-local-geometry-number-arrays.md) and [all six raw captures](stroke-local-geometry-number-arrays.jsonl) preserve the first implementation, including its 9–11 MB used-heap increase, worse Core zoom and some Workflow tail/completion measurements. It is not substituted into the final Float32 comparison. The final representation stores the exact eventual Float32 GPU inputs; used heap and backing storage are counted together above.

## Eager Float32 experiment retained

[The eager-cache report](stroke-local-geometry-eager-float32.md) and [six complete raw captures](stroke-local-geometry-eager-float32.jsonl) preserve its cold-frame and zoom regressions. The final candidate avoids eager retained-buffer allocation on the first use; it still needs repeat-use, cold-frame and total-memory results to justify the tradeoff.

## Native submission and residency controls

| Backend               | Translation draws / indices / array vertices | Creates / deletes | Recorded resident buffers / textures |
| --------------------- | -------------------------------------------: | ----------------: | -----------------------------------: |
| core (both revisions) |                              11 / 999000 / 4 |             2 / 2 |                               53 / 7 |
| ecs (both revisions)  |                              11 / 999000 / 4 |             2 / 2 |                              54 / 12 |

Residency sums include every recorded GL context; raw records preserve each context separately. Matched Workflow overview allocated buffer bytes: 3078076 → 3078076. Vertex/index work is unchanged; these measurements do not obtain a speedup by dropping visible curves.
