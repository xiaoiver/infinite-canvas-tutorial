# Scope inherited paint resolution to affected ECS nodes

This follows #706 and reduces paint computation during node updates. **It does not establish smooth interaction at 2,400 nodes.** Profiled update scopes improve, but ordinary captures are inconsistent and retain a 161.2 ms long frame. All before/after rows and the reverse-order repeat are reported below.

## Behavior and Core/ECS parity

-   ECS `getComputedInheritGroupWireMap` accepts an optional requested-ID set. It still indexes the complete scene and resolves ancestor groups outside that set. Only requested nodes have their own paint computed and returned; the default full-scene behavior used by deserialization/SVG serialization is unchanged. Single-ID lookups now request just that ID.
-   `API` passes its existing affected-node closure, including untouched descendants, after merging the entire batch into the final scene. Parent changes, explicit empty/zero overrides, removed overrides, themes, variables, new nodes and history keep their current behavior. No authored inherited values are baked into children.
-   This remains O(document size) for scene/parent indexing and affected-descendant collection. It reduces unnecessary paint merging/copies, with no persistent index, hash, retained cache or version-only skip. Every call reads current scene data; original document, history, collaboration, interaction geometry, export and render/resource ownership paths remain intact.
-   Core has no ECS serialized-document inheritance pass. `packages/core/src/shapes/mixins/Transformable.ts` and `Renderable.ts` directly update each Shape; Core production code is unchanged. Core/ECS both run the same qualified 1,000-visible-primitive edit workload, text batching off/on, plus both-backend browser pixel/export/interaction/resource checks. Core timings are controls, not a claimed Core speedup.
-   Two regressions reproduce **three reads of unrelated paint before and zero after**: one single-ID utility query, and a real ECS one-node batch measured inside the edit callback before history capture. The latter also validates undo/redo, unchanged unrelated paint and inherited child color.

## Environment and provenance

Measured serially on 2026-11-23: Debian 13, Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader, DPR 1. Functional checks separately use Chromium 149 and pinned WebKit. No representative native GPU, WebGPU or presentation measurements are available. Installed dependencies are reused without lockfile/dependency changes.

Baseline source `40179cdb3dd7ce0a843a015cff41491da4a96820`, tree `cea68eea3ff69b45d03e3a626a04820706dbfd92`, is #706 merge `928adb2` plus test-first regressions; its production code matches that merge. Final measured source `cda0062191a383985003a96767e406ccfbd319d2`, tree `34e57773b8a1cebb94c3885625b420ec2d8fd81a`. Benchmark scripts, instrumentation and workload fixtures are identical. Qualified runs start clean and do not overlap local lint/typecheck/unit/functional checks. The ordinary repeat deliberately runs final then baseline, reversing the first pair. Local reference commits are not release branches.

[Raw data](./inherited-presentation-benchmark.jsonl) contains all eight qualified captures, all three excluded first-batch captures, input SHA-256, production Git blob IDs, full counters, timings, scopes and tails. The first batch overlapped local lint and subsequent checks and is explicitly **unqualified**; none of its timing values enter these tables. Exclusions were made before the fresh serial baseline/final comparison, not based on faster/slower results.

Production fingerprints:

| Path                                           | Baseline blob                              | Final blob                                 |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| `packages/ecs/src/API.ts`                      | `9a9d7535d47e07957c773b203d14fd1b88f9fcb0` | `5b032c0cebe8c6fe2c2e512d5badf66b22ece5d2` |
| `packages/ecs/src/utils/inherit-group-wire.ts` | `05eb02f28383c6c9cb93e81f76ef94610b1baccf` | `833ea3933eb87804842e0e80568b3441135fd7dc` |

## Actual Workflow: 2,400 cards and 2,400 edges

Image/path batching is enabled on both sides. Overview contains **2,400 visible cards and 2,400 visible edges**, 4,801 document nodes, 1,148×914 canvas in a 1,500×980 viewport, DPR 1. Steady frames retain **22 drawcalls / 614,406 indices**, 86 main-context buffers, **3,078,076 allocated buffer bytes**, 14 textures and one 192-byte scene uniform upload. The auxiliary offscreen context remains separate in the raw resource maps.

CPU surrounds `world.execute()` including any waits inside it. Profile captures add synchronous nested method scopes; inclusive scopes overlap and must not be summed. CPU is not GPU time or FPS. Workflow percentiles use `ceil(n × fraction) − 1`. Cold transition is always unprofiled.

