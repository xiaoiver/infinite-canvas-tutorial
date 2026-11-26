# Camera phase attribution in Core and ECS

After #736, long engine windows are almost entirely covered by renderer
main-thread tasks, with relatively little GC-labelled coverage. That does not
identify geometry, batch planning, or synchronous native-call time. This adds
explicit diagnostic-only scopes to the existing producers; shipped renderer
packages and the normal Workflow entry remain unchanged.

```sh
CAMERA_PHASES=1 WORKFLOW_INPUT_COUNT=2400 \
WORKFLOW_INPUT_OUTPUT_DIR=.test-results/phases/workflow \
pnpm exec playwright test -c playwright.workflow-input-bench.config.ts

CAMERA_PHASES=1 CAMERA_REPLAY_OUTPUT_DIR=.test-results/phases/strokes \
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
```

Capture ordinary controls in fresh pages with `CAMERA_PHASES` unset and separate
output directories. Run sequentially without other tests. Pin
`WORKFLOW_CHROMIUM` to the same executable. Never combine this mode with
`CAMERA_TIMELINE_DIR`: the producer rejects mixed instrumentation. Raw workload
files retain `mode: "camera-phase-diagnostic"`; each detailed frame also carries
`phaseDetail: "camera"`. Ordinary comparison rejects that frame marker even if
the top-level diagnostic marker is removed. The existing lightweight paired
`batch.plan` scope remains compatible with legacy ordinary captures.

The shared ECS setup covers camera/bounds/culling/order, render-camera, planning,
submission and stroke preparation/geometry in both the real Workflow and paired
ECS fixture. Core keeps its synchronous render boundary and analogous planning,
submission and geometry scopes. Do not compare differently bounded root scopes
as equivalent backend costs. Workflow keeps its original trusted wheel handler,
input target checks, document equality, GPU validation gates and pending-input
teardown; ordinary and phase page modes cannot arm each other's input capture.

Synchronous WebGL API-call scopes are grouped as `native.buffer`, `native.draw`,
`native.uniform`, `native.shader`, `native.state`, `native.texture` and
`native.pass`. These include existing JavaScript counter/resource wrappers;
they are not GPU timers, isolated driver costs or CPU self time. Native methods
are wrapped on the existing initialized context. Original receivers, arguments,
return values, errors and property descriptors are preserved. Partial setup
rolls back; teardown restores wrappers while preserving the existing counter/resource observers.

The existing `framePhaseProbe` counts nested inclusive and exclusive wall time.
Inclusive phases overlap and must not be added. The diagnostic summarizer sums
exclusive scopes once, validates finite timings and call counts, and rejects
exclusive coverage beyond its completed engine window. A 1e-6 ms tolerance
handles floating-point subtraction without altering raw durations; the window
coverage check allows 1e-3 ms. Unmeasured time stays unassigned; instrumentation overhead can fall inside
measured parent scopes or the remaining window. Clock resolution can report zero for short native calls. Wrapping,
timing and bookkeeping change scheduling and JIT/GC behavior: these captures
explain instrumented workloads, not ordinary latency, physical FPS or an
optimization speedup. The 2,400-node smooth-interaction goal remains open.

## Qualified captures

Measured clean source: `2d4c6509dea719aa787913cc2d00054e5dd6f5de`, tree
`d6d4e8a295e9f230168c629318fba7a9dcd9684d`, based on #736's merge
`32f55853566ff2870d05615b413e096f74291093`. Subsequent changes only add
browser regression cases and this report; measured fixtures, producers,
analyzers and runtime packages stay unchanged.

Node 24.22.3, Chromium 140.0.7339.186, SwiftShader, DPR 1. Four sequential
fresh-page captures, with no other local tests: ordinary Workflow, phase
Workflow, phase paired strokes, ordinary paired strokes. This is one baseline
per workload, not a candidate/control speedup comparison. No CDP sampler or
trace runs during these captures. Earlier failed/partial batches remain
separate and are not pooled here.

Ordinary engine and operation clocks, milliseconds:

| Workload     | Round | Engine total | Engine p50 / p95 | Input/operation-to-frame p50 / p95 |
| ------------ | ----- | ------------ | ---------------- | ---------------------------------- |
| workflow ecs | 0     | 660.2        | 12.6 / 88.6      | 12.7 / 88.8                        |
| workflow ecs | 1     | 514.2        | 16.0 / 56.1      | 16.3 / 56.3                        |
| strokes core | 0     | 132.7        | 3.7 / 47.5       | 3.7 / 47.5                         |
| strokes core | 1     | 48.9         | 3.1 / 13.6       | 3.1 / 13.6                         |
| strokes ecs  | 0     | 301.3        | 10.2 / 70.4      | 17.0 / 81.7                        |
| strokes ecs  | 1     | 224.1        | 13.0 / 55.9      | 25.9 / 70.7                        |

Workflow uses the real trusted handler, 20 wheel inputs per round, 2,400 cards
and 2,400 edges, outer viewport 1,500 × 980 and actual canvas 1,148 × 914.
Actual visible counts range 36–2,400 cards and edges; one completed engine
execution per input. Draws range 3–22, indices 15,516–633,846, array vertices
stay at 4, and allocated buffer bytes range 94,772–3,170,524. Each traversal
creates/allocates 177 buffers and uploads 326 times; uploaded bytes are
21,113,128 first and 21,147,976 warm. GPU error gates, injected-error positive
control, synthetic-input rejection, document equality and pending-input
teardown remain active and pass.

