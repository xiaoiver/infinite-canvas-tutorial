# Ordered wheel bursts and continuous Workflow input

This follows #745 and the 2,400-card + 2,400-edge smooth-interaction target. The default ECS event writer previously replaced wheel deltas before an engine execution. Three wheel pans `[20,-10]`, `[8,6]`, `[-4,2]` at zoom 2 should end at `(12,-1)`; the base produced `(-2,1)`, the final event only. The new regression fails on the base with expected x=12 / received x=-2.

The ECS fix stores ordered numeric wheel/pinch samples until the frame consumes them. Each sample retains its own viewport pivot and Ctrl/Meta/Shift state. CameraControl applies each sample in receipt order. For 2D zoom it uses the current Transform, including earlier pans/zooms in that execution, rather than the derived ComputedCamera from the previous derivation. Per-event zoom clamping is preserved; summing deltas would give the wrong result when crossing a zoom limit and reversing. Existing scalar Input fields continue to describe the latest event, and direct programmatic input without queued samples keeps its fallback. EventDisposer clears samples each frame. The first receipt owns an array; later receipts append without copying the backlog. No DOM event, entity or canvas handle is stored in the samples.

Core already handles every federated wheel event immediately in `CameraControl`. Its production sources remain identical to the base; the same browser burst/sequential contract now covers both backends. A rotated camera, mixed pan/zoom modes, changing pivots, clamp reversals, document invariance, idle drainage and resource teardown are checked together. ECS also checks 3D navigation, keyboard changes after receipt and independent canvases. One ECS patch changeset is included.

**The real Workflow has its own synchronous wheel handler and stops propagation before the default ECS handler. This input-loss fix therefore does not establish a Workflow speedup.** Its rendering, LOD switches, shaders, batching, geometry, original documents, history and full export paths are not changed. Whole-page retention is not reopened: #742 already measured zero hits on Workflow. The added continuous protocol addresses a different missing acceptance check.

## Continuous native-input protocol

The old `bench:workflow-input` waits for every target camera frame before issuing the next trusted wheel input. It remains useful for exact frame/work comparisons, but cannot establish continuous interaction. The new isolated benchmark entry schedules 40 wheel commands at 16 ms host intervals, without waiting for prior acknowledgements or target frames. It does so for zoom-in then zoom-out, with first and warm rounds separate. Count 24 uses eight commands per gesture for correctness. Each command has deltaY -20 or +20, with a fixed canvas-center anchor. The normal example still imports `main.ts`, not this benchmark entry.

Every host dispatch and acknowledgement is recorded in the host clock. A passive observation listener records trusted DOM receipt, actual deltas and the UI target computed under the real handler's policy. Browser coalescing is retained: total delivered deltas must equal total host commands, but the received event count may be smaller. A synthetic-input positive control is rejected. Completed engine executions record the derived camera and native draw/upload counters, including executions with no draw. Full visibility/resource snapshots are taken before/after each gesture, outside the engine clock; they are not claimed per-frame visibility measurements. The serialized document is compared after all gestures, GPU errors are checked outside timed execution, and real example teardown plus tracked resource cleanup must pass.

Each completed camera must match the initial state or a causally received input prefix. Prefixes cannot go backward. The final target must match a frame that started after the last receipt. Zoom gestures are monotonic and unclamped so repeated camera states cannot falsely certify completion. The UI reference accumulates in double precision; only the comparison to the derived ECS camera normalizes translations to Float32. A skipped intermediate view is recorded as a later prefix, not as a separately rendered input. The summary reports receipt-to-first-completed-frame-at-that-or-a-later-prefix latency. This excludes time before DOM delivery and is not physical presentation latency.

Clock domains are never subtracted from one another. Host dispatch span, host acknowledgement duration and browser receipt span are separate aggregates. Engine elapsed excludes subsequent native-counter observation. Completed-frame intervals include both engine work and gaps between executions; the latter are recorded separately as unassigned time, not labeled GPU waiting. A 16.7 ms engine budget count is a reference at 60 Hz, not presented FPS or a performance pass condition. Actual receipts and reached camera poses can differ across captures through coalescing, so these streams are **not a fixed-work A/B speedup comparison**.

## Measured source and environment

Measured clean source is local `f6846773fc78d01294f3e5e2326d9e9f7819dcee`, tree `1544dd1aaa14c841fbb10f6b224d3c2bb997f952`. The public [implementation commit](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/4bad94237f83667501c8383d4fb2e8d167452f9a) has the identical tree, with publication metadata changed. Base is the #745 merge `0d4842f57337801baa42c731b34a74d9de8c76dd`. Later reporting adds host/gap aggregations, an early rejected-command observer and a Float32 recorder test; it changes no measured runtime input code.

Node 24.22.3; Chromium 140.0.7339.186, headless SwiftShader, DPR 1; outer viewport 1500 x 980, actual Workflow canvas 1148 x 914. Two fresh 2,400-node captures run serially, with no other local tests/profiling overlapping. They contain the full 4,801-entity document and begin overview with all 2,400 cards and 2,400 edges visible. First/warm are initialized traversals, not application startup. Browser/backend boundaries remain distinct.

The pinned Playwright 1.61.1 implementation was inspected locally: Chromium sends `Input.dispatchMouseEvent` without an explicit rAF wait in RawMouse.wheel; WebKit first updates scrolling state and waits for rAF. WebKit build 2388 therefore receives only a separate 24-node portability run here. Its host preflight is skipped, not its browser assertions. No WebKit 2,400-node performance or cross-browser latency comparison is claimed. Driver acknowledgements do not certify DOM receipt or rendering.

## Actual continuous results