| Capture         | Operation                   | Frames old → new | CPU p50/p95 ms old → new | Maximum CPU ms old → new |
| --------------- | --------------------------- | ---------------: | -----------------------: | -----------------------: |
| ordinary        | cold-overview-transition    |           11 → 6 |    6.5/519.4 → 3.6/454.6 |            519.4 → 454.6 |
| ordinary        | steady-overview             |          30 → 30 |    13.3/18.8 → 13.2/19.3 |              20.3 → 21.3 |
| ordinary        | time-driven-tour            |          44 → 41 |  16.1/219.4 → 20.6/151.6 |              242 → 281.3 |
| ordinary        | focused-native-pointer-drag |          24 → 27 |        17/26.6 → 20.8/32 |               28 → 161.2 |
| profile         | cold-overview-transition    |            6 → 6 |      4.5/565.9 → 4.6/572 |              565.9 → 572 |
| profile         | steady-overview             |          30 → 30 |    13.2/19.3 → 13.9/20.8 |              20.2 → 27.7 |
| profile         | time-driven-tour            |          25 → 30 |  16.2/150.1 → 19.9/203.9 |            296.4 → 214.3 |
| profile         | focused-native-pointer-drag |          28 → 25 |    23.6/50.4 → 19.7/26.7 |              79.7 → 28.8 |
| ordinary-repeat | cold-overview-transition    |            7 → 6 |    5.3/567.6 → 4.9/562.5 |            567.6 → 562.5 |
| ordinary-repeat | steady-overview             |          30 → 30 |      14.8/22.7 → 13/20.3 |              26.3 → 20.8 |
| ordinary-repeat | time-driven-tour            |          38 → 23 |  20.8/185.2 → 17.7/160.3 |            242.8 → 264.4 |
| ordinary-repeat | focused-native-pointer-drag |          23 → 23 |    21.8/30.2 → 18.7/24.6 |              40.9 → 31.1 |

Native drag uses the same twenty out/back pointer moves in the 2,400-card document at readable zoom, initially **45 cards / 42 edges actually visible**, ending with 36/30 plus the selected overlay after zoom. All six ordinary/profile/repeat drag endpoint checks have zero error; target/final coordinates, start/end visibility, resources and allocated bytes agree across versions. Events can coalesce and frame counts differ. Tours are time driven and visit different camera samples, so total-time or per-frame comparisons do not establish a causal speedup.

First ordinary drag regresses from 17/26.6 to 20.8/32 ms and contains a **161.2 ms** new maximum (old maximum 28 ms). That long frame has the same 4 draws, 12,912 indices, 4 native buffer creates and 61,432 upload bytes as ordinary edit frames; the current counters do not attribute the stall to GC, CPU scheduling or GPU waits. It remains unexplained and is retained. A single reverse-order ordinary repeat was triggered by this concern: new 18.7/24.6 versus old 21.8/30.2 ms, maxima 31.1 versus 40.9 ms. The long frame did not recur in that capture. The two rounds disagree; neither is discarded, and a general ordinary-frame improvement is not claimed.

Profiled drag has **21 actual `API.updateNodes` calls** on either side: inclusive total **158.2 → 45.6 ms**, or **7.53 → 2.17 ms/call**. Per captured frame this is 5.65 → 1.82 ms (28 → 25 frames). Inclusive `edit.apply` averages 13.27 → 8.68 ms/frame. Snapshot comparison still averages 9.43 → 7.39 ms/call (21 calls), a separate residual cost with no snapshot source change in this PR. The scoped-update result and deterministic unrelated-read regressions support reduced paint work; they do not explain all end-to-end timing shifts.

Completion intervals between finished engine frames include work/waits outside `world.execute()` and are not native presentation/GPU completion intervals. Cadence remains poor:

| Capture         | Operation                   | Completion interval p50/p95 ms old → new |
| --------------- | --------------------------- | ---------------------------------------: |
| ordinary        | cold-overview-transition    |                  18.5/520.8 → 17.3/480.1 |
| ordinary        | steady-overview             |              718.8/1356.7 → 720.9/1249.7 |
| ordinary        | time-driven-tour            |                139.9/635.4 → 108.7/768.4 |
| ordinary        | focused-native-pointer-drag |                  65.6/127.7 → 70.6/139.4 |
| profile         | cold-overview-transition    |                      18/577.3 → 17.3/599 |
| profile         | steady-overview             |                574.1/1385 → 548.9/1427.9 |
| profile         | time-driven-tour            |                 258/924.9 → 223.5/1292.5 |
| profile         | focused-native-pointer-drag |                  69.2/151.9 → 63.7/182.9 |
| ordinary-repeat | cold-overview-transition    |                  16.7/581.2 → 19.4/592.1 |
| ordinary-repeat | steady-overview             |               555.3/1409.9 → 667.9/902.1 |
| ordinary-repeat | time-driven-tour            |                  176.6/860.9 → 516/991.2 |
| ordinary-repeat | focused-native-pointer-drag |                  60.6/123.1 → 54.3/138.1 |

