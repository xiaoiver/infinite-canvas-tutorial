> Historical pre-fix evidence from #709 head `9a5b8ad`. CI exposed a missing startup Theme sync, so the Workflow palette differed from requested AppState. Those Workflow timings are retained for traceability and do not establish a valid matched performance result. See [the current report](selection-state-invalidation.md) for corrected verification.

# Stop selection-only state from redrawing static canvases

Following #708, this removes repeated full-canvas rendering caused by selection updates that also reapplied an unchanged theme. The static Workflow improvement is clear; **smooth interaction at 2,400 cards remains unverified**. Active zoom/drag tails remain high, and primary plus supplementary results retain every regression below.

## Trigger, behavior and Core/ECS parity

Workflow uses the default ECS `Pen.HAND` internally while owning its application interactions. `Select.execute` clears built-in selection on non-selection tools each frame. `API.selectNodes([])` previously forwarded the entire prior AppState into `setAppState`, which reapplied Theme and queued unrelated binding/presentation refreshes. The same state-forwarding pattern existed in deselection and three 3D layer-selection helpers. A local observer recorded one Theme invalidation per static frame; its call stacks lead through `Select.execute` and `API.selectNodes` to `safeAddComponent(Theme)`.

The five selection-only patches now send just `layersSelected` and `layersHighlighted`; one unused variable is removed. `setAppState` still merges the patch into the complete state for custom state-management consumers. Selection deduplication, preserving/clearing highlights, 2D/3D companion and gizmo cleanup, actual theme/variable updates, document/history behavior, original geometry, picking and export paths remain unchanged. There is no selection early-return shortcut, render pause switch, cache, culling/LOD substitution or dependency change.

Core already satisfies this contract: [Canvas.mode](../packages/core/src/Canvas.ts) guards unchanged modes, and `Canvas.render` submits work only when dirty. Core production code is unchanged. Both backends now share explicit hand-mode idle/wake, onscreen retention, original export-pixel and resource teardown tests, plus the same 1,000-visible-primitive idle and edit controls. Core fluctuations are controls, not a claimed Core speedup.

## Environment and evidence

Measured serially on 2026-11-23 with Node 24.22.3, Chromium 140.0.7339.186, SwiftShader and DPR 1. Dependencies are reused; lockfile and dependencies are unchanged. Functional checks separately use Chromium 149 and pinned WebKit/WPE. Native GPU, WebGPU and physical presentation timestamps are unavailable.

Idle/edit/no-op final source `95302bc55caf0d63cc2670797127ce114e9bc635`, tree `766ca849c88aae97f24f9e2022c4be0711f40cd6`, is based on #708 merge `1dbead9e13a006db40caed6d0036cddf0958ea83`; reference `45897cf1bbcacf8690538768cb9d673b43d89391`, tree `1bcfae4ffe45659b777ece10fc0d7482499e8090`, restores only `packages/ecs/src/API.ts` from that merge. The settled Workflow pair uses final `3413e7dc114d52abb7cd2ef6b9313beb0315c031`, tree `5aa0207efea61b52ad22637f15f74df68fec99bf`, and reference `f457726c3f1c8fde1f9f48b0b501db9ec53d3ab4`, tree `bfcaf2fe7275627af3ee128ef0715ae9350d1e0a`. These later commits add final onscreen assertions and explicit camera preparation; production behavior is identical to the earlier source. Runtime/fixture/measurement blobs match within each primary pair except for the intended API delta. This report follows those measured commits.

[Raw evidence](selection-invalidation-before-startup-theme-fix.jsonl) contains ten complete clean-source primary captures, four complete supplementary initial Workflow captures, input SHA-256 fingerprints, source blob IDs and serial exit results. Baseline idle/edit/no-op/profile/ordinary ran first, followed by the same five final captures. After diagnosing a queued-camera metadata lag, only the four Workflow captures reran with an explicit common preparation step. The six original idle/edit/no-op inputs remain primary, together with four settled Workflow inputs. No tests/lint or live browser verification overlap capture windows; all fourteen runs exit successfully. The redraw-reason observer is an excluded diagnostic, not a timing control.

Idle/edit preserve the existing `floor(n*q)` percentile definition; Workflow/no-op use nearest rank `ceil(n*q)-1`. Core CPU spans action plus `Canvas.render`; ECS/Workflow CPU spans `world.execute`, including awaits. Completed-frame intervals include scheduling and software rendering. Idle samples are engine ticks preserving the same composed picture, with no new draw submission. These intervals are not physical display/GPU execution timers.

