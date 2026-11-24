# Reuse path projection metrics within a draw pass

Following #709, Core and ECS reuse projection/model scale calculations for consecutive paths with equal linear transforms inside one `prepareGeometry` call. The original formula remains the oracle. A new scope is created for every pass, camera, viewport/DPR and export; it holds only four scalar coefficients and one result until the synchronous call returns. Translation does not enter the scale formula.

Single-path draws keep the original direct calculation. The scope is created lazily, so non-Path pages allocate none. Radius and size/stroke attenuation are still applied separately to each shape. Changed linear coefficients cause an immediate recalculation, including shear, reflections and singular models. Mutable uniform arrays are reread on the next pass. No geometry buffers, shapes, devices, cache levels or interaction state are retained by this scope.

This branch starts from #709 merge `e966d9a` and excludes the retained stroke-cache experiment in #710. Existing path eligibility, painter order, LOD switches/defaults, original document/history data, picking, full export, culling/reentry/deletion and GPU ownership paths are unchanged. ECS batch planning already skips clean frames; its remaining work on visible-set changes is not modified here.

## Correctness and deterministic work control

A shared test warms a 12-path page, then counts the original scale calculation work: 72 `Math.hypot` calls before the change versus six after it, in both backends. The unchanged singleton control remains six. The test mutates the same view-matrix array for the next pass, checks immediate precision/geometry invalidation, and compares against an independent full-pass draw. Pure tests compare exact values across mutable affine transforms, reflection, shear, zero/singular transforms, fallback uniforms, changed projection and viewport/DPR. The old implementation fails the six-call regression with 72 actual calls.

## Qualified environment and source

Serial clean captures on 2026-11-24 use Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Final source `cf7f862b8875e4e6d69b76c058d254e473d7db72`, tree `9a73e6a1aa7ccb0d3cb26a981b6645c02b86d088`; control `fa6b00a71028a3bb507cbe0ccb277191b4b42652`, tree `4417d2bef7cb436db5a94325f29fa2042afab995`. The control restores only the two PathDrawcall callers from #709; utilities, fixtures, wrappers and heap probes match exactly. This report follows those measured commits.

[Full raw evidence](path-metrics-benchmark.jsonl.gz) contains eight inputs with hashes, exact source blobs, serial exits, frames, native counters, resources, heap/backing storage and actual visibility. Two ordinary navigation rounds are retained without selecting the better pair. Every timing increase remains below. Percentiles use nearest rank `ceil(n*q)-1`; completion intervals use adjacent recorded completion timestamps, excluding the first frame without a within-capture predecessor. These pairs are not confidence intervals.

## Core/ECS 2,400-stroke control

Each backend begins with 2,400 visible cubic paths in ten pages. Ten translations of one path, six precision changes and four offscreen/reentry pans retain the existing workload. All per-step visible counts, positions, draw/index/upload/create/delete counters and GL resource maps match across revisions. Geometry and precision CPU scopes run in both revisions; ordinary Workflow is the unprofiled control. Core wall time includes synchronous action/render; ECS includes awaited settling, so backend boundaries differ.

| Backend | Action (samples) | Visible range | Operation wall p50/p95/max ms, before → after | Precision CPU p50/p95/max ms, before → after |
| ------- | ---------------- | ------------: | --------------------------------------------: | -------------------------------------------: |
| core    | edit (10)        |     2400–2400 |               12.1/28.0/28.0 → 11.7/31.1/31.1 |                    1.0/1.7/1.7 → 0.7/8.1/8.1 |
| core    | zoom (6)         |      660–2400 |           61.3/152.8/152.8 → 65.3/117.5/117.5 |                2.9/97.1/97.1 → 2.2/66.2/66.2 |
| core    | pan (4)          |        0–2400 |             1.5/107.4/107.4 → 1.2/133.8/133.8 |                    0.0/2.7/2.7 → 0.0/2.4/2.4 |
| ecs     | edit (10)        |     2400–2400 |             77.6/107.4/107.4 → 75.1/79.7/79.7 |                    2.2/8.0/8.0 → 3.4/4.8/4.8 |
| ecs     | zoom (6)         |      660–2400 |          97.1/144.8/144.8 → 126.5/246.3/246.3 |                4.0/57.1/57.1 → 4.7/85.1/85.1 |
| ecs     | pan (4)          |        0–2400 |           62.7/163.6/163.6 → 65.6/176.3/176.3 |                    0.0/5.9/5.9 → 0.0/5.5/5.5 |

