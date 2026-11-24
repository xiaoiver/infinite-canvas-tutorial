# Share stroke upload snapshots in Core and ECS

Following #711, screen StrokeBatch geometry creates one Float32 point snapshot and one Float32 travel snapshot per successful rebuild. Each snapshot is used by both the GPU upload byte view and the existing CPU vertex-data record. Previously each packed number array was converted twice. The retained CPU record, shader attributes, Float32 rounding and uploaded bytes remain the same. The removed objects are transient duplicate Float32 arrays, not a cross-frame geometry cache.

Core and ECS use the same change. Full SmoothPolyline draws retain their original conversion path. No batching/LOD defaults, compatibility checks, geometry precision, document/history data, interaction geometry, GPU buffer allocation/retirement or export ownership changes. The retained geometry-cache experiment in #710 is excluded.

## Deterministic regression

A shared production-drawcall test verifies that each uploaded Uint8Array views the exact buffer owned by the Float32 CPU record, all point attributes share that record, and both record values equal independently converted packed arrays. It rebuilds after a source edit, verifies fresh independent snapshots and checks that the old snapshots remain unchanged. The regression fails on the original implementation. Existing fixed-buffer lifetime and partial-allocation rollback tests also pass.

For a batch rebuild, conversion count changes from two point-array plus two travel-array conversions to one of each. Removed transient payload is `(packedPoints.length + packedTravel.length) * 4` bytes per rebuild. This is a source/allocation-count result; retained-heap sampling below cannot attribute objects to this change. GPU submissions and upload bytes are deliberately preserved.

## Measurement boundary and evidence

Eight clean serial captures use Node v24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Control local commit `a3ab22ab510ee77a80fa53305922cb142fd8b1bb`, tree `5159266062a02e5bbe881232bdd6bb60938a1f18` equals the published #711 tree. Measured local implementation `a6b6711b9cff8cb200268b8269af24fde0a29aa7`, tree `c89b1fb9706e60368460bf4fd66465a6f69aa08b` changes only the two SmoothPolyline render files and the shared regression. Full source blob identities are retained in the evidence. This report follows those measured commits.

[Complete evidence](stroke-upload-benchmark.jsonl.gz) includes every input hash, frame/camera/scope/native/resource/heap record, source blobs and serial start/end/exit status. Only machine-local checkout paths are replaced with relative capture filenames in the public envelope; measurement values are unchanged. No tests, lint or other local browser work overlap timed captures. Two ordinary tour pairs are retained without selecting the better one. Percentiles use nearest rank `ceil(n*q)-1`. These pairs are not confidence intervals.

## Core/ECS curved-stroke control

Both backends begin with 2,400 actually visible curves in ten pages. The unchanged workload performs ten translations, six precision changes and four offscreen/reentry pans. Every step matches visibility, placement, page count, complete native counters and live resource maps across revisions. Both teardown contracts pass. Core operation wall time includes action/render; ECS includes awaited settling, so compare within each backend.

| Backend | Operation / samples | Visible range |  Wall p50/p95/max ms, before → after | Geometry scope p50/p95/max ms, before → after |
| ------- | ------------------- | ------------: | -----------------------------------: | --------------------------------------------: |
| core    | edit / 10           |     2400–2400 |      12.5/18.3/18.3 → 11.5/15.7/15.7 |                     5.9/9.7/9.7 → 5.5/6.6/6.6 |
| core    | zoom / 6            |      660–2400 |  47.1/137.5/137.5 → 58.8/122.0/122.0 |               23.0/78.7/78.7 → 30.3/94.5/94.5 |
| core    | pan / 4             |        0–2400 |      2.0/83.5/83.5 → 1.4/118.6/118.6 |               0.0/73.9/73.9 → 0.0/108.2/108.2 |
| ecs     | edit / 10           |     2400–2400 |      63.3/99.6/99.6 → 76.6/83.1/83.1 |                   5.0/7.9/7.9 → 6.4/15.4/15.4 |
| ecs     | zoom / 6            |      660–2400 | 97.7/196.0/196.0 → 113.3/163.5/163.5 |               36.0/94.5/94.5 → 38.4/95.5/95.5 |
| ecs     | pan / 4             |        0–2400 |  63.2/163.4/163.4 → 64.2/213.3/213.3 |               0.0/78.4/78.4 → 0.0/119.1/119.1 |

Each translation retains **11 draws / 999,000 indices / four array vertices** and two buffer creates/deletes in each backend. Uploads remain four per translation: Core 454,960 bytes, ECS 511,808 bytes, including uniforms. Residency remains Core 53 buffers / seven textures and ECS 54 buffers / twelve textures across recorded contexts.

## Actual Workflow example

The document contains 4,801 nodes: 2,400 cards, 2,400 edges and the root. Every card and edge is visible in overview, with image batching enabled. Before/after starting/ending camera, document versions, visibility, palette, allocated GPU bytes and live resources match. Drag keeps the same target/final position, two camera-settlement frames and zero connection endpoint error. Static overview performs zero draws.

