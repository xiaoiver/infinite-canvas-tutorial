# Drawing-buffer retention experiment

This follows #748 and the 2,400-card + 2,400-edge smooth-interaction target. Core's existing WebGL context does not preserve the drawing buffer; ECS explicitly requests preservation. Both engine export paths read pixels in the submitting task. The question is whether retention materially explains the long continuous-input gaps, while exports and visible pixels remain correct.

**There is no production configuration/API/default change.** An initial additive API prototype exposed the setting while preserving both defaults. Its two reversed-order groups did not show a stable interaction benefit, so that public API and its changeset were withdrawn. The final implementation keeps a benchmark/test-only context-creation control, export/presentation regressions and measurements. Prototype records retain their own source/qualification and are not pooled with the final probe cohort.

## Narrow creation-time control

`DRAWING_BUFFER_PRESERVE=0` or `1` selects a separate settings-observer cohort. Only fixture and Workflow benchmark entries parse the corresponding query. The normal shipped entry, Core/ECS sources, original documents, history, collaboration, LOD and rendering algorithms remain unchanged.

The probe targets exactly one element and saves its original own-property descriptor/method. It changes only the preservation attribute for WebGL context creation, restores the exact original method immediately after successful creation, restores on exceptions, and disposes its marker during teardown. It adds no lasting context interception or per-frame browser hook. ECS's shared offscreen export context is not intercepted; the browser regression verifies its existing true policy under either screen setting.

Captured context identity/attributes are read outside measured windows, before and after traversal. Qualification requires the requested policy to be effective, a positive creation-attempt count, confirmed restoration, and identical final context properties. Dropped metadata, host clocks without a scope marker, policy changes or other graphics-attribute differences reject comparison. The default cohort does not install the probe or read context metadata.

## Export and ownership contract

Both backends are checked with the default, false and true requests under WebGL1 and WebGL2 in Chromium and WebKit. In-memory presentation pixels remain identical after idle and across settings. Repeated engine exports after idle and culling/reentry must be identical, nonblank, and preserve the document. ECS selected-node output and the independent offscreen policy are checked too. Tracked resources must return to their existing cleanup baseline. Internal screen screenshots are assertions only and are excluded from review archives.

These checks exercise the existing same-task capture paths: Core reads after submission; ECS reads after render-graph execution. They do not introduce a general raw-element capture guarantee at an arbitrary later task. The unchanged lifecycle suites cover asynchronous initialization, cancellation/removal, isolated export failures and disposal ownership.

## Measurement boundaries

The existing Workflow fixed-input/continuous protocols and paired Core/ECS fixed camera protocol accept the setting. It cannot be combined with CSS, phase, upload, texture or CDP recording. Fixed captures record two host timestamps per operation as well as their existing page/engine clocks. Host command-to-result includes automation, pre-page delivery and observation/return overhead; it is not GPU execution or physical presentation. Host and page clocks are never subtracted.

Only the preservation attribute may differ across a settings pair. Camera, surface, visible identity, all native counters and resources are compared. Reducing submitted work cannot be called a retention benefit. Continuous streams keep actual delivered/coalesced inputs and final camera prefixes; their reached poses may differ, so they cannot establish fixed-work speedup ratios. First/warm traversals remain separate.

```sh
# Fresh directories, clean committed source, same pinned Chromium.
DRAWING_BUFFER_PRESERVE=1 WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/tmp/preserve-1 pnpm bench:workflow-input
DRAWING_BUFFER_PRESERVE=0 WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/tmp/preserve-0 pnpm bench:workflow-input
node scripts/compare-workflow-input.mjs /tmp/preserve-1/workflow-input.json /tmp/preserve-0/workflow-input.json

DRAWING_BUFFER_PRESERVE=1 CAMERA_REPLAY_OUTPUT_DIR=/tmp/paired-1 pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
DRAWING_BUFFER_PRESERVE=0 CAMERA_REPLAY_OUTPUT_DIR=/tmp/paired-0 pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
node scripts/compare-camera-replay.mjs /tmp/paired-1/camera-replay-strokes.json /tmp/paired-0/camera-replay-strokes.json

DRAWING_BUFFER_PRESERVE=0 WORKFLOW_INPUT_COUNT=2400 WORKFLOW_CONTINUOUS_OUTPUT_DIR=/tmp/continuous-0 pnpm bench:workflow-continuous
pnpm test:browser drawing-buffer.spec.ts
pnpm test:browser:webkit drawing-buffer.spec.ts
```

Repeat settings in reversed order. Leave other diagnostics unset. Default captures omit the new context/host observer and keep their existing scope. Software-renderer measurements cannot establish hardware-GPU behavior, presented FPS or the 2,400-node smoothness target. A lower isolated counter or a favorable single sample is insufficient evidence to change the production policy.

## Recorded outcome (2026-11-27)

Decision: retain the existing production policy. Neither the public-API prototype nor the final scoped probe establishes a repeatable Workflow interaction benefit. No package changeset or new public option is retained. The remaining 2,400-node smoothness gap is open.

Final measured local source: `e6f08e0c2d68a8743f6d788cf7dde7744018ea5f`, clean tree `1c007ecc0eb298c98a2a9fe03238f77114f87822`. The reviewable implementation commit [c2fe9d4](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/c2fe9d43678afca9faaf54138f1838ed64087885) has exactly that tree and parent #748's merge `5ec1766`. Subsequent documentation/CI wiring is outside the measured implementation. Node 24.22.3, Chromium 140.0.7339.186, ANGLE/Vulkan SwiftShader, viewport 1500 × 980 CSS px, canvas 1148 × 914 CSS/backbuffer px, DPR 1. Captures were serial, without concurrent local tests or profilers.

