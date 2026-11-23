# Initialize optional document versions in Core and ECS

Following #707, this fixes invalid version metadata and restores unchanged ECS snapshot ownership. It does **not** establish smoother interaction at 2,400 cards: this pair retains worse edit/tour timings and long frame-completion intervals.

## Cause and behavior

Core `newElementWith` added one to an optional version; ECS `mutateElement` incremented it directly. An absent version therefore became `NaN`, which JSON serializes as `null`. In the real 4,801-node Workflow document, 49 nodes acquired this invalid value. Deep equality correctly treats `NaN` as unequal, so even an unchanged commit cloned these nodes and replaced the owned element Map.

Both update paths now use `(element.version || 0) + 1`, matching the existing ECS snapshot copy helper. Missing, zero and existing `NaN` versions become 1 on a real update; finite positive counters keep incrementing. No-op updates preserve identity, version, nonce and timestamp. Existing invalid values are repaired when updated, not through an import migration. This is not general validation of arbitrary nonfinite versions such as Infinity.

Only those two production lines change. Deep equality, history/collaboration rules, omitted tombstone metadata notifications, scene data ownership, render selection, LOD defaults, picking, exports and resource ownership retain their existing paths. Core `history/mutate.ts` is an existing no-op stub and is not changed. The snapshot benchmark observes ECS; Core serialized-copy correctness has direct unit coverage. Core Shape-edit timings below are controls and do not exercise its serialized-copy helper.

## Measurement and reproducibility

Measured serially on 2026-11-23 with Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Dependencies and lockfile are unchanged. Baseline `87fa202dd89ae928690226544abdba527739c66b`, tree `fc279d58f63081e49e68595fda10db40ba7f2ffe`, is #707 merge `0292192` plus test-first instrumentation and regressions. Final measured source `7ea2da27e7078f24ab088f5f8fef10aa77c5c09e`, tree `e096d3bdb6f78aa3dbc5a9322c873ab373571de8`. Subsequent changes format new test/instrumentation code and add this report; production behavior is identical. All eight input files report clean sources.

[Raw evidence](document-version-benchmark.jsonl) contains eight complete qualified captures, SHA-256 input fingerprints, source blob IDs, serial-run results, and three explicitly excluded diagnostic summaries/data sets. Each JSONL line is one envelope; the paired Core/ECS capture contains four records. No timing rows are discarded or replaced by favorable repeats.

Workflow and no-op percentiles use nearest rank `ceil(n*q)-1`; the existing edit-phases script uses `floor(n*q)`. Tables preserve their stored definitions. Snapshot time is synchronous `maybeClone` wall time. Engine CPU wall time spans `world.execute`, including its awaits. Completion intervals measure successive completed samples and include scheduling/software-rendering waits; they are not display presentation or hardware GPU timers.

## Unchanged Workflow commits

Use the actual 2,400 cards plus 2,400 edges and root (4,801 nodes), all visible in overview. Warm three completed frames, then record 35 empty `capture: NEVER` edits and discard five warmups. The temporary `Snapshot.prototype.maybeClone` observer is restored in `finally`; two later frames and real teardown are checked. Node version diagnostics run outside the measured frame.

| Metric                   |    Before |     After |
| ------------------------ | --------: | --------: |
| Invalid present versions |        49 |         0 |
| Snapshot reuses / 30     |         0 |        30 |
| Element Map reuses / 30  |         0 |        30 |
| Snapshot p50/p95 ms      |  8.4/17.3 |  6.8/15.3 |
| Engine CPU p50/p95 ms    | 21.6/39.9 | 23.9/31.0 |

Snapshot ownership recovery is deterministic in this loaded graph, while engine CPU p50 regresses. This is not a universal no-notification promise: omitted historical tombstones can still produce the existing metadata notification. Overview counters remain 22 draws, 614,406 indices, 86 main-renderer buffers, 14 textures and 3,078,076 allocated buffer bytes. Auxiliary offscreen resources are tracked separately; teardown uses the existing ownership/leak contract rather than requiring every global context to have zero objects.

