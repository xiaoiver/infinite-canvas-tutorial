# Camera engine windows and browser timelines

The 2,400-card Workflow goal remains open. Sharing immutable stroke buffers in
[#732](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/732) reduces
allocation work, but does not establish smooth zooming. This change adds an
opt-in diagnostic to the existing real Workflow trusted-wheel producer and the
paired Core/ECS 2,400-stroke producer. It changes no renderer or shipped example.

## Reproduce

Use the documented Node/pnpm setup and install Playwright Chromium. Run each
capture sequentially, without other tests running. `WORKFLOW_CHROMIUM` can select
an existing Chromium executable; these captures used Chrome 140 / SwiftShader.

```sh
WORKFLOW_INPUT_OUTPUT_DIR=.test-results/timeline/workflow \
CAMERA_TIMELINE_DIR=.test-results/timeline/workflow \
pnpm exec playwright test -c playwright.workflow-input-bench.config.ts

CAMERA_REPLAY_OUTPUT_DIR=.test-results/timeline/strokes \
CAMERA_TIMELINE_DIR=.test-results/timeline/strokes \
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
```

Without `CAMERA_TIMELINE_DIR`, both producers keep their ordinary behavior.
Repeat without that variable into separate output directories for ordinary
elapsed times. WebKit supports ordinary replay; the opt-in diagnostic requires
Chromium CDP. It records no screenshots, screencast, heap snapshot or document
contents in its timeline files. The existing workload capture still records its
normal membership, work and document-equality results.

Each diagnostic emits `<backend>.raw.json` (trace events, CPU profile, clock
anchors, source identity and engine windows) and `<backend>.summary.json`.
Workflow uses the name `workflow`. The existing workload JSON is marked
`camera-timeline-diagnostic`; ordinary comparison tools reject it. A trace is
saved before analysis so rejected captures remain inspectable.

## Measurement boundaries

The observer does not add marks or method wrappers inside engine execution.
Two `performance.mark` events outside the traversal align the page clock with
trace timestamps on one renderer main thread. A separately bracketed
`Performance.Timestamp` checks agreement with CPU-profile time. The analyzer
rejects missing/duplicate anchors, thread/process changes, more than 0.2 ms
anchor drift (including timestamp quantization), calibration brackets wider than
10 ms, inconsistent clocks, out-of-range windows, invalid samples and trace loss.
These are consistency checks, not a claim of sub-millisecond causal precision.

The windows remain Core's synchronous render boundary and ECS's awaited engine
execution. Workflow uses the existing trusted native wheel handler, one event
per completed target. Observation, document comparison, GL error gates and
teardown remain outside these windows. This is not continuous-gesture FPS or
physical presentation latency.

The analyzer clips complete-duration (`X`) events and CPU sampling intervals to
those windows. Task and GC coverage are interval unions on the renderer main
thread; background-worker GC is excluded. Other event-name totals are inclusive,
can overlap and must not be added together. GC-labelled coverage includes main
thread incremental/support work, not exclusively stop-the-world pauses.

CPU sampling requests a 1 ms interval. Samples with gaps above 3 ms contribute to
`sparseSampleOverlapMs` and are excluded from function rankings. Remaining
`sampleSelfTop` weights are estimates of sampled stack residence, including
possible native waiting, not process CPU time or exact function durations.
`(program)` and `(idle)` stay unclassified. A task spanning a window does not prove
the OS scheduled that thread continuously, and time outside recorded tasks is
not automatically scheduler delay. Vite profile locations refer to served code,
not source-map-corrected TypeScript line numbers.

## Independent trace-only mode

When the CDP CPU sampler produces invalid sample deltas, retain that rejected
capture and start a **new** capture with `CAMERA_TIMELINE_MODE=trace`:

```sh
CAMERA_TIMELINE_MODE=trace \
CAMERA_TIMELINE_DIR=.test-results/trace/workflow \
WORKFLOW_INPUT_OUTPUT_DIR=.test-results/trace/workflow \
pnpm exec playwright test -c playwright.workflow-input-bench.config.ts
```

Use the same variable with `playwright.camera-replay-bench.config.ts` and its
separate `CAMERA_REPLAY_OUTPUT_DIR` for paired Core/ECS captures. Without a
diagnostic directory, ordinary behavior stays unchanged. With a directory, the
default remains `profile`; invalid mode names fail before opening a CDP session.

Trace-only capture does not enable/start/stop `Profiler`. Its raw file declares
`captureKind: "trace-only"` and has no `profile` property. The shared analyzer
retains anchor, renderer/thread, Performance-clock bracket, window, task and
trace-loss validation. It reports main-task union, GC-labelled union, time
outside recorded tasks and inclusive event-name coverage. It emits **no** sample
rankings or sample-interval fields. These are trace event durations, not CPU
self time; outside-task time is not automatically GPU or scheduler waiting.

The CPU-profile analyzer still rejects invalid samples. It never falls back to
trace-only. The trace analyzer requires the explicit capability marker and
rejects any supplied CPU profile, including an undefined property. Old rejected
CPU captures must not be relabelled to make them pass. Both capture kinds keep
`mode: "camera-timeline-diagnostic"`, so ordinary timing comparators reject them.
Stop/analysis failures preserve raw data when available and detach the session;
abort is idempotent. No renderer or measurement boundary changes.

## Recorded results

Measured source: `b485c7355b692bb4700e1cf256c401ab15067a4d`, tree
`2fc0c9c2bac6c4149764a0d6231ebf5b91b042b6`, clean. Node 24.22.3,
Chrome 140.0.7339.186, SwiftShader, DPR 1. Four sequential captures: ordinary
Workflow, diagnostic Workflow, diagnostic paired strokes, ordinary paired
strokes. No other local tests ran during these captures. An earlier exploratory
batch and its failed audit attempt are retained separately; their timings are
not pooled with this batch.

Ordinary engine wall time, milliseconds:

| Workload     | Traversal | Frames | Total | p50  | p95  |
| ------------ | --------- | ------ | ----- | ---- | ---- |
| Workflow ECS | first     | 20     | 701.3 | 17.8 | 75.2 |
| Workflow ECS | warm      | 20     | 533.2 | 16.5 | 62.0 |
| Paired Core  | first     | 12     | 228.5 | 14.9 | 64.1 |
| Paired Core  | warm      | 12     | 117.9 | 11.6 | 29.2 |
| Paired ECS   | first     | 12     | 271.1 | 10.2 | 70.4 |
| Paired ECS   | warm      | 12     | 158.2 | 9.0  | 45.5 |

Workflow input-to-completed-frame p50/p95: first 18.3/75.5 ms, warm
16.7/63.5 ms. The actual 1,148 × 914 CSS-pixel canvas shows 36–2,400 cards and
36–2,400 edges, not 2,400 visible at every target. Each traversal creates 177
buffers and uploads 326 times; first/warm uploaded bytes are 21,113,128 /
21,147,976. Draws range 3–22, submitted indices peak at 633,846 and array
vertices stay at 4. Paired strokes range 0–2,400 visible, 0–11 draws and
0–999,000 indices. Document equality and native-resource teardown pass.

A separate parity-only audit compares all 40 Workflow and 48 paired stroke
steps between ordinary and diagnostic captures: exact targets, actual views,
surfaces, memberships, native counters, geometry work counts and live resources.
It excludes all timing fields and never removes the diagnostic marker to pass
an ordinary timing comparison. An initial private audit incorrectly compared
`precisionMs`/`geometryMs`; it was corrected to compare their call counts. No
native-work or resource requirement was relaxed.

Diagnostic totals, kept separate from ordinary timings:

| Workload     | Windows | Engine wall ms | Main-task coverage ms | GC-labelled union ms | Sparse sample overlap ms |
| ------------ | ------- | -------------- | --------------------- | -------------------- | ------------------------ |
| Workflow ECS | 40      | 1,057.7        | 1,057.7               | 20.5                 | 132.6                    |
| Paired Core  | 24      | 358.6          | 358.6                 | 11.3                 | 15.0                     |
| Paired ECS   | 24      | 438.0          | 438.0                 | 9.8                  | 8.4                      |

Clock brackets are 2.6 / 2.5 / 3.1 ms; anchor drift is +0.055 / +0.049 /
−0.024 ms, respectively. Maximum profile gaps across entire captures reach
188 / 174 / 264 ms, mostly outside engine windows; sparse overlaps above are
explicitly unassigned rather than credited to the next sampled function.

Examples within diagnostic windows, not exact costs or optimization gains:

-   Workflow's first wheel frame lasts 144.0 ms: GC-labelled coverage is 4.7 ms;
    non-sparse self-sample weights include adaptive `bezier` 23.8 ms, a
    `SmoothPolyline` closure 8.7 ms and stroke packing 7.5 ms.
-   Core's first `zoom-2` lasts 94.5 ms: GC coverage 3.1 ms; sample weights include
    adaptive `bezier` 24.7 ms, batch removal 20.2 ms and segment packing 15.5 ms.
    The 48.0 ms `zoom-4` also samples batch removal at 20.9 ms.
-   ECS's warm `reentry` lasts 45.6 ms with no GC-labelled overlap: stroke packing
    samples 16.3 ms; component mask checks and compatibility-key resolution also
    appear. A 2.2 ms `bufferSubData` sample remains stack residence, not a GPU timer.

These observations direct the next controlled experiment toward Core's repeated
`#frameShapes.filter` in ordered removal and ECS's page rebuild/compatibility
component access. ECS already removes active items with `Map.delete`; its path
must not inherit a Core-specific workaround. Preserve painter order, same-frame
remove/readd/delete behavior, cull reentry, exports and resource ownership in
both backends. Do not introduce writable GPU-buffer reuse based on these traces.

## Trace-only results after #735

The independent trace path was qualified at clean local commit
`5ddd98d36a46e6e11f4ba68f690b5cb3a886fa35`, tree
`2e4996902107a85fc28218d416e5e6ec18b4899e`, based on #735's merge
`e88c3e4c51607477d81225aa912d3d67d0e1c969`. Subsequent report and Node 20 test-loader
changes do not alter measured scripts or runtime packages.
Node 24.22.3, Chrome 140.0.7339.186, SwiftShader and DPR 1. Four sequential
fresh-page captures ran without concurrent local tests: ordinary Workflow,
trace-only Workflow, trace-only paired strokes, ordinary paired strokes.

Ordinary timing remains separate from diagnostic timing. This is one baseline
capture per workload, **not** an A/B improvement comparison:

| Workload     | Traversal | Engine total ms | Engine p50 / p95 ms | Input/operation-to-frame p50 / p95 ms |
| ------------ | --------- | --------------- | ------------------- | ------------------------------------- |
| Workflow ECS | first     | 658.1           | 13.8 / 73.9         | 14.3 / 74.0                           |
| Workflow ECS | warm      | 491.7           | 17.1 / 72.0         | 17.3 / 72.2                           |
| Paired Core  | first     | 170.8           | 6.0 / 63.8          | 6.0 / 63.9                            |
| Paired Core  | warm      | 71.5            | 5.0 / 19.7          | 5.0 / 19.7                            |
| Paired ECS   | first     | 361.7           | 15.1 / 124.1        | 22.2 / 128.1                          |
| Paired ECS   | warm      | 179.4           | 11.7 / 42.6         | 22.3 / 43.1                           |

Workflow still uses 20 trusted inputs per traversal on the actual 1,148 × 914
canvas, with 36–2,400 visible cards and 36–2,400 visible edges. Every input has
one completed engine execution. Observer p50/p95 is 2.4/4.1 ms first and
2.4/4.9 ms warm, outside engine timing. Its native draws are 3–22, indices
15,516–633,846, array vertices 4, and live allocated buffer bytes 94,772–3,170,524.
Each traversal creates/allocates 177 buffers and uploads 326 times; first/warm
uploaded bytes are 21,113,128 / 21,147,976.

The paired Core/ECS trace retains the same 12 poses and 800 × 600 surface,
0–2,400 visible strokes, 0–11 draws, 0–999,000 indices and 0–4 array vertices,
including culling/reentry and idle. Each backend/traversal creates/allocates 95
buffers. Core uploads 125 times / 15,208,704 bytes; ECS uploads 116 times /
17,108,488 bytes. Core observer p50/p95 is 0.1/0.4 ms first, 0.1/0.2 ms warm;
ECS 0.5/1.7 ms first, 0.5/0.9 ms warm. Preserve the separate synchronous Core
and awaited ECS operation boundaries.

A strict non-timing audit matches all **40 Workflow + 48 paired** steps between
ordinary and trace captures: requested/actual views, surfaces, visible identities,
all native counters (including extra numeric fields), geometry call counts,
state, live resources and allocated bytes. Documents and teardown pass. The
audit independently recomputes each raw trace summary, requires the trace-only
marker and absence of a CPU profile, and retains diagnostic mode markers. It
does not pass diagnostic captures through ordinary timing qualification by
stripping their markers. Full raw data, parity scripts and logs are retained in
the private review archive.

The trace-only diagnostic reports:

| Workload     | Windows | Engine wall ms | Main-task union ms | GC-labelled union ms | Outside recorded tasks ms |
| ------------ | ------- | -------------- | ------------------ | -------------------- | ------------------------- |
| Workflow ECS | 40      | 1182.700       | 1182.700           | 17.726               | 0.000                     |
| Paired Core  | 24      | 253.200        | 253.200            | 12.719               | 0.000                     |
| Paired ECS   | 24      | 521.100        | 521.094            | 11.006               | 0.007                     |

Clock bracket widths are 3.0 / 2.4 / 3.4 ms, and anchor drift is
+0.018 / +0.048 / +0.053 ms. All clock/loss gates pass. There is no sampler,
no sample-delta normalization and no function ranking in these captures.

Workflow's longest diagnostic frame is 129.9 ms with 4.1 ms of GC-labelled
coverage; its 100.4 ms last first-round frame has 2.3 ms. Core's longest is
67.4 ms with 6.5 ms GC-labelled coverage. ECS's longest is 110.3 ms with 4.8 ms;
its 47.5 ms warm coarsen frame has no GC-labelled overlap. These durations are
instrumented observations, not ordinary performance gains.

In this diagnostic batch, long engine windows sit almost entirely inside
renderer main-thread tasks and GC covers a small fraction. This does not show
a dominant gap outside recorded tasks or GC as the main source of the long
frames. A recorded task can include native waiting or OS descheduling; it is
**not** proof of continuous CPU execution. The trace cannot distinguish JS
geometry/planning from synchronous native calls by function. The next controlled
step is phase attribution inside those tasks, retaining trusted input, native
work and resource parity, before selecting another rendering optimization.
The 2,400-node smooth-interaction goal remains open.

The trace-only change passed 125 tooling cases overall and a final rerun of all
43 affected analyzer/capture cases, repository ESLint with zero warnings, both
browser and Workflow benchmark TypeScript projects, all four complete captures
and the 88-step audit. Ordinary WebKit trusted-wheel correctness at 24 cards/edges
is checked separately. An initial unused fixture binding and an invocation with
a nonexistent TypeScript config path were corrected; their logs are retained.
No production rendering path, dependency, default or export behavior changed.
This does not fix the CDP CPU sampler's negative-delta producer anomaly; the
original profile path still fails invalid samples. Full site/package builds,
full renderer suites, physical WebGPU/GPU and continuous-presentation tests
were not run locally for this benchmark-tooling change. Node CLIs use the
installed cached toolchain rather than pnpm 9.15.9; WebKit's host-requirement
precheck is skipped with its rendering assertions unchanged.

## Validation and limits

Passed locally: 100 tooling cases, repository ESLint with zero warnings,
Prettier, both browser/Workflow benchmark TypeScript projects, four complete
2,400-node captures and their non-timing parity audit. Ordinary WebKit trusted
wheel correctness is checked separately at 24 cards/edges. No dependency or
production source changed.

The Node CLIs use the installed toolchain directly rather than pnpm 9.15.9.
WebKit uses the environment's existing host-requirement precheck override with
real assertions unchanged. Full site/package builds, full renderer suites,
WebGPU, hardware-GPU measurements and continuous gesture/presentation tests
were not run locally. A single ordinary capture is not a speedup comparison.
Sampling and tracing alter optimization, GC and scheduling; this change claims
diagnostic capability and workload preservation, not smoother interaction.

Protocol references: [Profiler](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/)
and [Tracing](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/).

### Static-CI compatibility follow-up

The initial PR static job uses Node 20.20.2, even though the local diagnostic
captures used Node 24. Its failure exposed a new test's direct `.ts` import.
The recorder fixture now transpiles the actual TypeScript module using the
already-declared TypeScript dependency, copies the unchanged analyzer beside it
in a temporary directory, and imports the resulting ESM. Cleanup removes that
directory after the suite. No CI version, test assertion or production helper
was changed to bypass the failure. The corrected loader is verified with the
same Node 20.20.2 runtime as CI, plus the local Node 24 affected-suite rerun.
This test-only change leaves all measured producer/analyzer sources unchanged.