The two Workflow settings comparisons each matched 40 camera steps (80 pairs / 160 captured frames). All visible identities, native counters and resource tables matched. The fixed trace reached 36–2,400 visible cards and 36–2,400 visible edges; each frame submitted 3–22 drawcalls, 15,516–633,846 indices and 4 array vertices, with 156,116–3,322,588 tracked allocated buffer bytes. This is already batched work; drawing-buffer retention does not reduce it.

Fixed trusted-input results below are milliseconds, p50 / p95. Each row contains 20 completed targets; first and warm traversals are separate. Group 1 ran true then false; group 2 ran false then true.

| Group | Preserve | Traversal | Host command → result | Engine wall |
| ----- | -------- | --------- | --------------------- | ----------- |
| 1     | true     | first     | 103.5 / 478.5         | 15.3 / 71.9 |
| 1     | true     | warm      | 103.8 / 1208.5        | 13.6 / 57.0 |
| 1     | false    | first     | 86.5 / 226.7          | 20.5 / 66.9 |
| 1     | false    | warm      | 110.8 / 1322.6        | 15.6 / 69.5 |
| 2     | true     | first     | 106.5 / 329.4         | 18.4 / 77.6 |
| 2     | true     | warm      | 136.9 / 456.2         | 18.3 / 69.4 |
| 2     | false    | first     | 87.1 / 770.5          | 13.5 / 73.8 |
| 2     | false    | warm      | 132.8 / 570.9         | 15.4 / 83.8 |

Continuous streams issued 40 host commands at 16 ms cadence per gesture (nominal span 624 ms), without waiting for a frame per command. Across all 16 gestures, 640 host commands became 362 received DOM events, 310 engine executions and 295 rendered frames. They reached different intermediate camera prefixes. Receipt spans ranged 1,289–8,246 ms; no fixed-work ratio is inferred from these streams.

Completed-rendered-frame interval p95 below is milliseconds. These intervals do not measure physical display presentation or CPU utilization.

| Group | Preserve | First in / out | Warm in / out  |
| ----- | -------- | -------------- | -------------- |
| 1     | true     | 974.7 / 211.7  | 1525.3 / 131.8 |
| 1     | false    | 805.5 / 137.5  | 1143.0 / 139.3 |
| 2     | true     | 885.8 / 173.3  | 1110.8 / 285.6 |
| 2     | false    | 687.0 / 357.4  | 500.1 / 426.9  |

The paired Core/ECS fixed 2,400-stroke cohort matched 48 camera steps (96 captured frames), with all native counters and resource tables equal across settings. Each row has 12 targets.

| Backend / traversal | true host p50 / p95 | false host p50 / p95 | true engine wall p50 / p95 | false engine wall p50 / p95 |
| ------------------- | ------------------- | -------------------- | -------------------------- | --------------------------- |
| core/scoped/0       | 14.4 / 82.0         | 13.5 / 76.8          | 5.8 / 69.6                 | 4.7 / 61.3                  |
| core/scoped/1       | 13.6 / 35.8         | 14.2 / 35.7          | 4.5 / 18.2                 | 6.3 / 25.2                  |
| ecs/scoped/0        | 35.9 / 91.5         | 30.4 / 81.3          | 12.5 / 67.8                | 12.7 / 63.5                 |
| ecs/scoped/1        | 34.3 / 76.2         | 32.7 / 1288.6        | 11.4 / 52.2                | 11.1 / 35.1                 |

The separate default/unconfigured cohort compared #748's merge against the final probe source: 40 Workflow and 48 Core/ECS steps passed the original identity/native/resource gates, without any new settings metadata or host observer. This validates protocol compatibility; it is not evidence of a runtime optimization.

Validation: 198 tooling tests; 4 probe ownership/exception tests; 12 unchanged ECS device/renderer lifecycle tests; Core/ECS builds and browser/paired/Workflow TypeScript checks; full lint; Chromium and WebKit each passed 4 WebGL1/WebGL2 policy/export/presentation tests and 12 existing camera/wheel interaction tests. Browser checks use the matching cached Chromium 149 and WebKit 2388; timing stays pinned to Chromium 140. The WebKit host-library preflight was skipped locally, with test assertions unchanged. Full remote CI is recorded on the PR.

The archive retains all raw captures, runner logs, summaries and source bundle. Earlier API-prototype captures (`f21c025`, tree `e4dd524`) and initial 24-node setup captures retain their original scope and are not admitted by the final stricter probe qualifier. The first final paired captures overlapped reference-worktree preparation; those are retained as `paired-*-initial` and excluded from the quoted results. Fresh serial `paired-1`/`paired-0` captures supply the table. No browser screenshots or traces are included in the archive.

CPU utilization, GPU execution timing, hardware-driver behavior and physical presented FPS were not measured. A useful next investigation is the actual Workflow cubic-path geometry and pixel cost: the existing polyline LOD supports `Polyline` entities with constrained stroke styles, while these edges are `Path` cubic curves. Any curve reduction must bound screen-space error, preserve full geometry for interaction/export and cover both Core and ECS. No curve approximation is introduced by this experiment.