## Core/ECS editing controls

Each backend renders 1,000 visible primitives (200 each rect, ellipse, text, polyline, path), editing 10 nodes; 30 measured samples follow 15 warmups, with text batching off/on. Control and instrumented captures use the same workload, and instrumentation is then restored.

| Backend | Text batching | Control CPU p50/p95 ms, before → after | Profiled CPU p50/p95 ms, before → after | Draws | Indices / array vertices | Allocated buffer bytes |
| ------- | ------------- | -------------------------------------: | --------------------------------------: | ----: | -----------------------: | ---------------------: |
| core    | off           |                    8.5/13.3 → 7.0/12.4 |                     8.9/14.5 → 7.2/13.5 |   603 |               395280 / 4 |                1931220 |
| core    | on            |                  11.7/14.8 → 10.2/16.8 |                    9.3/13.9 → 10.9/18.1 |   407 |               395280 / 4 |                1893724 |
| ecs     | off           |                  27.7/34.0 → 29.2/39.9 |                   28.5/36.1 → 26.4/33.8 |   602 |               395280 / 4 |                2206188 |
| ecs     | on            |                  27.0/45.7 → 27.9/47.6 |                   26.0/41.8 → 23.8/30.9 |   407 |               395280 / 4 |                2159388 |

Both ECS control modes regress in this pair, as does Core text-batching-on p95. Before/after visible/primitive counts, every native counter, allocated bytes and resource maps match in all four control and profiled modes. No performance improvement is inferred from these controls.

## Actual Workflow interaction

Both captures use image batching enabled with the same real page, native-pointer path, overview, anchored zoom/tour and focused drag. Overview has 2,400 cards and 2,400 edges visible; focused drag has 45 cards and 42 edges visible within the 4,801-node document. Target coordinates, final position, camera, visible counts and resource maps match; connected endpoint error is zero. The tour is time driven, so frame counts differ with scheduling; counts below are not normalized into an FPS claim. Cold overview is always collected before profiling starts, including in the profile-labelled file.

| Capture  | Operation                   | Frames before/after |  CPU p50/p95/max ms, before → after | Completion interval p50/p95 ms, before → after |
| -------- | --------------------------- | ------------------: | ----------------------------------: | ---------------------------------------------: |
| profile  | cold-overview-transition    |                6/10 |   3.8/466.2/466.2 → 4.8/476.1/476.1 |                        18.3/480.3 → 20.3/509.9 |
| profile  | steady-overview             |               30/30 |     14.2/27.1/28.5 → 14.5/23.1/25.5 |                    404.1/1303.9 → 691.3/1422.0 |
| profile  | time-driven-tour            |               57/26 | 15.7/164.9/214.6 → 24.7/178.5/198.1 |                      79.7/819.9 → 323.6/1213.9 |
| profile  | focused-native-pointer-drag |               24/26 |     19.7/27.8/31.0 → 22.4/36.1/60.5 |                        60.7/130.0 → 68.5/194.4 |
| ordinary | cold-overview-transition    |                 7/8 |   5.3/584.2/584.2 → 4.4/532.0/532.0 |                        17.3/599.4 → 18.1/553.4 |
| ordinary | steady-overview             |               30/30 |     13.3/21.3/24.0 → 13.9/19.5/20.8 |                    486.7/1472.1 → 538.9/1178.8 |
| ordinary | time-driven-tour            |               36/28 | 20.1/171.4/175.5 → 20.6/191.6/216.1 |                      180.7/681.8 → 311.7/933.6 |
| ordinary | focused-native-pointer-drag |               23/27 |     18.5/28.1/31.1 → 17.7/27.6/61.6 |                        57.3/113.4 → 58.1/129.9 |

The ordinary overview CPU tail improves slightly, but its completion intervals remain hundreds of milliseconds. Tour p95 and ordinary drag maximum regress. These single serial pairs are noisy under software rendering and cannot attribute every timing difference to the two version lines; they also do not support a broad speedup claim. All original workload/native/endpoint/teardown assertions passed.