## Static Core/ECS control

The actual scene contains 1,000 visible primitives: 200 each rect, ellipse, text, polyline and path. Text batching is off/on; LOD is off. Thirty measured idle samples follow 15 warmups after switching to hand mode. Full exports before/after have identical pixels; a native two-frame pan wakes rendering, and teardown ownership checks pass. Visible/primitive counts, resident resource maps and allocated bytes match across revisions.

| Backend | Text batching | Idle CPU p50/p95 ms, before → after | Nonempty frames / 30 | Draws per frame | Indices per frame | Allocated buffer bytes |
| ------- | ------------- | ----------------------------------: | -------------------: | --------------: | ----------------: | ---------------------: |
| core    | off           |                   0.8/1.8 → 0.7/0.9 |                0 → 0 |           0 → 0 |             0 → 0 |                1931220 |
| core    | on            |                   0.7/1.0 → 0.5/0.6 |                0 → 0 |           0 → 0 |             0 → 0 |                1892956 |
| ecs     | off           |                 15.6/23.4 → 2.7/3.7 |               30 → 0 |         602 → 0 |        395280 → 0 |                2206188 |
| ecs     | on            |                 14.1/19.3 → 2.9/3.7 |               30 → 0 |         403 → 0 |        395280 → 0 |                2158428 |

Every native counter in the final measured idle frames is zero, including uploads, creates and deletes. GPU objects remain resident for the next real edit; skipping idle work does not hide or remove nodes. Core was already idle before the change.

## Unchanged commits in the actual Workflow

All 2,400 cards, 2,400 edges and the root are present (4,801 nodes); every card and edge is visible in overview. After three completed frames, record 35 empty `capture: NEVER` edits, discarding five warmups. The temporary snapshot observer restores in `finally`, two later frames succeed and real teardown passes.

| Metric                             |      Before |    After |
| ---------------------------------- | ----------: | -------: |
| Invalid present versions           |           0 |        0 |
| Snapshot / element Map reuses      |       30/30 |    30/30 |
| Snapshot p50/p95 ms                |    7.1/13.4 |  3.9/8.8 |
| Engine CPU p50/p95 ms              |   24.0/31.3 | 8.6/14.1 |
| Draws / indices per measured frame | 22 / 614406 |    0 / 0 |

The version/snapshot fix from #708 stays intact. Snapshot comparison code does not change here; its timing movement is not a separate algorithm improvement. Overview retains 86 main-renderer buffers, 14 textures and 3,078,076 allocated buffer bytes, with auxiliary offscreen resources tracked separately. All visible counts, camera, canvas size, version diagnostics, resident resources and allocated bytes match.

## Editing controls

These retain the existing default tool and edit 10 of the same 1,000 visible primitives. Thirty samples follow 15 warmups; instrumentation is then restored. Native counters, visible/primitive counts, resource maps and allocated bytes match in all four control and profiled cases.

| Backend | Text batching | Control CPU p50/p95 ms, before → after | Profiled CPU p50/p95 ms, before → after | Draws | Indices / array vertices |
| ------- | ------------- | -------------------------------------: | --------------------------------------: | ----: | -----------------------: |
| core    | off           |                    8.8/13.8 → 9.9/17.3 |                   12.0/23.2 → 10.4/22.2 |   603 |               395280 / 4 |
| core    | on            |                   9.1/17.1 → 12.1/22.6 |                    11.4/17.3 → 9.3/14.3 |   407 |               395280 / 4 |
| ecs     | off           |                  28.8/42.4 → 29.5/34.4 |                   28.4/35.1 → 26.6/34.7 |   602 |               395280 / 4 |
| ecs     | on            |                  26.5/47.8 → 26.7/36.2 |                   26.6/32.1 → 26.2/34.1 |   407 |               395280 / 4 |

Both Core control modes regress despite no Core production change. ECS control p50 also increases slightly, while its p95 decreases; the profiled ECS batching-on p95 increases. These results do not establish a general editing speedup.

## Actual Workflow interaction