| Backend | Translation draws / indices / array vertices (both) | Buffer creates / deletes (both) | Resident buffers / textures (both) |
| ------- | --------------------------------------------------: | ------------------------------: | ---------------------------------: |
| core    |                                     11 / 999000 / 4 |                           2 / 2 |                             53 / 7 |
| ecs     |                                     11 / 999000 / 4 |                           2 / 2 |                            54 / 12 |

Residency totals include all recorded GL contexts; raw data retains each separately. Rendering work is preserved, including original curve precision.

## Retained memory control

Chrome collects garbage after all timed micro operations, and again after renderer destruction. The table sums V8 used heap plus ArrayBuffer/external-string backing storage; it excludes embedder and physical GPU memory. Each raw field remains separate. The fixture retains application/document references after destruction, so these are aggregate page samples rather than a claim that all CPU data is freed. GPU ownership returns to the original strict Core baseline or zero live ECS resources.

| Backend | Used heap + backing after operations, bytes before → after | After renderer destruction, bytes before → after |
| ------- | ---------------------------------------------------------: | -----------------------------------------------: |
| core    |                                        39476091 → 39542891 |                              25619231 → 25686031 |
| ecs     |                                        92108350 → 91850655 |                              74114867 → 74117088 |

## Actual Workflow navigation

The 4,801-node document contains 2,400 cards, 2,400 edges and the root; every card/edge is visible in overview. Image batching stays enabled. Actual/requested dark palettes match `#171b18`. Paired starting/ending cameras, document versions, visibility, GL resources and allocated bytes match. Drag retains two camera preparation frames, the same pointer target/final position and zero endpoint error. The ten-second tour is time driven, so poses and sample density vary with scheduling and remain in raw evidence. Cold transition precedes profiler activation.

| Capture / round | Operation                   | Frames before/after | Engine CPU p50/p95/max ms, before → after | Completion interval p50/p95/max ms, before → after |
| --------------- | --------------------------- | ------------------: | ----------------------------------------: | -------------------------------------------------: |
| profile / 1     | cold-overview-transition    |                 8/8 |         3.9/533.4/533.4 → 3.9/553.3/553.3 |                15.6/553.3/553.3 → 15.5/560.8/560.8 |
| profile / 1     | steady-overview             |               30/30 |                3.4/4.6/10.8 → 3.3/4.6/4.8 |                    16.7/17.9/26.2 → 16.7/20.6/22.4 |
| profile / 1     | time-driven-tour            |               73/85 |       14.5/130.7/152.7 → 13.0/144.0/185.0 |              55.4/739.6/1503.2 → 61.1/600.2/1376.1 |
| profile / 1     | focused-native-pointer-drag |               42/38 |            3.5/19.5/36.0 → 12.4/27.2/35.0 |                  17.5/82.2/94.6 → 28.9/104.0/137.1 |
| ordinary / 1    | cold-overview-transition    |                 8/8 |         3.3/423.2/423.2 → 4.0/502.0/502.0 |                17.4/438.4/438.4 → 16.3/519.2/519.2 |
| ordinary / 1    | steady-overview             |               30/30 |                 2.8/3.3/3.7 → 3.1/6.8/7.3 |                    16.7/18.4/18.5 → 16.7/21.2/22.3 |
| ordinary / 1    | time-driven-tour            |               89/79 |       15.6/122.2/229.9 → 11.7/113.1/186.4 |              59.2/488.1/1172.0 → 62.3/632.1/1369.9 |
| ordinary / 1    | focused-native-pointer-drag |               43/30 |            5.3/22.1/27.5 → 12.7/16.8/17.3 |                  10.7/90.0/206.7 → 47.3/86.7/134.1 |
| ordinary / 2    | cold-overview-transition    |                 7/6 |         3.3/482.2/482.2 → 2.9/468.4/468.4 |                16.3/496.6/496.6 → 16.4/487.1/487.1 |
| ordinary / 2    | steady-overview             |               30/30 |                2.7/4.4/5.8 → 2.7/9.3/36.0 |                    16.6/17.9/21.9 → 16.5/19.9/48.8 |
| ordinary / 2    | time-driven-tour            |               75/82 |       11.4/128.8/212.4 → 10.9/118.1/206.6 |              59.1/686.1/1308.9 → 60.0/556.1/1332.2 |
| ordinary / 2    | focused-native-pointer-drag |               36/37 |           12.4/23.4/29.9 → 12.1/23.6/25.8 |                41.9/114.5/182.2 → 25.2/111.0/121.0 |