## Excluded diagnostics and next investigation

Before choosing the version fix, a CDP trace of the #707 source captured a 15,537.8 ms steady window: engine CPU summed to 582.1 ms, renderer-main root occupancy to 701.1 ms and software GPU-process main-thread root occupancy to 15,511.3 ms. `GLContextEGL::MakeCurrent` occupied 7,128.9 ms inside that GPU-thread window; it must not be added to root occupancy. Steady GC roots totaled approximately 12.5 ms. This localizes long waits/CPU software rendering outside the measured engine CPU, without measuring physical GPU execution.

A diagnostic `willReadFrequently` trial for the two UI canvases still had 14,103.6 ms GPU-process root occupancy within a 14,120.1 ms window. It was not adopted. Offline equality variants over owned structured clones did not show a dependable improvement and were not adopted; all agreed on 49 `.version: NaN` mismatches. Current/loop/one-array/no-array p50/p95 were 2.9/6.0, 2.8/6.2, 3.3/4.2 and 8.4/12.6 ms.

Trace overhead and the UI variation exclude those runs from qualified before/after timings. Full CDP streams remain local; their hashes, capture metadata, interval-union method and compact summaries are in the raw evidence. Further work should separate frame submission, context switching/waits and presentation on representative native GPU hardware, while retaining the same Core/ECS controls. The remaining O(document size) equality/indexing work and software-rendering cadence are not solved here.

## Reproduce

```bash
pnpm bench:document-versions
pnpm bench:edit-phases
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 WORKFLOW_BENCH_OUTPUT=.test-results/version-profile.json pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 WORKFLOW_BENCH_OUTPUT=.test-results/version-ordinary.json pnpm bench:workflow
```

Use one browser binary and clean commits, with no concurrent test/lint jobs. `WORKFLOW_CHROMIUM` selects the Workflow/no-op binary. For edit-phases, select the same executable via `use.launchOptions.executablePath` in an extending local config (also set correct `testDir` and root `webServer.cwd`); its formal config does not consume that variable. To reproduce the baseline, retain these scripts/fixtures, restore only `packages/core/src/utils/serialize.ts` and `packages/ecs/src/history/ElementsChange.ts` from `0292192`, and commit the reference. This pair measured baseline no-op, final no-op, then baseline edit/profile/ordinary and final edit/profile/ordinary serially.

## Validation

-   Core history/serialize: 14 tests passed. New table-driven tests cover absent, zero, finite and NaN versions, JSON, source ownership, no-op identity and forced copies. Before the fix, absent/NaN cases failed.
-   ECS: 206 unique related tests across 9 files passed (history document/delta/boundary/property/inheritance/rough/3D, edit-stage, and the new document-version file). The final document pair passed 35 tests after isolating the fresh-world regression from intentional retained-tombstone metadata signals. New regression covers versionless real edits, owned snapshot reuse, stable no-op metadata, empty-commit notification and undo/redo. Before the fix it received NaN instead of version 1.
-   Chromium: 17 unique related browser cases passed, with one initial ECS mixed-renderer reload remaining at Loading beyond its existing five-second Ready assertion; the exact case passed standalone with original assertions/timeouts. WebKit: 17 passed; actual Workflow demo: 6 passed. Coverage includes pixels, original interaction geometry, history, camera migration, exports, culling/reentry/removal, profiling restoration and resource lifecycle.
-   Core, ECS, browser, benchmark and Workflow-benchmark typechecks passed. Changed-file lint, diff checks and normal hooks passed. Eight qualified benchmark inputs passed without overlapping local checks.
-   Functional browsers use Chromium 149 and pinned headless WebKit/WPE. GUI-only WebKit host validation is bypassed; behavioral assertions are unchanged. Whole-repository CI, WebGPU and representative hardware GPU/presentation tests are not claimed as local results.
