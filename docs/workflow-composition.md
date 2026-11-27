# Workflow composition ablations

This follows [#747](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/747). Long continuous-input gaps overlapped GPU-process main-thread task records, but that did not identify GPU execution or a blocking dependency. This experiment checks two narrower presentation hypotheses using the existing trusted, single-input Workflow trajectory. It does **not** establish continuous interaction or visible smoothness.

Core/ECS production code, normal example runtime/CSS, LOD, documents, history and full export paths are unchanged. There is no new dependency. The default benchmark keeps its existing protocol. The experimental mode is explicit and its results stay separate from ordinary, continuous, phase, upload, texture and CDP captures.

## Conditions and qualification

`WORKFLOW_COMPOSITION_CONDITION` accepts four values:

| Condition            | Performance overlay    | Canvas CSS opacity |
| -------------------- | ---------------------- | ------------------ |
| `normal`             | original `blur(12px)`  | 1                  |
| `flat-overlay`       | backdrop filter `none` | 1                  |
| `transparent-canvas` | original blur          | 0                  |
| `flat-transparent`   | backdrop filter `none` | 0                  |

Only a benchmark-owned stylesheet changes. Opacity zero leaves the canvas laid out and hit-testable. The real wheel handler and renderer still run. Normal mode installs a comment-only stylesheet so all experimental conditions share its lifecycle. The stylesheet is removed and the original computed styles verified before real application teardown; a failure also attempts cleanup.

Before/during/after snapshots include canvas layout/drawing-buffer dimensions, computed opacity/visibility/display/pointer events/transform, original inline styles, overlay styles, style-tag count and center-point input target. Round-boundary snapshots must preserve the selected condition. Effective WebGL renderer/version/context attributes are recorded outside the input/frame clocks. Every capture still requires trusted deltas, exact target camera completion, GPU-error gates, original document equality, pending-input rejection on teardown and zero tracked leaks.

The experimental comparator requires the same clean source and graphics identity. It compares every corresponding input/anchor, requested and completed camera, UI view, actual surface, visible graph identities, all native counters, live resource maps and allocated buffer bytes. Ordinary comparison rejects experimental metadata or per-step host clocks, even if the root mode is removed. The shared frame-clock adapter validates its canonical frame schema only after the original experimental capture passes its mode/style/lifecycle checks; no relabeled ordinary artifact is emitted.

Each input additionally records host dispatch, acknowledgement and result-observation times. Only differences within this host clock are reported. Receipt-to-frame and engine clocks remain in the page clock. Host command-to-result includes automation, delivery, engine work and snapshot/return overhead; it is not physical presentation latency or GPU time. No CPU profiler, CDP trace, GPU timer, screenshot or screencast is enabled here.

Equal native submissions do **not** prove equal GPU execution. A browser may change rendering/presentation scheduling for transparent content. In particular, a transparent canvas cannot certify useful visible performance, and these conditions cannot by themselves separate WebGL shading from all compositor/driver synchronization.

## Measured source and environment

Clean measured local commit `8800e96edbc15a00708d1b5067a90df030d36e7a` has tree `8437f9b6e513b1f4c7afc5bc3c149d4d01d86e1d`; the public [implementation commit](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/2c6ecfef796d93540f4a3df78ae9df47ede86053) has that identical tree. Base is #747 merge `ae4de3ccdbf0d2acd3164bf43b89f5f4d8c46a04`. Reporting changes no measured browser code.

Node 24.22.3; Playwright 1.61.1; Chromium 140.0.7339.186 headless, ANGLE/SwiftShader Vulkan, DPR 1. Outer viewport 1500 × 980; canvas/drawing buffer 1148 × 914. Actual context attributes include alpha, antialias, depth, stencil and preserveDrawingBuffer enabled; desynchronized is false. This is software rendering, not a hardware-GPU acceptance result.

Eight fresh captures run serially without other local tests/profilers overlapping. Group 1 orders normal → flat-overlay → transparent-canvas → flat-transparent; group 2 reverses that order. Each has 2,400 cards + 2,400 edges, 4,801 document entities, first/warm rounds, and 20 trusted wheel events per round (ten -100 then ten +100). Each command waits for its own completed target before the next command. First/warm means initialized traversals, not application startup. Do not pool these with #747's continuous coalescing protocol.

All **320 captured engine frames** qualify. Within each group, all 120 control/candidate frame pairs have exact camera/native/visibility/resource parity. Both rounds begin and end at 2,400 visible cards / 2,400 edges; endpoint logical allocated buffer bytes are 3,322,588. Every condition/group has the following native totals:

| Round | Draws | Indices   | Array vertices | Buffer creates/deletes | Buffer uploads / bytes | Uniform uploads / bytes |
| ----- | ----- | --------- | -------------- | ---------------------- | ---------------------- | ----------------------- |
| 0     | 159   | 4,194,504 | 80             | 119 / 119              | 326 / 21,113,128       | 89 / 12,672             |
| 1     | 159   | 4,201,764 | 80             | 81 / 81                | 326 / 21,147,976       | 89 / 12,672             |

## Timing outcomes

Nearest-rank p50/p95 in milliseconds. Engine duration is `world.execute` wall elapsed time, not CPU usage. These are diagnostic observations from two samples, not statistical speedup estimates.

| Group | Condition          | Round | Host command-to-result p50 / p95 | Engine wall p50 / p95 |
| ----- | ------------------ | ----- | -------------------------------- | --------------------- |
| 1     | normal             | 0     | 98.6 / 223.0                     | 20.6 / 93.0           |
| 1     | normal             | 1     | 99.2 / 807.5                     | 19.2 / 70.2           |
| 1     | flat-overlay       | 0     | 60.0 / 228.9                     | 18.3 / 95.4           |
| 1     | flat-overlay       | 1     | 122.9 / 563.8                    | 21.4 / 78.4           |
| 1     | transparent-canvas | 0     | 57.1 / 167.6                     | 17.4 / 76.6           |
| 1     | transparent-canvas | 1     | 107.6 / 519.0                    | 12.5 / 76.9           |
| 1     | flat-transparent   | 0     | 60.8 / 158.1                     | 18.3 / 81.9           |
| 1     | flat-transparent   | 1     | 110.6 / 464.1                    | 14.4 / 66.1           |
| 2     | normal             | 0     | 95.9 / 281.1                     | 14.9 / 82.3           |
| 2     | normal             | 1     | 122.5 / 547.2                    | 18.7 / 65.2           |
| 2     | flat-overlay       | 0     | 51.0 / 139.2                     | 16.1 / 93.5           |
| 2     | flat-overlay       | 1     | 171.1 / 893.5                    | 16.4 / 70.0           |
| 2     | transparent-canvas | 0     | 58.5 / 566.1                     | 17.4 / 98.8           |
| 2     | transparent-canvas | 1     | 142.3 / 599.1                    | 18.3 / 69.5           |
| 2     | flat-transparent   | 0     | 51.8 / 122.1                     | 12.8 / 74.7           |
| 2     | flat-transparent   | 1     | 112.3 / 625.4                    | 16.3 / 75.7           |

Removing backdrop blur does not give a stable improvement across orders/rounds. In group 2 warm traversal its host command-to-result p95 is 893.5 ms versus the normal control's 547.2 ms. Canvas transparency is also inconsistent: group 2 first traversal reaches 566.1 ms versus normal 281.1 ms. The combined condition has lower first-traversal p95 in both groups, but its warm result reverses relative to normal in group 2. These samples do not justify changing shipped CSS or attributing the original continuous-input gaps solely to backdrop blur. No favorable run is selected or failed qualification hidden.

A more useful next hypothesis is the WebGL context/presentation configuration and its export contract. The observed ECS context preserves the drawing buffer; `SetupDevice` explicitly requests that, while Core's Renderer does not pass that option. Effective defaults and full export behavior must be checked in both implementations before any change. This observation does not establish that an attribute is responsible for the measured delays.

## Validation and reproduction

183 tooling tests and Core/ECS, browser and benchmark TypeScript projects pass. The four Chromium 24-node condition smokes and their corresponding-frame audits pass. The original ordinary 2,400-node protocol also runs on the clean merge base and candidate, with exact 40-frame native/camera/visibility/resource parity. Broader browser/compatibility and final CI results are recorded in the PR. No production change needs a changeset.

The initial normal smoke was rejected before input because Playwright refuses empty stylesheet content. The control now contains a comment and changes no style rules. That failed raw record, initial type errors, all successful captures, source bundle/patch, machine-readable audits and logs are retained in the private review archive. Cached dependencies were reused; there was no fresh install or lockfile/policy change. Hardware GPU, WebGPU, GPU execution timers, CPU profiling and physical presentation remain unmeasured.

```sh
# Fresh directory per condition/run; clean committed source and pinned browser.
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_COMPOSITION_CONDITION=normal WORKFLOW_INPUT_OUTPUT_DIR=/tmp/composition-normal pnpm bench:workflow-input
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_COMPOSITION_CONDITION=flat-overlay WORKFLOW_INPUT_OUTPUT_DIR=/tmp/composition-flat pnpm bench:workflow-input
node scripts/compare-workflow-composition.mjs /tmp/composition-normal/workflow-input.json /tmp/composition-flat/workflow-input.json

# Also run transparent-canvas and flat-transparent; reverse order in another group.
# Compatibility only, no cross-browser timing comparison:
WORKFLOW_INPUT_COUNT=24 WORKFLOW_INPUT_BROWSER=webkit WORKFLOW_COMPOSITION_CONDITION=normal WORKFLOW_INPUT_OUTPUT_DIR=/tmp/composition-webkit pnpm bench:workflow-input
pnpm test:tooling
```

Set `WORKFLOW_CHROMIUM` to the intended executable when pinning Chromium. Leave phase, timeline, upload and texture variables unset. With `WORKFLOW_COMPOSITION_CONDITION` unset, the original benchmark stays ordinary and adds no CSS snapshots or host-command clocks. Continuous capture explicitly refuses this variable so an ignored condition cannot be mistaken for a continuous experiment. #747's automatic publication and production deployment passed; this follow-up remains a draft.
