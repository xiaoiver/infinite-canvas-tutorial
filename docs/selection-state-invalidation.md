# Stop selection-only state from redrawing static canvases

Following #708, selection updates now patch only selection/highlight state. ECS hand mode no longer reapplies unchanged Theme and binding state every tick. Core already avoids unchanged draws and its production code is unchanged; both backends share idle/wake, pixels, export and resource controls. **Smooth interaction at 2,400 cards remains unverified.**

## Behavior and startup preservation

Five API selection paths previously resent the complete prior AppState. They now send only the changed selection fields; `setAppState` still delivers a complete merged state to consumers. Existing selection/highlight cleanup, 3D companion/gizmo handling, document/history, geometry, picking and export paths remain in place. No selection early-return shortcut, render pause, LOD substitution or dependency change is introduced.

CI exposed a real startup dependency: a theme configured before GPU readiness existed in AppState but was not applied when SetupDevice later created Theme. Repeated selection updates had accidentally synchronized it. SetupDevice now initializes a missing Theme once from the configured state, preserving an explicitly supplied Theme. MeshPipeline queues the first GPU-ready frame even for an empty canvas, so the configured background is painted once and later idle frames remain quiet. Core/ECS startup tests check transparent/custom background pixels, an initially empty canvas draw, idle retention and teardown.

## Qualified evidence

Corrected serial captures on 2026-11-24 use Node 24.22.3, Chromium 140.0.7339.186, SwiftShader, DPR 1. Final source `6df6a8145ed019a0070a8f245da5e23c11460d0f`, tree `210674a95641888e2bc2d121cee735b435d9db4b`; reference `291245122214efbfe83c337c1c0c6d119c07c830`, tree `bb06c4e72ea2d5b5788d51a298c39c5b0b4f38b2`. Both include identical startup fixes, fixtures and measurement scripts; only `packages/ecs/src/API.ts` differs, restored from #708 (`1dbead9`) in the reference. All ten captures use clean source and successful exits; no tests/lint or other browser checks overlap their capture windows. This report follows those commits.

[Full corrected raw inputs](selection-invalidation-benchmark.jsonl) include SHA-256 fingerprints, source blob IDs, frames, native counters, profiler scopes, environment and serial run records. Workflow now asserts actual Theme equals requested Theme with background `#171b18` before and after measurement. The earlier Workflow palette was wrong; [the complete earlier report](selection-state-invalidation-before-startup-theme-fix.md) and [raw inputs](selection-invalidation-before-startup-theme-fix.jsonl) remain archived and are excluded from the corrected comparison.

Idle/edit retain the existing `floor(n*q)` percentiles; Workflow/no-op use nearest rank `ceil(n*q)-1`. CPU spans Core action/render or ECS `world.execute`, including awaits. Workflow completion intervals include scheduling/software rendering and are not physical display or native GPU timings.

## Static Core/ECS control

Each case has 1,000 actually visible primitives (200 each rect, ellipse, text, polyline and path), LOD off, text batching off/on, 15 warmups and 30 samples after switching to hand mode. Exports retain identical pixels; real pan wakes rendering, and teardown passes. Matched visibility, primitive counts, resource maps and allocated bytes are asserted.

| Backend | Text batching | CPU p50/p95 ms, before → after | Nonempty frames / 30 | Draws / frame | Indices / frame | Allocated buffer bytes |
| ------- | ------------- | -----------------------------: | -------------------: | ------------: | --------------: | ---------------------: |
| core    | off           |              0.5/0.7 → 0.8/1.0 |                0 → 0 |         0 → 0 |           0 → 0 |                1931220 |
| core    | on            |              0.4/1.2 → 0.4/0.7 |                0 → 0 |         0 → 0 |           0 → 0 |                1892956 |
| ecs     | off           |            17.0/24.7 → 2.8/4.9 |               30 → 0 |       602 → 0 |      395280 → 0 |                2206188 |
| ecs     | on            |            14.4/20.0 → 2.5/4.3 |               30 → 0 |       403 → 0 |      395280 → 0 |                2158428 |

