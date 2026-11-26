# Classification inside Core and ECS batch plans

The ancestor memo in #738 reduced checks without stable ordinary latency gains.
This follow-up splits the existing diagnostic camera phases into material keys,
channel checks and adjacent-member compatibility. **It changes fixture/probe code
only; production Core/ECS packages, the normal Workflow entry, exports, feature
defaults and dependencies remain unchanged. It does not claim a speedup.**

## Scope boundaries

`framePhaseProbe.wrap` accepts an optional parent label. A conditional wrapper
calls the original method directly unless that parent is on the active probe
stack. The added classification scopes require `batch.plan`: setup, export,
submission and calls outside a captured frame are excluded. Nested parents,
errors, exact descriptors, static receivers/arguments and inherited ownership
are tested; the existing probe disposal restores every wrapper. Partial camera
installation still rolls back all preceding stages. No entity/shape argument,
material key or GPU resource is retained by these scopes.

Both backend setups opt in through the existing `CAMERA_PHASES=1` producer mode
and `?cameraPhases=1` fixture. Ordinary captures retain their normal protocol.
Raw diagnostic markers remain `mode: "camera-phase-diagnostic"` and
`phaseDetail: "camera"`; the ordinary analyzers continue rejecting them. The
new nested labels extend that diagnostic protocol, so parent exclusive time
is not comparable with older captures that lacked these child scopes.

| Label                                         | Boundary                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `batch.resolve`                               | ECS constructor resolution, including child key/channel scopes            |
| `batch.key`                                   | ECS manager key checks, including child material scopes                   |
| `batch.collect`                               | Core generic constructor/channel collection                               |
| `material.image/path/stroke/text/sdf/default` | Concrete static material-key methods; backend-specific available families |
| `channel.shadow/stroke`                       | Static channel eligibility checks                                         |
| `batch.append.image`                          | Image page append compatibility                                           |
| `batch.instances.text/default`                | ECS instance-count methods                                                |
| `batch.glyphs`                                | Core text glyph budgeting                                                 |
| `batch.validate.*`                            | Core adjacent-page validation, with distinct base/concrete scopes         |

ECS's module-local `getDrawcallCtors` is not separately timed: the residual
`batch.resolve` scope also includes branch/filter/return work and wrapper
overhead. Core has a method boundary for generic collection. A missing label
means no timed call, not proof that a feature has no cost. The paired stroke
scene bypasses Core's generic constructor collection and does not exercise Core
image/text branches. Do not generalize it to image/text workloads.

Exclusive time excludes only other measured scopes. Parent inclusive time
contains child time and must not be added to it. Conditional stack checks,
timer/bookkeeping overhead, JIT/GC and clock granularity affect these numbers;
child gating occurs before the child timer and can be charged to its parent.
These are instrumented synchronous wall durations, not CPU self samples or
GPU timings. Native scopes still include the existing counter/resource wrappers.

## Qualified runs

Clean source `bf1a274d46d8a122d74854c88944dc81b6dc4cdf`, tree
`781760fd1b6910ef5c5bbd525b983ae1317c8acf`, based on #738's merge
`5be066d06576b0325721b9fed04f709401ab9b19`. Later changes add only this report
and its data. Measured fixtures, probes, producers and package source are pinned
by that commit.

Node 24.22.3, Chromium 140.0.7339.186, SwiftShader, DPR 1. Six qualified
fresh-page captures: phase Workflow, count Workflow, count paired strokes,
phase paired strokes, ordinary paired strokes, ordinary Workflow. No other
local tests ran during these qualified captures, and no CDP sampler/trace ran.
An initial ordinary Workflow run overlapped the end of static validation; it
is retained separately and excluded, with a fresh run taken after other captures.
This is a diagnostic baseline, not a before/after optimization comparison.

Ordinary wall durations in milliseconds, kept separate from diagnostics:

| Workload     | Round | Engine p50 / p95 / total | Input/operation-to-frame p50 / p95 |
| ------------ | ----- | ------------------------ | ---------------------------------- |
| workflow ecs | 0     | 14.7 / 76.7 / 784.6      | 15.0 / 76.9                        |
| workflow ecs | 1     | 17.8 / 75.5 / 558.2      | 18.0 / 75.7                        |
| strokes core | 0     | 3.9 / 45.8 / 149.3       | 3.9 / 45.8                         |
| strokes core | 1     | 3.9 / 11.8 / 58.8        | 3.9 / 11.8                         |
| strokes ecs  | 0     | 15.9 / 85.7 / 375.1      | 29.8 / 89.2                        |
| strokes ecs  | 1     | 13.5 / 32.6 / 177.7      | 18.4 / 45.8                        |