The paired scene uses 2,400 identical strokes per backend, 12 poses and two
traversals on an 800 × 600 surface. Visible counts range 0–2,400, draws 0–11,
indices 0–999,000 and array vertices 0–4, including culling/reentry and idle.
Each backend/traversal creates/allocates 95 buffers. Core uploads 125 times /
15,208,704 bytes; ECS 116 times / 17,108,488 bytes. Preserve Core's synchronous
boundary and ECS's awaited engine boundary; do not pool their operation clocks.

A strict audit passes all **40 Workflow + 48 paired** steps: exact targets,
actual views, surfaces, visible identities, every native counter, geometry
call counts, live resource arrays in their original order and allocated bytes.
It also certifies `native.draw` phase calls against actual native draw counters,
paired geometry/precision scope calls against existing independent CPU call
counters, and paired planning calls against the ordinary lightweight scope.
The audit keeps diagnostic markers intact, independently validates each phase
summary, and never strips markers to pass an ordinary timing comparison.
Full raw captures, source bundle, failure logs, command logs and audit code
are retained in the private review archive.

## Diagnostic attribution

**Instrumented** exclusive wall time, milliseconds. Inclusive scopes remain in
the raw files and cannot be added. Native is the sum of measured API-call scope
exclusive time, including existing observer wrappers. Unassigned is the engine
window minus all measured exclusive scopes; it is not idle time.

| Workload     | Round | Engine wall | Plan  | Precision | Geometry | Native APIs | Unassigned |
| ------------ | ----- | ----------- | ----- | --------- | -------- | ----------- | ---------- |
| workflow ecs | 0     | 714.7       | 231.6 | 115.7     | 122.3    | 22.3        | 32.7       |
| workflow ecs | 1     | 609.3       | 263.1 | 35.9      | 81.7     | 16.4        | 29.2       |
| strokes core | 0     | 152.9       | 21.6  | 54.8      | 42.5     | 7.3         | 1.2        |
| strokes core | 1     | 57.2        | 10.8  | 7.6       | 14.1     | 7.0         | 0.5        |
| strokes ecs  | 0     | 295.8       | 59.6  | 71.1      | 58.6     | 9.0         | 58.0       |
| strokes ecs  | 1     | 203.6       | 46.6  | 18.2      | 42.9     | 14.2        | 47.9       |

In this instrumented Workflow batch, planning is the largest measured phase in
both traversals: **231.6 / 263.1 ms**, from 40 method entries per traversal.
Counts include clean early returns, not 40 dirty rebuilds. Reducing the number
of cheap entries alone is not a useful target. There are 69 precision and
69 SmoothPolyline geometry calls per traversal. Other exclusive work includes
drawcall submission 94.3 / 94.3 ms and culling 61.1 / 46.7 ms. These are
selected synchronous scopes, not CPU self samples.

The paired scene supports a different emphasis: Core's first traversal spends
54.8 ms in precision and 42.5 ms in geometry, while its warm traversal records
14.1 ms geometry and 10.8 ms planning. ECS records 59.6 / 46.6 ms planning and
58.6 / 42.9 ms geometry, with substantial unassigned time. Its async world/query
bookkeeping is outside several measured scopes; unassigned time must not be
called GPU waiting or a known function cost. Only listed native methods are
timed; unwrapped native work stays in its containing phase. Exclusive labels
mean "excluding other measured scopes", not semantic CPU self time.

The next runtime experiment should target repeated classification/compatibility
work inside ECS's dirty batch plan on the **real Workflow**, while checking the
same Core/ECS trace. Core's lower planning cost and larger precision/geometry
share do not justify copying an ECS-specific workaround. Preserve painter
order, same-frame removal/readd/delete, interaction fallback, full exports,
culling/reentry, camera ownership and resource retirement. The earlier rejected
#722/#735 experiments are not evidence to revive caches or writable-buffer
reuse. Any proposed change still needs fresh ordinary control/candidate pairs;
phase reductions alone cannot establish smoother 2,400-node interaction.

## Validation and failures retained

Passed: 13 focused timing/replay unit cases, 137 tooling cases on the same
Node 20.20.2 used by static CI, browser and Workflow benchmark typechecks,
repository ESLint with zero warnings, a 24-node Workflow diagnostic smoke,
four complete qualified 2,400-node captures and their strict 88-step audit.
Browser regression results are recorded in the PR. Added phase variants cover
Core/ECS export equality, idle frames, visibility/reentry, document equality,
phase/native call agreement and teardown, alongside ordinary fixed/transient
variants. Both ordinary and phase input arming reject mismatched page modes;
legacy profiling cannot be layered onto detailed wheel capture.

A first Core bootstrap exposed an import-order cycle from a newly early direct
Drawcall import. It was fixed by preserving the existing Core barrel-first
initialization order; no engine cycle was refactored. A private inspection
helper then lacked the fixture's required resource-probe setup; that helper
was corrected. A later audit rejected the first complete batch because phase
setup accessed Workflow's WebGL context too early and changed registration
order. Setup now occurs lazily at the first diagnostic arm, after explicit GPU
readiness. The corrected batch passes exact per-context order/counts: no
sorting, normalization or relaxed resource condition was used. Both prior
batches and failures remain separate from qualified results.

The new phase export regression initially compared different camera views;
its setup was corrected to use the same initial/final view while retaining
byte equality. Image payloads are omitted from archived failure logs, with
checksums retained. No screenshot artifacts are delivered.

No production package, dependency, normal Workflow entry or feature default
changes. No local full site/package build, full renderer suite, hardware GPU /
physical WebGPU test or continuous-presentation test was run. Node 24 and
cached dependency CLIs differ from pnpm 9.15.9; WebKit skips the installed host
preflight only, with actual rendering/resource assertions unchanged. Instrumented
numbers do not establish GPU throughput, physical frame rate or a speedup.