## Paired Core/ECS editing controls

Each scene has **1,000 actually visible primitives**, 200 each rectangles, ellipses, text, polylines and paths. Ten nodes are edited per frame, 30 measured samples follow 15 warmups, with text batching off/on and LOD disabled (zero proxies). CPU controls below use the fixture’s existing `floor(n × fraction)` index. Core synchronous render and ECS frame/wait boundaries differ; compare each backend with its own baseline.

| Backend | Text batching | Control CPU p50/p95 ms old → new | Drawcalls | Indices | Allocated buffer bytes |
| ------- | ------------- | -------------------------------: | --------: | ------: | ---------------------: |
| core    | off           |                8/15.5 → 8.1/12.2 |       603 |  395280 |                1931220 |
| core    | on            |                9/12.6 → 9.2/12.6 |       407 |  395280 |                1893724 |
| ecs     | off           |            25.6/42.6 → 25.3/32.3 |       602 |  395280 |                2206188 |
| ecs     | on            |            23.2/37.4 → 26.2/38.6 |       407 |  395280 |                2159388 |

ECS text-batching-on control CPU regresses (23.2/37.4 → 26.2/38.6 ms), despite its profiled `edit.apply` mean falling 3.40 → 2.60 ms/frame. ECS off `edit.apply` mean is unchanged at 2.57 ms. Core controls fluctuate without a Core source change. Before/after control and profiled visible/primitive counts, all native counters, allocated bytes and resource maps match exactly in all four modes. Each script also asserts nonempty frames, control/profile native/resource parity, restored instrumentation and resource teardown.

## Reproduce

Run serially, using one browser binary and clean commits:

```bash
pnpm bench:edit-phases
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 WORKFLOW_BENCH_OUTPUT=.test-results/inherited-profile.json pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 WORKFLOW_BENCH_OUTPUT=.test-results/inherited-ordinary.json pnpm bench:workflow
```

For a paired baseline, keep this branch’s scripts/fixtures, restore only `packages/ecs/src/API.ts` and `packages/ecs/src/utils/inherit-group-wire.ts` from `928adb2`, and commit that reference before measuring. Keep the same sampling order or report it. The additional ordinary repeat runs final then baseline and is not substituted for the first pair.

`WORKFLOW_CHROMIUM` selects the Workflow executable. Edit-phases does not consume that variable: these local captures use an ignored config extending `playwright.edit-phases-bench.config.ts`, selecting cached Chromium 140 through `use.launchOptions.executablePath`, with root `webServer.cwd` and correct `testDir`. Using installed pinned browsers changes the environment from these measurements. No workload or assertions were skipped.

## Validation

-   **189 ECS tests / 10 suites passed**: inherit-group-wire, history-inheritance-sync, history-delta, history-boundary, history-document, edit-stage, path-extrusion-eligibility, design-variables, history-property-sync and history-rough-sync. Two initial targeted failures reproduce unrelated paint reads (3 rather than 0); both pass after the change. New scoped queries cover complete ancestry through non-group parents, zero/empty overrides, ownership, fresh ancestor edits, missing IDs and cyclic-chain termination.
-   **17 Chromium + 17 WebKit related browser cases passed**, including both backends’ pixels/profiling restoration, mixed workloads, painter barriers, picking/history/transforms/camera migration, full exports and culling/reentry/removal/resource lifecycle. The inherited-paint case now exercises a batched parent edit, real descendant/rough pixels, authored-child wire ownership and undo.
-   **6 actual Workflow demo cases passed**, including all scales through 2,400, card movement, settings/persistence/JSON export, connected endpoints, anchored zoom/pan, tours/cancellation, scene reduction and narrow/reduced-motion behavior.
-   Browser typecheck initially caught missing union narrowing in the new test; corrected it and strengthened the child-ownership assertion. Chromium and WebKit each reran that final case successfully. Core, ECS, browser, benchmark and Workflow-benchmark TypeScript checks all pass. Changed-file ESLint, diff checks and normal hooks pass.
-   Headless WebKit uses the bundled WPE runtime with GUI-only host validation bypassed; no test/behavior assertions skipped. Whole-repository CI is not a local result, and no hardware-GPU/WebGPU or 60-FPS claim is made.
-   The remaining smooth-interaction work includes full-document indexing/snapshot cost, allocation/upload/packing and frame-completion scheduling on representative hardware. This PR adds no dependency, renderer switch or default change.
