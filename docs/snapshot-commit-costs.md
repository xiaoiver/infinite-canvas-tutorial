# Reduce ECS snapshot comparison work per edit commit

This follows #705 and targets the actual Workflow edit phase. Each changed snapshot now deeply compares each incoming node once, copies the Map lazily, and clones only added or changed nodes. A controlled getter regression reproduces two reads on the old implementation and one on the new implementation when editing another node. The history/commit boundaries are unchanged. **This does not establish smooth interaction at 2,400 nodes.**

## Contract and Core/ECS parity

-   ECS `Snapshot.maybeCreateElementsSnapshot` previously ran change detection and then another structural-sharing pass. The new pass keeps owned unchanged node identities, original Map order, missing-node tombstones and the existing missing-tombstone metadata signal. New/changed values are still `structuredClone`d. Deep comparison still detects nested in-place edits without version changes; no version-only fast path or retained hash is introduced.
-   `API.edit`, `API.record`, Store/history batching, collaborative state, selection, export data and document fields are unchanged. Public `getNodes()` mutability is not restricted.
-   Core has no ECS Store/Snapshot history layer. Its scene setter path (`packages/core/src/shapes/mixins/Transformable.ts`) and `Canvas.render()` already mutate/render directly. Core production code is intentionally unchanged. Both backends use the existing `mixed-renderer` edit fixture and the same 1,000 visible mixed primitives, ten edited nodes per measured frame, text batching off/on, 30 samples and 15 warmups. Core is a control, not a claimed beneficiary of the ECS snapshot change.
-   The diagnostic-only Workflow entry adds nested scopes for edit nodes/record, Store commit and snapshot methods. The shipped entry remains `main.ts`. Instrumentation is optional and restored on disposal. Inclusive nested scopes must not be added together.

## Environment and provenance

Measured serially on 2026-11-23, Debian 13, Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader, DPR 1. Functional regression uses Chromium 149 and pinned WebKit separately. Native hardware GPU, WebGPU and presentation timing are unmeasured. This workspace reuses installed dependencies; no lockfile or dependency changes.

Baseline source `adbe77633189847fe2a1889524e8c1ec62e02936`, tree `ab7a0ee795def716244255fe266619f568dbfe43`, uses the merged #705 Snapshot with the same stable diagnostic boundaries as the final source. Final measured source `31826015becfb5d6abb0bc2677ad96a5252228d3`, tree `3977f417de88e6ba80668b1f5d2d9be2e7a505c8`. All six qualified inputs report `dirty: false`. Local measurement-reference commits are not release branches.

Baseline Snapshot blob `f39d3ad3c150fde03cefdd91fe863dcfd2020e28`; final `002055104327715b56bdbbb0ef9393eeeb6904cd`. [Raw samples](./snapshot-commit-costs-benchmark.jsonl) retain all six original captures, per-input SHA-256, source provenance, native/resource counts, scope timings and slow frames. Preliminary measurements using separate detect/clone scopes are excluded from the comparison because their instrumentation boundary differs.

## Actual Workflow: 2,400 cards plus 2,400 edges

Image/path batching is enabled throughout. Overview has 2,400 actually visible cards and 2,400 visible edges, 4,801 document nodes, 1,148×914 canvas in a 1,500×980 viewport. Every measured steady frame retains 22 drawcalls, 614,406 indices, 86 main-render-context buffers, 3,078,076 allocated buffer bytes, 14 textures, and one 192-byte scene uniform upload; the auxiliary context is counted separately in the raw data.

CPU below surrounds `world.execute()` including any waits inside it. It is not GPU/presentation/FPS. Workflow percentiles use `ceil(n × fraction) − 1`. Cold transition is unprofiled in both modes.

| Capture  | Operation                   | Frames old → new | CPU p50/p95 ms old → new | Maximum CPU ms old → new |
| -------- | --------------------------- | ---------------: | -----------------------: | -----------------------: |
| ordinary | cold-overview-transition    |            8 → 8 |    4.6/575.7 → 4.7/524.3 |            575.7 → 524.3 |
| ordinary | steady-overview             |          30 → 30 |    13.9/19.7 → 14.6/20.8 |              22.6 → 21.7 |
| ordinary | time-driven-tour            |          45 → 24 |  16.8/218.2 → 20.5/176.9 |            255.5 → 260.1 |
| ordinary | focused-native-pointer-drag |          27 → 23 |    18.5/27.6 → 16.6/25.7 |              29.6 → 43.5 |
| profile  | cold-overview-transition    |            7 → 7 |        6/546 → 4.6/602.5 |              546 → 602.5 |
| profile  | steady-overview             |          30 → 30 |    15.3/19.6 → 13.9/18.2 |              31.6 → 19.2 |
| profile  | time-driven-tour            |          25 → 33 |  18.6/196.5 → 20.1/217.2 |              209 → 228.2 |
| profile  | focused-native-pointer-drag |          24 → 23 |    22.4/43.5 → 17.5/33.4 |              43.7 → 34.6 |

Native drag sends the same twenty out/back pointer moves in the 2,400-card document at readable zoom: initially **45 visible cards and 42 edges**, with a final 36/30 plus selection overlay after zoom. All four endpoint checks are zero error, final node coordinates agree, and start/end counts, resources and allocated bytes agree. Event coalescing produces differing frame counts; time-driven tours also visit differing camera samples. Do not interpret the rows as a causal full-frame speedup. Ordinary drag maximum worsens even though its p50/p95 improve; ordinary steady CPU and profiled tour p95 also worsen.

