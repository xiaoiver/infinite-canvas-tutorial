# Workflow trusted-wheel capture

This diagnostic drives the existing Workflow canvas wheel handler with trusted
Playwright mouse events. It does not call `API.edit`, `Engine.view` or camera
setters. Each event waits for the requested UI view to match a completed derived
camera frame. The capture retains the preceding preparation frames: `Engine.view`
queues its app-state update late in the ECS tick, so an event can require two
executions before the new camera is rendered.

```sh
pnpm bench:workflow-input
WORKFLOW_INPUT_COUNT=24 pnpm bench:workflow-input
WORKFLOW_INPUT_COUNT=24 WORKFLOW_INPUT_BROWSER=webkit pnpm bench:workflow-input
```

The full workload uses 2,400 cards and 2,400 edges at a 1500×980 viewport, DPR 1,
with image batching enabled. Each of two rounds starts at the actual Overview
control, sends ten wheel events with deltaY −100 followed by ten with +100, and
uses the canvas center as anchor. The small correctness workload uses 24 cards,
24 edges and two events in each direction. There are no absolute timing gates.
Run the browser commands sequentially because they share port 4181.

`WORKFLOW_CHROMIUM` can select a specific Chromium executable;
`WORKFLOW_INPUT_OUTPUT_DIR` selects the JSON directory (default `.test-results`).
The capture includes Git HEAD/tree/dirty state, browser and Node versions, each
actual target/derived view, visible memberships, surface dimensions, native
submissions, allocated buffer bytes and live resource counts. Commit source
before recording a performance result; a dirty-source run is only diagnostic.

The passive input observer is installed before the example's handler and never
cancels input. Browser microtasks may execute between event listeners, so the
requested UI target is read only after engine execution. A separate expected
`zoomAt` calculation in the driver checks both the UI request and resulting
view. Position targets are normalized with `Math.fround` to match the actual
float32 ECS camera storage; the original UI view is retained separately. The
existing zoom comparison tolerance accounts for reciprocal scale derivation. Synthetic events,
extra events during a capture, execution errors and destruction cannot produce a
successful single-event record. Capture and profiler modes cannot overlap.

`elapsed` measures the existing engine execution boundary. Both all executions
and matched-camera executions are summarized. `observationMs` measures the
post-execution membership/resource snapshot. `inputToFrameMs` starts at browser
receipt of the wheel event and ends at matched engine completion;
`inputToResultMs` also includes its observer. These are not independent CPU costs
and must not be added. They exclude driver IPC before browser event receipt.
They do not measure physical display presentation, GPU completion, continuous
trackpad gestures or hardware-accelerated performance.

Unlike the older fixed-camera replay, this capture does not call synchronous
`gl.getError()` per execution. GPU errors are drained and checked before/after
each round, with their validation elapsed time recorded separately. A positive
control injects `INVALID_ENUM` and requires detection before the real capture.
Legacy `state()`, fixed replay and their per-frame error checks stay intact.
The full document must remain equal and native resources/listeners must be
released through the real example teardown, including a pending input promise.

The shipped entry still imports `main.ts`; this observer lives only in the
benchmark entry. Core and ECS renderer behavior is unchanged. The Workflow is an
ECS application; this is not a fabricated Core comparison. Keep the existing
paired Core/ECS fixed replay tests and benchmarks as separate controls. Do not
compare the trusted-input cadence numerically with the old edit-based trace or
claim a renderer speedup from reduced observation overhead.

## Recorded baseline (2026-11-25)

Two independent ordinary captures used committed source
`67a4d2a80ad4f8b2ab4c5378ad10b620edde8412`, tree
`458194b3244f1a03313ef79b10043a2e8c3af8bd`, with `dirty: false`,
Node 24.22.3 and Chromium 140.0.7339.186 with SwiftShader. Each row contains 20
trusted events and 40 completed executions, including one preparation execution
per event. These are baseline observations, not a before/after speedup.

| Capture / round | All engine executions p50 / p95 (ms) | Matched-camera executions p50 / p95 (ms) | Input to matched completion p50 / p95 (ms) | Observer p50 / p95 (ms) |
| --------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------------ | ----------------------- |
| A / first       | 5.4 / 82.8                           | 17.9 / 86.6                              | 60.2 / 211.1                               | 2.3 / 6.2               |
| A / warm        | 7.8 / 51.2                           | 16.0 / 82.5                              | 30.5 / 498.8                               | 2.5 / 5.4               |
| B / first       | 6.6 / 81.4                           | 17.6 / 84.1                              | 44.5 / 100.9                               | 2.5 / 6.6               |
| B / warm        | 5.0 / 56.8                           | 14.0 / 62.3                              | 45.8 / 509.4                               | 2.1 / 3.0               |

Engine duration includes asynchronous `world.execute` wall time, not measured
thread CPU time. Round-boundary GPU validation took 0.1–2.7 ms per check and
reported no errors. Matched frames submitted 3–22 native drawcalls, at most
633,846 indices and four array vertices. Submitted indices include instancing;
they are not unique mesh vertices. Visible cards ranged from 36 to 2,400, edges
from 36 to 2,400. Preparation executions submitted zero draws.

The observed main-context buffer allocation range was 94,772–3,171,388 bytes.
Both rounds in both captures ended with 3,171,388 bytes and the same live native
object counts: 87 buffers, 19 textures, four programs, eight shaders, 12
framebuffers and four vertex arrays across the two tracked contexts. This is not
a total GPU-memory measurement. Both captures preserved the complete original
document; both real teardowns passed with no probe-reported leaks.

The large input tail persists without the per-execution synchronous error query.
For example, capture A's warm third event took 764.9 ms to matched completion;
its two engine executions totaled 33.5 ms, while 729.2 ms elapsed between the
preparation observer and the next execution. That gap must not be attributed to
engine CPU work or automatically labeled GPU time.

A separate local CDP investigation retained the same input/assertion path and
sampled at 1 ms without enabling phase wrappers. Its timing is excluded from the
ordinary table. Most sampled wall time was `(idle)`; `RenderNameLabel`'s scene
scan, Becsy reads, stroke packing and the benchmark's document/count reads were
visible JavaScript costs. No `getError` samples occurred inside the captured
rounds. Sampling alone does not explain the scheduling gap. The next candidates
are the late transient-camera queue (one preparation execution per event) and
name-label scans; either needs its own controlled comparison and interaction
regressions. A browser scheduling trace and hardware run are still needed to
attribute the long tail and establish smooth continuous interaction.

Validation passed: 15 replay/input unit cases; trusted-input 24-card checks in
Chromium 149 and WebKit; the existing paired Core/ECS fixed-replay checks in both
browsers (four cases); two full ordinary 2,400-card captures and the separate CDP
investigation. The initial fixed absolute-position comparison failed on fractional
float32 positions and was corrected with explicit storage normalization, without
widening the shared comparator. The initialized selection is awaited before the
document baseline; the full equality check remains strict.

The repository-wide zero-warning ESLint check, Workflow benchmark and browser
TypeScript projects, and all 48 tooling tests also passed. Full package/site
builds, the complete unit suite and physical-device continuous-gesture testing
were not run for this diagnostic-only change.