All native counters in the final idle frames are zero, including creates, deletes, allocations and uploads. Resident objects remain available for the next edit. Core timing movement is a control, not a claimed Core optimization.

## Unchanged commits in the actual Workflow

All 2,400 cards, 2,400 edges and the root are present (4,801 nodes), with every card/edge visible in overview. After three preparation frames, 35 empty `capture: NEVER` edits discard five warmups. Observer restoration, two later frames, teardown and invalid-version checks pass. Both revisions retain 30/30 snapshot and element Map reuse, 49 present versions and zero invalid versions.

| Metric                    |      Before |    After |
| ------------------------- | ----------: | -------: |
| Snapshot p50/p95 ms       |    6.5/11.1 |  3.3/6.0 |
| Engine CPU p50/p95 ms     |   20.4/27.1 | 6.9/11.0 |
| Draws / indices per frame | 22 / 614406 |    0 / 0 |

The version/snapshot comparison algorithm does not change here. Main-renderer residency stays at 86 buffers, 14 textures and 3,078,076 allocated buffer bytes; auxiliary offscreen resources are retained in raw records.

## Editing controls

Edits mutate ten of the same 1,000 visible primitives, retaining the default tool, 15 warmups and 30 samples. Both profiled and unprofiled controls restore instrumentation and assert equal visibility, resources, allocated bytes and native counters across revisions.

| Backend | Text batching | Control CPU p50/p95 ms, before → after | Profiled CPU p50/p95 ms, before → after | Draws | Indices / array vertices |
| ------- | ------------- | -------------------------------------: | --------------------------------------: | ----: | -----------------------: |
| core    | off           |                    7.0/13.3 → 6.6/14.5 |                     9.9/14.2 → 8.6/20.6 |   603 |               395280 / 4 |
| core    | on            |                    7.0/15.3 → 9.5/14.6 |                     7.6/11.2 → 7.5/12.7 |   407 |               395280 / 4 |
| ecs     | off           |                  25.9/33.8 → 26.0/36.1 |                   24.5/31.7 → 25.6/32.2 |   602 |               395280 / 4 |
| ecs     | on            |                  26.7/33.1 → 21.8/43.4 |                   22.2/29.1 → 22.8/27.3 |   407 |               395280 / 4 |

Every increase is retained in the table; these single serial pairs do not establish a general editing speedup. Core shares the same unchanged production implementation in both revisions.

## Actual Workflow navigation

Image batching is enabled. Overview includes 2,400 visible cards and edges; focused native-pointer drag uses a subset of the 4,801-node document, with actual counts retained below. Both revisions settle two engine frames, assert UI/applied/start camera agreement, and retain preparation outside drag samples. Camera, target, final position, zero endpoint error, visibility and resources match. The ten-second tour is time driven; camera poses and sample counts vary with scheduling and remain in raw evidence. Cold transition precedes profiling even in the profile-labelled capture.

| Capture  | Operation                   | Frames before/after |  CPU p50/p95/max ms, before → after | Completion interval p50/p95 ms, before → after |
| -------- | --------------------------- | ------------------: | ----------------------------------: | ---------------------------------------------: |
| profile  | cold-overview-transition    |                 7/7 |   6.1/584.9/584.9 → 3.8/394.4/394.4 |                        18.4/592.0 → 11.7/407.9 |
| profile  | steady-overview             |               30/30 |        12.7/19.2/19.4 → 2.4/4.2/4.4 |                       712.6/1461.6 → 16.7/18.9 |
| profile  | time-driven-tour            |               30/79 | 22.7/140.5/265.7 → 12.5/137.4/183.3 |                      146.4/1084.5 → 49.0/766.4 |
| profile  | focused-native-pointer-drag |               23/34 |     16.8/28.5/88.2 → 15.4/30.4/39.6 |                         60.2/139.4 → 26.2/79.4 |
| ordinary | cold-overview-transition    |                 7/6 |   3.8/512.1/512.1 → 5.3/503.1/503.1 |                        16.8/516.2 → 26.5/535.2 |
| ordinary | steady-overview             |               30/30 |        11.7/17.7/22.5 → 3.7/7.9/7.9 |                       775.3/1454.2 → 16.7/23.3 |
| ordinary | time-driven-tour            |               26/81 | 19.9/242.8/367.3 → 14.0/131.3/178.8 |                       459.3/801.7 → 67.4/687.6 |
| ordinary | focused-native-pointer-drag |               23/29 |     16.2/28.7/36.6 → 14.0/23.5/35.0 |                        55.6/146.2 → 32.9/101.9 |

