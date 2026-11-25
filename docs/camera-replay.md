# Fixed camera replay diagnostics

The time-driven Workflow tour remains the interactive end-to-end control. Its
sampled camera poses depend on frame scheduling, so two runs can weight different
visible sets when calculating percentiles. The fixed replay complements that tour
with an explicit, versioned sequence. It changes no production renderer or shipped
Workflow entry point and claims no frame-rate improvement.

## Workloads

Run `pnpm bench:camera-replay` on a clean checkout. The command runs two browser
configurations serially, with one worker:

-   Core and ECS each render the same 2,400 translated cubic strokes. Two rounds
    include overview, identical-camera idle, precision changes, focused pans,
    offscreen culling and reentry. Both use their existing diagnostic CPU/native
    probes; the micro timing boundary remains backend-specific.
-   The actual Workflow example renders 2,400 cards and 2,400 edges with image
    batching enabled. Fresh pages run ordinary and optional phase-profiled cohorts,
    each with two rounds of the same explicit poses. Ordinary and profiled timings
    remain separate.

Outputs are `.test-results/camera-replay-strokes.json` and
`.test-results/camera-replay-workflow.json`. Set `CAMERA_REPLAY_OUTPUT_DIR` to retain
multiple runs. Use the same `WORKFLOW_CHROMIUM` binary for paired captures. Source
head/tree/dirtiness, Node/browser versions, viewport, protocol and trace hash are
recorded with every result. Warm rounds are distinct from the first visit to finer
precision levels; neither is silently discarded.

## Completed frames and timing

Core measures its synchronous camera mutation plus render. ECS waits for any
execution already in progress before queuing the next edit. The diagnostic wrapper
records complete `world.execute` calls and reads `ComputedCamera`, rather than
assuming that updated app state means the target frame rendered. Any preparation
frames are retained; the final frame must match the requested derived camera.
Concurrent requests are rejected. Unreachable targets fail after eight captured
frames, bounding retained preparation data. Mutation/execution errors propagate, and canvas
destruction cancels a pending request, including a wait for an earlier execution.

Each step records the actual visible identifiers, CSS/physical canvas size, native
submissions/uploads/allocations, resources, geometry/precision work and available
phase timings. The micro page count is submitted stroke pages, not a planner query
performed by the observer. Metadata reads occur after the engine timer stops. They do not drive rendering or
compatibility planning, but can block and perturb later frame scheduling. Document equality and existing
strict GPU teardown contracts are checked independently.

Matched-frame CPU time, the sum of captured engine frames and request-to-completed-
frame time are separate fields. They exclude browser IPC and metadata serialization.
Requests intentionally start at an engine boundary. They therefore are diagnostic
work measurements, not physical presentation latency, a native GPU timer, human
input latency or an FPS claim. Keep the time-driven tour and native-device testing
as separate controls for the 2,400-card smooth-interaction goal.

## Observation and result readiness

Both Core and ECS also report `startedAt`, `observedAt` and `observationMs` on
completed frames, plus `operationToResultMs` on each step. These are additive
schema-1 fields; legacy captures remain readable. Summaries omit unavailable
observation/readiness metrics instead of reporting zero. Partial, inconsistent or
negative timing metadata is rejected.

-   `elapsed` still ends at `completedAt`, immediately after the same engine work.
    Core includes its synchronous camera mutation; ECS includes the awaited World
    execution. No renderer or timing boundary changes.
-   `observationMs` is `observedAt - completedAt`: phase-probe completion and
    synchronous camera/data/native/resource observation after the engine timer.
    It is observer wall time, not extra renderer CPU or a GPU timer.
-   `operationToFrameMs` retains request-to-engine-completion timing.
    `operationToResultMs` extends to capture readiness after observation and apply
    completion. Both exclude browser IPC and result serialization.

Workflow's observer retains its per-frame WebGL error check. On a software GPU,
`getError()` can synchronously wait for the driver and substantially affect later
RAF/capture scheduling. The extra fields expose that cost; the check is not
removed, deferred or treated as zero. Keep native, document and teardown
assertions enabled when comparing runs.

The ECS edit Promise includes queueing and can overlap engine execution; adding
its total duration to `elapsed` double-counts work. Likewise, packed in-page
requests and host-driven per-pose requests are different cadence controls and
must not be pooled into a performance claim. Separate phase-profiled and ordinary
cohorts, and label any additional probes or sampling overhead.

## Compare captures

```sh
pnpm bench:compare-camera-replay before/camera-replay-strokes.json after/camera-replay-strokes.json
pnpm bench:compare-camera-replay before/camera-replay-workflow.json after/camera-replay-workflow.json --require-native-parity
```

The comparator rejects dirty source, different protocols/traces, browser/Node or
viewport differences, missing frames, changed derived cameras, actual surfaces and
visible membership. It preserves cohort/round/pose order. Native submission changes
are reported explicitly; `--require-native-parity` also rejects draw/index/array-
vertex changes for optimizations intended to preserve submitted geometry. A change
in geometry workload still needs its own visual correctness evidence.

Percentiles use nearest rank. Every pose remains in the raw output; overview/idle,
precision changes, pan and reentry should also be inspected individually instead of
interpreting the combined p95 as a continuous interaction frame rate. A successful
comparison checks compatibility and invariants, not statistical significance.

The helper has deterministic tests for stale in-flight frames, preparation,
overlap, mutation/execution failures and destruction. Both real renderers have
browser checks for derived camera/membership, idle work, document stability and
resource ownership. The Workflow benchmark also retains its ordinary/profiled
controls and verifies every camera step, full document equality and teardown.
