# Canvas GPU readiness and failure reporting

This follows #749. A failed WebGL context could leave a running ECS World without a `GPUResource`. The Workflow example returned from `App.run()`, loaded its document and counted empty engine executions anyway, showing READY / FPS over a blank canvas. This change makes startup outcome observable; it is **not a rendering speedup or a 2,400-node smoothness acceptance**.

## Ownership and behavior

ECS adds the opt-in `API.initialized` promise for the default WebGL/WebGPU device system. Await it after `createCanvas()`, outside ECS system execution. It resolves to that API after resource configuration and component attachment, and rejects with the original device/offscreen/attachment error. API destruction, entity removal or World termination rejects a pending wait. Each canvas generation owns its settlement, so late success cannot revive a cancelled wait and one screen-device failure does not reject a healthy peer. Existing callers that do not await readiness retain the existing error log. Runtime-only state is neither document data nor history/collaboration state. Custom device systems still own their readiness contract.

Attachment-time failure releases its scope once, leaves no repeated retry, and logs any cleanup failure while preserving the original rejection. Shared offscreen initialization failure rejects every affected wait. A running World continues to serve healthy canvases; App.run() is not changed into an all-canvas barrier.

Core already rejects `Canvas.initialized` on device failure. It now handles a null swap chain explicitly, owns an acquired device before configuration can throw, and tolerates teardown of partial resources. Destruction is idempotent and cancels a pending wait immediately. An uncancellable acquisition is still observed: its late device is released without configuration or publishing readiness; its late rejection is handled. The internal Canvas promise is observed so early destruction before a caller reads `initialized` does not generate an unhandled rejection. Live initialization failures remain logged and observable through the public promise.

The Workflow now waits for its own GPU attachment before returning an engine or counting samples. On startup failure it exits the World, releases generated texture URLs, leaves the error visible, disables canvas actions and keeps numerical metrics absent. The inspector starts at STARTING and enters READY only after successful scene setup. Its snapshot is not ready after pagehide. This gate does not turn completed-engine telemetry into physical presented FPS, nor does it add runtime context-loss recovery.

## Regression evidence

-   38 ECS readiness/device/renderer/edit tests and 5 Core initialization tests pass.
-   198 tooling tests, full lint and all five Core/ECS/browser/benchmark typecheck scopes pass.
-   Chromium 149 and WebKit 2388 each pass 7 new cases: Core rejection with a healthy rendered peer; Core immediate destruction before observing readiness; ECS rejection with a healthy rendered peer; shared offscreen failure; real Workflow failure with zero reported frames, no loop and all generated URLs revoked; WebGPU adapter rejection; healthy Workflow pixels/navigation and pagehide cleanup.
-   Both browsers also pass 16 existing camera/wheel/WebGL1-WebGL2 policy/export/idle/reentry tests. The 6 complete Chromium Workflow demo cases pass, including 2,400-node scale switching, connected dragging, pan/zoom, settings, document export, tour cancellation and reduced motion.
-   Actual ESM and CommonJS builds and declarations for both packages pass; the normal Workflow production build passes. No dependency or lockfile change is needed.

Core uses the existing external-device resource baseline, captured immediately after swap-chain creation, as the established Core browser controls do. Renderer-owned allocations return exactly to it; ECS tracked allocations return to zero. The startup test gate installs Playwright's one-time main-world screenshot listeners before recording the page baseline. Remaining canvas/global listeners must then return to that fixed baseline; no later listener leak is exempted. Screenshots serve internal pixel assertions and are excluded from the review archive.

Local WebKit skips only the host-library preflight; assertions are unchanged. The first local full-demo launch failed because this environment has pnpm 11.25.0 rather than the repository's pinned 9.15.9. The identical Vite service was launched directly for the successful 6-case run, with the same tests/assertions and timeout. Initial fixture/mock/import/type errors and the listener-baseline diagnosis are retained in the archive. Remote CI uses its existing pinned package manager and is recorded on the PR.

## Same-work controls