Image batching remains enabled. Overview has 2,400 cards and 2,400 edges visible; focused native-pointer drag has 45 cards and 42 edges visible in the 4,801-node document. The primary pair waits two engine frames after zoom, asserts UI/applied/start camera agreement, and retains preparation frames separately from measured drag frames. Before/after camera, visibility, resident resources, pointer target and final coordinates match exactly; connected endpoint error is zero. The ten-second tour is time driven, so frame counts/densities vary with scheduling; raw camera poses and native counters are retained. Cold overview always precedes profiling, including the profile-labelled file.

| Capture  | Operation                   | Frames before/after |  CPU p50/p95/max ms, before → after | Completion interval p50/p95 ms, before → after |
| -------- | --------------------------- | ------------------: | ----------------------------------: | ---------------------------------------------: |
| profile  | cold-overview-transition    |                 8/7 |   5.0/600.8/600.8 → 6.0/570.0/570.0 |                        17.0/612.3 → 15.2/580.8 |
| profile  | steady-overview             |               30/30 |       14.5/22.9/24.2 → 3.8/5.7/10.9 |                        426.4/880.5 → 16.5/22.4 |
| profile  | time-driven-tour            |              45/101 | 19.3/210.5/225.6 → 15.6/124.1/226.1 |                       106.3/948.1 → 71.3/351.3 |
| profile  | focused-native-pointer-drag |               24/35 |     23.2/33.4/35.1 → 18.1/30.1/39.4 |                        65.0/126.3 → 30.8/108.5 |
| ordinary | cold-overview-transition    |                11/9 |  11.1/673.5/673.5 → 4.7/397.5/397.5 |                        22.3/679.2 → 14.1/409.3 |
| ordinary | steady-overview             |               30/30 |        13.5/23.4/24.1 → 3.8/5.1/9.0 |                        411.7/851.7 → 16.6/24.2 |
| ordinary | time-driven-tour            |              56/106 | 19.4/198.1/265.9 → 14.3/119.2/216.0 |                        89.9/709.5 → 63.6/365.6 |
| ordinary | focused-native-pointer-drag |               23/31 |     19.9/30.4/41.4 → 15.3/26.8/30.0 |                         63.6/140.3 → 42.6/87.3 |

Ordinary static overview completion intervals are 411.7/851.7 → 16.6/24.2 ms while draws fall from 22 to zero. This is an idle improvement. Ordinary tour CPU p95 is 198.1 → 119.2 ms and its maximum 265.9 → 216.0 ms; ordinary drag maximum is 41.4 → 30.0 ms. These active-view tails keep the 2,400-card smooth zoom/drag goal open. Remaining work includes active-view geometry/submission and software-rendering waits, followed by native GPU/presentation validation.

The settled profiled tour points to a concrete next target: mean exclusive `stroke.geometry` is 9.96 ms/frame, `batch.plan` 5.43 ms and `path.precision` 4.91 ms. One 226.1 ms engine tail contains 84.4 ms in `stroke.geometry`, 55.8 ms in `path.precision` and 31.3 ms in `batch.plan`, with 22 draws and 617,796 submitted indices. These are recorded CPU scopes, not physical GPU execution times; curve geometry/precision work should be investigated before inferring a batching or hardware-GPU bottleneck.

## Initial Workflow captures retained

The initial ordinary baseline drag start metadata still showed the previous queued zoom (0.32155), while every measured frame, its native pointer target and end view used 0.38586 exactly as the final capture. The revised benchmark settles two engine frames, asserts camera agreement and retains those preparation frames outside the drag sample. All four initial captures remain here and in the raw evidence, including the worse ordinary tour p95 and 115.3 ms drag maximum. They are supplementary rather than substituted into the settled pair.