Workflow uses the real trusted wheel handler, 20 inputs per traversal, 2,400
cards + 2,400 edges, 1,500×980 outer viewport and 1,148×914 canvas. Actual
visibility ranges 36–2,400 cards and 36–2,400 edges. Per input there are 3–22
drawcalls, 15,516–633,846 indices and 4 array vertices; allocated buffer bytes
range 94,772–3,170,524. Both traversals create/allocate 177 buffers and upload
326 times: 21,113,128 bytes first / 21,147,976 warm. The synthetic-input
rejection, injected-error positive control, GPU error gates, document equality
and pending-input teardown all pass.

The paired scene uses 2,400 strokes per backend, 12 poses per traversal and an
800×600 surface. Actual visibility ranges 0–2,400, draws 0–11, indices
0–999,000 and array vertices 0–4, including idle/offscreen/reentry. Both backends
allocate 95 buffers per traversal. Core uploads 125 times / 15,208,704 bytes;
ECS 116 times / 17,108,488 bytes. Core keeps its synchronous render boundary;
ECS keeps its awaited execution boundary. Their root timings are not equivalent.

[`batch-classification-benchmark.json`](./batch-classification-benchmark.json)
retains ordinary metrics/native arrays and every diagnostic phase summary.

## Instrumented attribution

The table uses inclusive/exclusive milliseconds per traversal. Counts shown
are first/warm; the two traversals have identical classification counts here.
`batch.plan` counts include cheap clean early returns, not just dirty rebuilds.

| Workload     | Scope                     | Calls first / warm | First inclusive / exclusive | Warm inclusive / exclusive |
| ------------ | ------------------------- | ------------------ | --------------------------- | -------------------------- |
| workflow ecs | `batch.plan`              | 40 / 40            | 344.6 / 88.0                | 388.9 / 88.4               |
| workflow ecs | `batch.resolve`           | 30211 / 30211      | 213.0 / 32.5                | 252.8 / 43.3               |
| workflow ecs | `batch.key`               | 60196 / 60196      | 180.5 / 66.1                | 209.5 / 65.9               |
| workflow ecs | `material.image`          | 30210 / 30210      | 47.7 / 47.7                 | 55.4 / 55.4                |
| workflow ecs | `material.path`           | 14992 / 14992      | 8.9 / 8.9                   | 9.2 / 9.2                  |
| workflow ecs | `material.stroke`         | 14992 / 14992      | 57.8 / 57.8                 | 79.0 / 79.0                |
| workflow ecs | `batch.append.image`      | 15198 / 15198      | 35.4 / 35.4                 | 39.4 / 39.4                |
| workflow ecs | `batch.instances.default` | 30210 / 30210      | 7.8 / 7.8                   | 8.3 / 8.3                  |
| strokes core | `batch.plan`              | 9 / 9              | 38.6 / 14.0                 | 30.5 / 10.5                |
| strokes core | `material.path`           | 8396 / 8396        | 2.4 / 2.4                   | 2.1 / 2.1                  |
| strokes core | `material.stroke`         | 25143 / 25143      | 16.5 / 16.5                 | 11.7 / 11.7                |
| strokes core | `batch.validate.stroke`   | 8389 / 8389        | 14.7 / 5.6                  | 13.0 / 6.1                 |
| strokes ecs  | `batch.plan`              | 18 / 18            | 115.2 / 28.8                | 96.1 / 18.9                |
| strokes ecs  | `batch.resolve`           | 8396 / 8396        | 83.0 / 8.9                  | 75.2 / 8.6                 |
| strokes ecs  | `batch.key`               | 16792 / 16792      | 74.1 / 28.3                 | 66.6 / 23.2                |
| strokes ecs  | `material.path`           | 8396 / 8396        | 6.2 / 6.2                   | 6.5 / 6.5                  |
| strokes ecs  | `material.stroke`         | 8396 / 8396        | 39.6 / 39.6                 | 36.9 / 36.9                |
| strokes ecs  | `batch.instances.default` | 8396 / 8396        | 3.2 / 3.2                   | 1.8 / 1.8                  |

In the instrumented Workflow, stroke material keys take 57.8/79.0 ms, image
keys 47.7/55.4 ms, and image append checks 35.4/39.4 ms. These are distinct
exclusive scopes, while `batch.key` and `batch.resolve` include their children.
The manager key residual is 66.1/65.9 ms and the plan residual 88.0/88.4 ms;
those residuals cannot be assigned to one unknown function. Ancestor scans,
component access, key concatenation, page sorting/reuse/membership and probe
overhead remain distributed across the relevant residuals.