Clean local implementation `1392be083d96e034becaaf3af374994c403d0a8b` has tree `38193b41a5bede91e948171fb6ce05d48b8d00ec`, exactly the tree of public [a258a56](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/a258a56c9b6b96bc9451af8239150bcc9c931389). Base is #749 merge `dbb47f45af9cfe34288536f9a187a754709db982`. Later reporting changes no measured implementation. Node 24.22.3, Chromium 140.0.7339.186 / SwiftShader, DPR 1. Four captures ran serially without concurrent local tests/profilers. No CSS/context/phase/upload/texture or CDP experiment was enabled.

The paired Core/ECS 2,400-stroke trace matches 48 step pairs (96 captured frames); the real 2,400-card + 2,400-edge Workflow trace matches 40 pairs (80 frames). All native counters and full resource tables match, as do requested/derived cameras, visible identities and surfaces. Workflow reaches 36–2,400 visible cards and 36–2,400 visible edges on a 1,148 × 914 CSS/backbuffer canvas in a 1,500 × 980 viewport. Its per-frame range remains 3–22 drawcalls, 15,516–633,846 indices, 4 array vertices and 156,116–3,322,588 tracked allocated buffer bytes.

Engine wall milliseconds, p50 / p95, are reported below as control observations. Each paired row has 12 targets; each Workflow row has 20. These are the existing protocol boundaries, not CPU utilization, GPU execution time or a cross-backend comparison. A single ordered before/after pair cannot establish a latency improvement; no ratio is claimed.

| Workload / traversal | Base engine wall p50 / p95 | Fixed engine wall p50 / p95 |
| -------------------- | -------------------------- | --------------------------- |
| core/scoped/0        | 4.1 / 57.1                 | 5.6 / 57.0                  |
| core/scoped/1        | 3.4 / 10.7                 | 3.0 / 15.5                  |
| ecs/scoped/0         | 9.7 / 66.5                 | 9.8 / 58.6                  |
| ecs/scoped/1         | 11.9 / 65.5                | 13.4 / 39.9                 |
| Workflow / first     | 13.8 / 65.8                | 17.4 / 60.7                 |
| Workflow / warm      | 16.5 / 60.7                | 16.9 / 61.6                 |

The private archive includes raw captures, full summaries, source bundle/patch, build/check logs and superseded failed attempts. The newly added Workflow GPU-failure assertion is also run against the unchanged base entry as a negative control; its expected failure is kept separately from final passing results. No browser screenshots/traces are archived.

Hardware WebGPU rendering, a hardware-GPU production browser, physical presentation, CPU utilization and sustained continuous-input smoothness remain unverified in this change. #749's automatic publish and production deployment passed; this follow-up stays draft. The next useful performance work is to isolate existing adaptive-path geometry and pixel cost on a confirmed graphics context, preserving Core/ECS parity and full interaction/export precision.

## Reproduce

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --coverage=false --runTestsByPath __tests__/ecs/api.initialized.spec.ts __tests__/ecs/device.lifecycle.spec.ts __tests__/ecs/renderer.lifecycle.spec.ts __tests__/ecs/api.edit.spec.ts
pnpm exec jest -c jest.config.js --runInBand --coverage=false --runTestsByPath __tests__/unit/core-renderer-initialization.spec.ts
pnpm test:browser gpu-readiness.spec.ts
pnpm test:browser:webkit gpu-readiness.spec.ts
pnpm test:workflow
pnpm build:workflow
# Fresh directories, the same clean committed sources and pinned browser on both sides:
CAMERA_REPLAY_OUTPUT_DIR=/tmp/ready-paired pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/tmp/ready-workflow pnpm bench:workflow-input
node scripts/compare-camera-replay.mjs /tmp/base-paired/camera-replay-strokes.json /tmp/ready-paired/camera-replay-strokes.json --require-native-parity
node scripts/compare-workflow-input.mjs /tmp/base-workflow/workflow-input.json /tmp/ready-workflow/workflow-input.json
```

The archive's summary additionally asserts equality of every paired native counter and resource table. Keep different workloads, first/warm traversals and browser versions separate. Do not count UI-only readiness as successful rendering when device initialization failed.