| Initial capture | Operation                   | Frames before/after |  CPU p50/p95/max ms, before → after | Completion interval p50/p95 ms, before → after |
| --------------- | --------------------------- | ------------------: | ----------------------------------: | ---------------------------------------------: |
| profile         | cold-overview-transition    |                 6/7 |   3.2/489.9/489.9 → 3.5/459.0/459.0 |                        19.2/501.4 → 16.8/472.0 |
| profile         | steady-overview             |               30/30 |        14.9/20.1/20.8 → 3.8/5.4/9.2 |                       546.9/1153.0 → 16.7/21.5 |
| profile         | time-driven-tour            |               39/81 | 24.6/172.9/182.5 → 15.0/130.1/205.4 |                      155.7/1092.7 → 64.8/627.9 |
| profile         | focused-native-pointer-drag |               24/34 |     17.9/23.4/26.9 → 13.0/29.1/35.7 |                        57.4/111.7 → 29.6/110.5 |
| ordinary        | cold-overview-transition    |                 7/6 |   5.2/591.6/591.6 → 2.9/445.1/445.1 |                        21.7/604.5 → 16.6/455.5 |
| ordinary        | steady-overview             |               30/30 |       15.4/22.1/26.3 → 3.0/5.7/23.5 |                       422.2/1116.4 → 16.6/19.8 |
| ordinary        | time-driven-tour            |               70/84 | 14.9/133.8/218.0 → 13.4/137.7/236.9 |                        72.9/492.6 → 68.3/489.5 |
| ordinary        | focused-native-pointer-drag |               25/40 |    18.7/31.3/59.6 → 13.5/30.8/115.3 |                        48.3/128.6 → 27.1/125.6 |

## Reproduce

```bash
pnpm bench:idle-rendering
pnpm bench:edit-phases
pnpm bench:document-versions
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 WORKFLOW_BENCH_OUTPUT=.test-results/selection-profile.json pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 WORKFLOW_BENCH_OUTPUT=.test-results/selection-ordinary.json pnpm bench:workflow
```

Use one browser binary, clean commits and serial runs. Restore only `packages/ecs/src/API.ts` from `1dbead9` for the paired legacy reference while retaining current scripts/fixtures. That reference must set `WORKFLOW_BENCH_EXPECT_IDLE_DRAWS=22` for Workflow and no-op captures; the current default is zero. This variable changes only assertions, not the page, renderer or workload, so legacy redraws remain measurable without relaxing the current idle regression. Image-batching-off legacy overview still expects 2,412 draws.

`WORKFLOW_CHROMIUM` selects the Workflow/no-op executable. Idle/edit use local extending configs selecting the same Chromium 140 via `use.launchOptions.executablePath`, with correct `testDir` and root `webServer.cwd`; those formal configs do not consume that variable. Installed pinned browsers produce a different environment. For historical #708 timing results, use that PR’s source and assertions instead of mixing its captures with the new idle contract.

## Validation and limitations

-   **14 Core + 253 unique ECS tests passed**, across 15 files: Core history/serialize; ECS selection-state-invalidation, history-document, history-3D-sync, edit-stage, mesh3d-layers, gizmo-lifecycle, design-variables, history-inheritance-sync/delta/boundary/property-sync/rough-sync and document-version. The new 2D state-ownership case fails before the fix; the old ECS browser case renders all six idle frames instead of zero, while the Core control already passes.
-   **19 Chromium + 19 WebKit + 6 real Workflow cases passed**. Retained onscreen pixels and nonblank canvas interiors are checked without an intervening forced export; native pan/edit draws visibly change the screen, original full exports retain pixel equality across idle, and final idle/resource teardown checks pass. Final screenshot assertions reran both backend cases in Chromium and WebKit successfully. Existing coverage includes painter barriers, picking/transforms/history, camera migration, full raster exports, culling/reentry/same-frame removal and resource ownership. Workflow covers all scales through 2,400, endpoint-connected dragging, anchored zoom/pan, tour/cancellation, reduction, persistence/export and narrow/reduced-motion behavior.
-   **Five typechecks passed** (Core, ECS, browser, benchmark, Workflow benchmark); browser typechecking reran after final screenshot assertions. Changed-file lint/diff checks and normal hooks passed. Ten primary and four preserved supplementary captures passed. Within each primary pair, runtime/workload instrumentation matches except the intended API delta. Workflow typechecking reran after the settlement assertion was added.
-   Local reused dependencies contained two physical copies of `loaders.gl` 4.5.2, so an existing model mock initially missed the actual import. One legacy 3D case failed and an unintended `models.example` request was rejected by automatic approval review. An ignored local Jest mapper canonicalizes that module, and fetch/HTTP/HTTPS/socket attempts are denied for offline tests; both 3D/gizmo suites then passed 35 tests with no external model access. Existing model-test assertions and CI workflow configuration are unchanged; the resolver override remains local.
-   Headless WebKit uses WPE with GUI-only host validation bypassed; no behavioral assertions are skipped. Whole-repository CI and representative native-GPU/WebGPU/presentation measurements are not local results.