Core's paired scene makes 25,143 stroke-key calls per traversal: 8,396 direct
planning calls and 16,747 calls from 8,389 adjacent-page validations. Validation
can check both the candidate and the page's first shape; its capacity/key guards
short-circuit, so this is not exactly two calls for every validation.
Its stroke-key scope totals 16.5/11.7 ms. ECS resolves 8,396 stroke keys,
measuring 39.6/36.9 ms. This explains where repeated work exists, but different
representations/accessors and instrumentation prevent a direct cost ratio or
an inference about ordinary CPU time. #722's negative key-reuse experiment is
not overturned by these counts.

The next runtime candidate should evaluate allocation-free eligibility checks
inside the existing stroke material-key paths (including enabled paint-layer
scans and numeric guards), while preserving exact key/fallback behavior and
fresh style/ancestor/export semantics. Evaluate Core and ECS with new ordinary
control/candidate pairs before proposing a runtime change. Image append work is
another measured cost, but this cohort does not evaluate Core image timing.
The 2,400-node smooth zoom/pan goal remains open.

## Independent work audit and reproduction

A separate count-only run retains `mode: "batch-classification-diagnostic"`.
It wraps the same concrete methods with integer increments and a manual
plan-entry depth guard, without using the probe stack, conditional timing API
or per-method performance clock. ECS count windows follow the completed engine's
before/after callbacks; Core wraps its synchronous replay operation. Counter
wrappers restore before canonical renderer teardown so a restored old planner
wrapper cannot outlive probe disposal. Counter timings are not used.

All added label call counts match the independent counters at every one of
40 Workflow and 48 paired steps. Ordinary/phase/count runs also match actual
camera targets, visible identities, surfaces, every native counter, CPU
geometry/precision work, live resource arrays in original order and document
state. The audit validates source hashes and clocks, native-draw phase counts,
geometry/precision phase counts, and ordinary paired planner-entry counts.
Mode markers remain intact, and the ordinary analyzers reject count captures.
No sorting of resource maps, marker stripping or relaxed work condition is used.

Use the public producers in separate fresh pages/directories:

```sh
CAMERA_PHASES=1 WORKFLOW_INPUT_COUNT=2400 \
WORKFLOW_INPUT_OUTPUT_DIR=/absolute/output/workflow \
WORKFLOW_CHROMIUM=/absolute/path/to/chromium \
pnpm exec playwright test -c playwright.workflow-input-bench.config.ts

CAMERA_PHASES=1 CAMERA_REPLAY_OUTPUT_DIR=/absolute/output/strokes \
WORKFLOW_CHROMIUM=/absolute/path/to/chromium \
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
```

Unset `CAMERA_PHASES` for ordinary captures. Keep `CAMERA_TIMELINE_DIR` and
`CAMERA_TIMELINE_MODE` unset throughout; mixed instrumentation is unsupported.
The private review archive retains the exact source bundle/patch, raw captures,
independent counter/cloned producers, runner, strict audit and all logs,
including the excluded overlapping capture.

Passed: 23 focused phase/replay/input unit cases (including eight probe cases),
137 tooling cases on cached Node 20.20.2, Core/ECS typechecks, browser and
paired/Workflow benchmark typechecks, repository ESLint with zero warnings,
54 Chromium + 54 WebKit browser regressions, six qualified captures and their
strict work/ownership/call-count audit. The six-case camera smoke is included
in the full browser totals, not added to them. Phase browser cases additionally
assert child key scopes on dirty zoom frames and no child scopes on idle.
Existing full export equality, culling/reentry, pixels, WebGL1, history,
interaction, camera migration and resource-retirement assertions pass in both
backends.

Correctness uses Chromium 149.0.7827.55 and cached WebKit build 2388; performance
uses the separately pinned Chromium 140 executable. WebKit skips the installed
host-requirements preflight only, with all rendering/resource assertions active.
Cached dependency CLIs on Node 24.22.3 were used directly rather than a fresh
pnpm 9.15.9 install. The restored local Husky helper is absent; local commits
use a per-command hooksPath override after explicit checks, without modifying
repository hooks. No local full site/package build, entire renderer suite,
hardware GPU/WebGPU or continuous-presentation measurement was run. Instrumented
key costs and counts do not establish a latency reduction or frame-rate ratio.