Both profile and ordinary drag have 36 visible cards and 30 visible edges in each revision.

Static draw suppression is distinct from active zoom/drag performance. Retained active-view p95/max values and software-rendering completion waits keep the 2,400-card smooth-interaction goal open. Native GPU/WebGPU and physical presentation validation remain outstanding.

## Reproduce

```bash
pnpm bench:idle-rendering
pnpm bench:edit-phases
pnpm bench:document-versions
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=1 pnpm bench:workflow
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
```

Use clean commits, the same browser binary and strictly serial captures. A paired reference restores only API.ts from `1dbead9`, retaining the startup fixes and identical measurement files. For that legacy reference, `WORKFLOW_BENCH_EXPECT_IDLE_DRAWS=22` changes assertions only; the current default remains zero. `WORKFLOW_CHROMIUM` selects the Workflow/no-op executable. Idle/edit use local extending configs with the identical executable, `testDir`, root webServer cwd and no server reuse. Existing formal configurations remain portable.

## Validation and limits

-   **14 Core + 265 ECS unit cases passed**, across 17 files: Core history/serialization; ECS selection, startup device/renderer lifecycle, history/document versions, 3D companions/gizmos, design variables and inherited presentation. The missing-theme and missing-first-frame cases fail before their corresponding fixes. The reused loaders.gl copies use the existing local canonical mock mapper with external network access denied; no repository assertions or CI configuration are weakened. Whole-repository CI must pass on the final remote head before merging.
-   WebKit: 121 browser cases passed, including transparency, filters, blend modes, Lottie, path/stroke batching, editing, history, export, culling/reentry/removal and resource ownership. Real Workflow: all six cases passed through 2,400 cards, connected drag, anchored zoom/pan, cancellation, persistence/export and narrow/reduced-motion behavior.
-   Chromium passes the original failing pixel families and all four strengthened startup cases. One existing repeated-reload mixed-renderer case remains locally blocked by `net::ERR_INSUFFICIENT_RESOURCES` while loading source ESM modules. Its Ready timeout and behavioral assertions are unchanged; CI remains the final full-browser check.
-   Five final typechecks passed: Core, ECS, browser, mixed benchmark and Workflow benchmark. Normal commit hooks and changed-file lint run on the repair. All ten corrected benchmark captures pass.
-   Native headless-GL Jest filter pixel suites could not run locally: the reused dependency tree lacks a compiled `gl` binding and Xvfb. Those native suites require CI; browser WebGL pixel checks are local results. Pinned WebKit/WPE bypasses GUI-only host requirements validation without skipping behavioral assertions. Dependencies and lockfile are unchanged.

## Next measured target

Corrected profiled tour mean exclusive CPU per frame: stroke.geometry 9.2 ms, batch.plan 5.6 ms, path.precision 4.9 ms, visibility.cull 2.4 ms, drawcall.ImageBatch 1.4 ms. The maximum engine frame (183.3 ms) contains stroke.geometry 60.3 ms, path.precision 47.4 ms, batch.plan 43.9 ms, drawcall.ImageBatch 6.5 ms, render.camera 5.6 ms. These scopes motivate investigating local curve/stroke geometry reuse in Core and ECS before attributing the remaining tail to physical GPU hardware.