All eight 2,400-node gestures preserve delivered delta sums, causal camera prefixes, final targets, document data, GPU gates and teardown. Every gesture schedules 40 commands over a nominal 624 ms dispatch span. The table separates actual event delivery from engine execution. Nearest-rank percentiles are used.

| Capture         | Round | Zoom | Received events / rendered frames | Receipt span ms | Rendered engine p50 / p95 ms | Completed-frame interval p95 ms | Receipt-to-prefix completion p95 ms |
| --------------- | ----- | ---- | --------------------------------- | --------------- | ---------------------------- | ------------------------------- | ----------------------------------- |
| chromium-2400-1 | 0     | in   | 22 / 19                           | 4690.0          | 22.4 / 141.1                 | 694.2                           | 273.7                               |
| chromium-2400-1 | 0     | out  | 22 / 17                           | 1279.3          | 20.0 / 84.3                  | 181.2                           | 86.3                                |
| chromium-2400-1 | 1     | in   | 21 / 20                           | 6449.3          | 17.8 / 57.4                  | 722.0                           | 63.9                                |
| chromium-2400-1 | 1     | out  | 25 / 17                           | 1497.3          | 20.8 / 73.6                  | 206.6                           | 86.9                                |
| chromium-2400-2 | 0     | in   | 22 / 20                           | 5679.2          | 20.8 / 102.5                 | 796.8                           | 113.4                               |
| chromium-2400-2 | 0     | out  | 23 / 18                           | 1824.9          | 22.0 / 95.5                  | 308.5                           | 97.7                                |
| chromium-2400-2 | 1     | in   | 21 / 20                           | 7953.2          | 16.4 / 56.8                  | 1422.1                          | 62.8                                |
| chromium-2400-2 | 1     | out  | 23 / 18                           | 2054.9          | 21.1 / 79.6                  | 345.5                           | 106.5                               |

The delivered zoom-in streams span about 4.7–8.0 seconds despite roughly 624 ms of host dispatch. Only 21–25 wheel events arrive for the 40 commands; their deltas still sum to the intended 800 pixels. The received-event prefix latency starts after delivery and can look much smaller than the overall interaction delay. This distinction matters for the user's smoothness target. No per-command host-to-DOM latency can be inferred without synchronizing clocks and resolving coalesced event ownership.

Completed-frame intervals have substantial gaps outside `world.execute()`. The data does not isolate whether they come from compositor/GPU work, browser scheduling, automation delivery or other unmeasured work. These software-rendering samples **do not meet the smooth-interaction target**, and do not establish physical-device behavior or a performance ratio for the input fix. The full [machine-readable summary](./continuous-wheel-benchmark.json) includes all timing boundaries, native totals, actual endpoint visibility, logical buffer bytes, source identities and SHA-256/byte counts for every capture. Raw captures retain all receipts, targets, completed frames and command clocks.

## Existing fixed protocols and validation

The old trusted single-input Workflow and the paired Core/ECS camera protocols also run at 2,400 elements on the unchanged base and the measured source. All **88 corresponding completed frames** have exact native draw/index/array-vertex/upload counters, resource tables, visibility identities, document/theme/version state and geometry/phase call counts. Canonical source/clock/document/teardown qualification passes. CPU/phase durations are outcomes and excluded from equality; initial UI frame counters are not invariants. This is calibration/compatibility evidence, not a speedup cohort.

Passed locally: 54 related ECS camera tests across five suites (including the new burst cases), Core/ECS typechecks, benchmark/browser TypeScript projects, 152 tooling cases, 28 Chromium browser cases, 16 WebKit wheel/touch/isometric cases, 24-node continuous native-input smoke in both browsers, two fresh 2,400-node Chromium continuous captures and the 88-frame fixed-protocol audit. Four recorder unit cases and final lint/diff checks are recorded with the final review checks. Chromium regression uses version 149, separate from timing version 140. The Chromium set includes existing stroke/camera pixels, picking/history, culling/reentry, same-frame deletion, migration, full raster export, WebGL1 and ownership checks. WebKit covers actual existing touch/isometric cases as well as the new shared wheel contract.

Cached dependencies and direct Node CLIs were used without a fresh pnpm 9.15.9 install. Generated Husky helpers are absent, so explicit checks precede a per-command hook override. The initial expected input-loss failure, fixture type/qualification setup errors, raw baselines, all successful captures, source bundles and verification logs are retained in the private review archive. No ordinary capture was discarded. No timing threshold, retry, security audit or dependency policy was weakened. Full package/site/packed-package builds and full renderer suites are left to CI; hardware GPU/WebGPU and physical-presentation tracing were not run locally.

## Reproduction and next target

```sh
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_CONTINUOUS_OUTPUT_DIR=/tmp/continuous-1 pnpm bench:workflow-continuous
node scripts/summarize-workflow-continuous.mjs /tmp/continuous-1/workflow-continuous.json
WORKFLOW_INPUT_COUNT=24 WORKFLOW_INPUT_BROWSER=webkit WORKFLOW_CONTINUOUS_OUTPUT_DIR=/tmp/continuous-webkit pnpm bench:workflow-continuous
pnpm test:browser wheel-bursts.spec.ts
pnpm test:browser:webkit wheel-bursts.spec.ts
```

Use fresh output directories, a clean committed checkout, the same pinned `WORKFLOW_CHROMIUM`, and keep phase/upload/texture/timeline diagnostics unset. Preserve raw failed records before retrying. The next performance investigation should trace the long completed-frame gaps under this continuous protocol in a separate diagnostic capture, including browser/compositor scheduling, while retaining Core/ECS input correctness. Reducing another CPU-side counter alone will not close the current evidence gap. The 2,400-node smoothness target remains open.