| Capture / round | Operation                   | Frames before/after | Engine CPU p50/p95/max ms, before → after | Completion interval p50/p95/max ms, before → after |
| --------------- | --------------------------- | ------------------: | ----------------------------------------: | -------------------------------------------------: |
| profile / 1     | cold-overview-transition    |                 7/6 |         2.8/460.4/460.4 → 2.7/463.4/463.4 |                17.1/479.1/479.1 → 18.2/476.8/476.8 |
| profile / 1     | steady-overview             |               30/30 |               4.7/5.2/5.4 → 3.7/12.9/26.1 |                    16.7/18.4/19.3 → 16.6/21.1/39.5 |
| profile / 1     | time-driven-tour            |              82/101 |       13.9/122.4/150.4 → 13.7/119.2/175.5 |              62.4/408.1/1387.2 → 62.8/331.4/1061.7 |
| profile / 1     | focused-native-pointer-drag |               35/36 |           12.2/24.9/25.3 → 12.3/23.2/27.9 |                 31.8/91.1/138.7 → 31.9/103.1/268.2 |
| ordinary / 1    | cold-overview-transition    |                 7/7 |         3.6/446.8/446.8 → 4.3/401.9/401.9 |                16.6/448.7/448.7 → 15.6/416.0/416.0 |
| ordinary / 1    | steady-overview             |               30/30 |                 2.6/3.0/3.0 → 3.0/8.1/9.1 |                    16.7/18.3/21.8 → 16.5/22.1/24.8 |
| ordinary / 1    | time-driven-tour            |               74/80 |        10.9/141.4/169.6 → 13.0/86.0/188.6 |                67.3/651.0/808.1 → 70.0/687.5/961.9 |
| ordinary / 1    | focused-native-pointer-drag |               41/27 |           11.7/21.8/26.2 → 13.9/18.7/21.9 |                  17.3/104.6/154.0 → 42.7/92.7/95.2 |
| ordinary / 2    | cold-overview-transition    |                 7/7 |         2.9/464.4/464.4 → 3.8/465.6/465.6 |                16.4/476.8/476.8 → 16.4/470.2/470.2 |
| ordinary / 2    | steady-overview             |               30/30 |                 2.4/3.4/3.7 → 3.0/4.2/4.2 |                    16.6/17.5/17.7 → 16.6/18.8/23.9 |
| ordinary / 2    | time-driven-tour            |               77/75 |        11.8/136.4/152.2 → 10.7/91.4/164.4 |                73.4/611.1/843.6 → 57.7/709.5/781.7 |
| ordinary / 2    | focused-native-pointer-drag |               26/37 |           14.6/23.2/26.4 → 11.7/21.8/22.0 |                 54.9/96.5/119.0 → 18.7/132.2/185.6 |

The ordinary tour CPU p95 decreases in both retained pairs, **141.4 → 86.0 ms** and **136.4 → 91.4 ms**. The profiled tour p95 is 122.4 → 119.2 ms. These time-driven tours visit different poses/sample densities with scheduling. Several medians/maxima and steady-overview tails increase, as do both micro pan wall tails and ECS edit geometry p95. All remain above. This is mixed software-rendering evidence rather than a universal speedup or a claim that 2,400-card interaction is smooth. Completion intervals use adjacent recorded completion timestamps, excluding the first frame; they include scheduling/software rendering and are not physical presentation latency or GPU timers.

## Heap and profiling limits

Heap GC occurs after all timed micro operations and again after renderer destruction. Values sum V8 used heap plus external/ArrayBuffer backing storage, excluding native GPU/embedder memory. The fixture still holds app/document references after destruction.

| Backend | After operations, bytes before → after | After renderer destruction, bytes before → after |
| ------- | -------------------------------------: | -----------------------------------------------: |
| core    |                    39574346 → 39543031 |                              25717486 → 25686171 |
| ecs     |                    92156219 → 92127026 |                              74152148 → 74126763 |

These small aggregate retained differences are not exact allocation attribution. The structural result is one fewer point snapshot and one fewer travel snapshot allocated per stroke page rebuild. Native GPU/WebGPU and physical presentation validation remain unavailable.

| Profiled tour scope | Mean exclusive CPU ms/frame, before → after | Calls before/after |
| ------------------- | ------------------------------------------: | -----------------: |
| path.precision      |                                   3.7 → 3.6 |            184/193 |
| stroke.geometry     |                                   9.9 → 8.4 |            155/161 |
| batch.plan          |                                   5.7 → 6.0 |            156/194 |
| visibility.cull     |                                   2.1 → 2.5 |             82/101 |

## Validation and reproduction

-   Core 17 and ECS ten stroke unit cases pass, including new snapshot identity/independence, fixed-buffer lifetime and allocation rollback tests.
-   Chromium 42 unique cases pass. The initial full run passes 40; two ECS high-DPR cases crash during page navigation before assertions. Both unchanged cases pass in a fresh browser process; original traces are retained locally. No timeout/assertion changes.
-   WebKit all 42 rendering/lifecycle cases pass: curves, joins/mirrors/DPR, painter barriers, picking/history, camera migration, full raster export, culling/reentry/same-frame deletion, ownership, startup and idle/wake. The available pinned WPE runtime skips host GUI-library validation, not behavioral assertions.
-   Six real Workflow functional cases pass through 2,400 cards, anchored zoom/pan, connected drag, tour/cancellation, persistence/export and narrow/reduced-motion use.
-   Core, ECS and browser TypeScript checks pass. Normal lint/format/commit hooks and diff checks pass. No dependency, lockfile or CI changes. Remote CI is separate.

```bash
pnpm bench:stroke-reuse
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
```

Use clean paired checkouts and the same `WORKFLOW_CHROMIUM` binary. Restore only both SmoothPolyline files from #711 for the control, keeping all fixtures/probes/scripts identical; run serially and repeat the ordinary pair. Local configs invoke installed Vite directly because this environment provides pnpm 11 while the repository requires pnpm 9; dependencies remain unchanged.

Decompress with `gzip -dc docs/stroke-upload-benchmark.jsonl.gz`. Uncompressed SHA-256 `87c4865b2aad3640aa8fffc7a9ceeb350b8540158407b0b7488fe1c6258c6668` (739304 bytes); compressed SHA-256 `d93b96a5b704e47eef7bda09e031a25702a5d3f158b54aca516fb1ec063b9ce7` (67090 bytes).