Static overview retains zero draws in every capture. Software-rendering intervals include scheduling and are not physical presentation or native GPU execution timers. The high tails in the table keep the 2,400-card smooth zoom/drag goal open.

## Interpretation and remaining limits

The deterministic result is reduced scalar derivation work with identical geometry/submission. Ordinary tour CPU p95 decreases in both retained pairs (122.2 → 113.1 ms and 128.8 → 118.1 ms), but the profiled tour p95 increases (130.7 → 144.0 ms), cold/drag cases are mixed, and the ECS six-step zoom control regresses (144.8 → 246.3 ms wall p95/max). These observations do not establish a general navigation speedup. Tours are time driven and sampling density differs; native presentation validation remains open.

After-operation used heap plus backing storage moves by +66,800 bytes in Core and −257,695 bytes in ECS. These aggregate samples include JIT/page variation and are not exact allocation attribution. Remaining measured costs include stroke geometry and batch planning; neither is changed here.

## Profiled tour CPU scopes

| Scope           | Mean exclusive CPU ms/frame, before → after | Calls total before/after |
| --------------- | ------------------------------------------: | -----------------------: |
| path.precision  |                                   5.0 → 4.3 |                  157/175 |
| stroke.geometry |                                 11.6 → 11.1 |                  138/144 |
| batch.plan      |                                   5.8 → 5.8 |                  138/162 |
| visibility.cull |                                   2.2 → 2.3 |                    73/85 |

## Reproduce and validation

```bash
pnpm bench:stroke-reuse
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
```

Use clean paired source and one binary (`WORKFLOW_CHROMIUM`), retain the common utilities/probes and restore only both PathDrawcall files from #709 for the control. Run captures serially; repeat the ordinary Workflow pair separately. All GC/heap reads are outside timed operations. Functional checks use Chromium 149 and pinned WebKit/WPE separately. Local configs invoke the already installed Vite directly because the replacement environment has pnpm 11 while the repository requires pnpm 9. Dependencies and lockfile are unchanged.

-   61 unit cases pass: Core stroke suite 16, ECS stroke suite 9, shared Core/ECS adaptive suite 36. The new work-count regression fails before the production change.
-   Chromium: 42 unique cases pass. In the first full run, 40 passed while two high-DPR cases failed during navigation/load (one timeout, one page crash), before pixel assertions. Both unchanged cases passed in a fresh Chromium process; initial traces are retained locally. Timeouts and pixel assertions are unchanged.
-   WebKit: all 42 cases pass. Coverage includes high zoom/DPR, mirrors/joins, painter barriers, editing/history/picking, camera migration, full raster export, culling/reentry/same-frame deletion, ownership, startup transparency and idle/wake. Pinned WPE bypasses GUI-only host validation without skipping behaviors.
-   Six real Workflow functional cases pass, through 2,400 cards, connected native drag, anchored zoom/pan, cancellation, persistence/export and narrow/reduced-motion behavior. Five typechecks and normal lint hooks pass; benchmark typing reran after heap probes. Eight clean serial captures succeed.
-   Native GPU/WebGPU and physical presentation latency remain unmeasured. Aggregate retained heap is not exact attribution to this helper. Whole-repository remote CI is separate from local results; this PR is not auto-merged.

Raw evidence is losslessly compressed. Decompress with `gzip -dc docs/path-metrics-benchmark.jsonl.gz`. Uncompressed SHA-256: `d88a354b8f9aaa0509326077f5f9ae04d2ee34ba0648de6493433ad74131c258` (725768 bytes); compressed SHA-256: `71d397211135d8493d48959b8f3546c9096f96dc5688bf67d5029316c63638a2` (66214 bytes).