For the same **21 actual snapshot calls** during profiled drag, inclusive `history.elements` is 172.1 → 139.5 ms total, **8.20 → 6.64 ms per call**. Per captured frame it is 7.17 → 6.07 ms (24 → 23 frames). Inclusive `edit.apply` averages 12.25 → 10.72 ms/frame. These nested scopes overlap. The edit phase remains substantial.

Completion intervals between finished engine frames include work/waits outside `world.execute()` and remain poor. They are not native presentation/GPU completion intervals:

| Capture  | Operation                   | Completion interval p50/p95 ms old → new |
| -------- | --------------------------- | ---------------------------------------: |
| ordinary | cold-overview-transition    |                    18/579.5 → 18.2/529.9 |
| ordinary | steady-overview             |              737.4/1412.4 → 619.5/1463.6 |
| ordinary | time-driven-tour            |               114.9/880.8 → 575.9/1315.5 |
| ordinary | focused-native-pointer-drag |                  68.3/190.7 → 59.2/126.7 |
| profile  | cold-overview-transition    |                  17.5/557.8 → 17.1/614.6 |
| profile  | steady-overview             |                 491.5/1517.3 → 404/960.6 |
| profile  | time-driven-tour            |              301.2/1172.3 → 219.6/1476.1 |
| profile  | focused-native-pointer-drag |                      57/124.1 → 54/113.4 |

## Paired Core/ECS controls

Each scene has 1,000 actually visible primitives: 200 rectangles, ellipses, text nodes, polylines and paths each. `on/off` refers to text batching, with LOD disabled (zero proxies). The fixture’s raw `cpuP50/cpuP95` and the script’s auxiliary phase summary use their existing `floor(n × fraction)` index, unlike the Workflow nearest-rank convention above. Values below are the raw unprofiled controls. Core synchronous render and ECS frame/wait boundaries differ, so compare each backend with its own baseline.

| Backend | Text batching | Control CPU p50/p95 ms old → new | Drawcalls | Indices | Allocated buffer bytes |
| ------- | ------------- | -------------------------------: | --------: | ------: | ---------------------: |
| core    | off           |              7.6/12.7 → 8.5/14.1 |       603 |  395280 |                1931220 |
| core    | on            |              9.8/22.6 → 8.5/13.9 |       407 |  395280 |                1893724 |
| ecs     | off           |              29/34.7 → 27.5/33.3 |       602 |  395280 |                2206188 |
| ecs     | on            |            26.3/35.3 → 28.1/49.4 |       407 |  395280 |                2159388 |

The ECS text-batching-on row regresses (p95 35.3 → 49.4 ms), and Core off also worsens. These are retained rather than claiming a general speedup from the reduced comparison count. In both control and profiled modes all before/after visible counts, primitive counts, native counters, allocated bytes and resource maps match exactly. Every paired run also asserts control/profile native parity, restored unprofiled methods, nonempty renders and teardown.

## Reproduce

Run serially with one browser binary and a clean commit. Normal pinned-browser commands:

```bash
pnpm bench:edit-phases
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 WORKFLOW_BENCH_OUTPUT=.test-results/snapshot-profile.json pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 WORKFLOW_BENCH_OUTPUT=.test-results/snapshot-ordinary.json pnpm bench:workflow
```

To create a paired baseline from this change, keep all fixtures/instrumentation identical, restore only `packages/ecs/src/history/Snapshot.ts` from `e5b73da`, and commit that reference before measuring. `WORKFLOW_CHROMIUM` selects an alternative executable for Workflow. The edit-phases config does not consume that variable: these local captures use an ignored config extending `playwright.edit-phases-bench.config.ts`, setting `use.launchOptions.executablePath` to cached Chromium 140, preserving root `webServer.cwd` and `testDir` after relocating the config. Leaving the override out uses the installed pinned browser and changes the measurement environment. No assertions or benchmark workloads are removed.

## Validation

-   93 ECS tests across history-delta, history-boundary, history-document, history-inheritance-sync and edit-stage passed. Existing tests cover nested in-place edits, no-change identity, deletion/resurrection, app-state isolation, group inheritance and history commit order. New regression fails with two getter reads on the old implementation and passes with one on the new.
-   Chromium: 14 initial functional cases passed; two mixed-renderer cases initially timed out during navigation under the local 30-second aggregate budget. Both pass when rerun alone (7.4/10.1 seconds) with a 120-second local ceiling. No production/test assertions were weakened.
-   WebKit: 16/16 related browser cases passed, covering both backends, profiling restoration/pixels, mixed workloads, selection/history/camera migration, full exports, culling/reentry/same-frame removal and resources. Bundled WPE runtime uses host GUI validation bypass only; no cases/assertions skipped.
-   Workflow demo: 6/6 passed, including real card movement, settings/persistence/JSON export, connected endpoints, anchored zoom/pan, all scales through 2,400, tour cancellation/completion, scene reduction and narrow viewport/reduced motion.
-   ECS and benchmark TypeScript checks, changed-file ESLint, git diff checks and normal pre-commit/commit-message hooks passed. Whole-repository CI, native hardware GPU and native WebGPU are not local results.
-   All qualified performance scripts completed, including actual drag movement/connection checks, paired workloads/native/resource checks and teardown. No 60-FPS or fixed multiple claim is made. Remaining work: investigate the residual snapshot/edit cost, upload/packing and frame-completion scheduling on representative hardware.
