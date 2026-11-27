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
