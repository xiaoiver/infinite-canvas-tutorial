# Ordered frame removals

Follow-up to #733. Core records ordered removals and compacts the frame queue
once before planning. This removes repeated scans during camera culling while
preserving the existing draw order and remove/readd behavior.

## Implementation and Core/ECS parity

For R removal calls and V entries appended in a frame, the old ordered path
could scan V entries R times, particularly when culled shapes were already
absent from the visible queue. The new path records each shape's latest removal
position in a frame-local Map, then makes one V-entry filtering pass.

An entry survives only if it was appended at or after its shape's latest
removal. For example, `[A, B, A]`, remove A, add A produces `[B, A]`.
This also retains Core's existing duplicate-add semantics. Cutoffs are cleared
after compaction, at frame reset and at destruction; destruction also discards
pending ordered entries. That last boundary has a regression which reproduced
a newly introduced resurrection before the fix, passes after it, and also
passes against the unchanged base.

ECS already removes active members through `#active.delete(shape)` in
`packages/ecs/src/systems/BatchManager.ts`. It already meets this removal-cost
contract. Its production sources are byte-identical to the base. Added ordered
screen/export regressions cover repeated removal, unique-member readd order,
frame reset and independent camera ownership. Core and ECS retain their own
existing append/deduplication contracts.

Core tests also cover duplicate adds, removal before the first add, interleaved
operations, mode switches, camera migration, a deterministic operation stream
across frame boundaries and teardown before the first flush. The implementation
uses runtime queue metadata; authored data, history, geometry, interaction,
precision and GPU ownership keep their existing paths.

## Reproduce

Use the documented Node/pnpm setup. Compare the base and candidate in clean
worktrees, with a pinned `WORKFLOW_CHROMIUM`, distinct absolute output directories
and no other tests running during capture. For each workload, run control /
candidate / candidate / control sequentially.

```sh
WORKFLOW_INPUT_OUTPUT_DIR=/absolute/output/workflow/control-1 \
pnpm exec playwright test -c playwright.workflow-input-bench.config.ts

CAMERA_REPLAY_OUTPUT_DIR=/absolute/output/strokes/control-1 \
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts

node scripts/compare-workflow-input.mjs before-workflow.json after-workflow.json
node scripts/compare-camera-replay.mjs before-strokes.json after-strokes.json --require-native-parity
```

Measured clean base: `9e76b1e3d685f961494783d72ab552c5cb02369a`.
Measured clean candidate: `ea846f2381bbbfff641b23d924738b20d518248d`, tree
`9f4c95007c4dbaad86bed5ba34cc3551e72cc4df`. The later report commit adds only
documentation. Node 24.22.3, Chrome 140.0.7339.186, SwiftShader and DPR 1.
The earlier pre-teardown-fix batch is retained separately and is not pooled
with the final batch below.

## Ordinary elapsed times

Each cell is engine total / p50 / p95 in milliseconds. Each stroke traversal
has 12 explicit poses; each Workflow traversal has 20 trusted wheel inputs.
Core keeps its synchronous render boundary; ECS keeps its awaited execution
boundary. Initialization, observation and validation stay outside engine time.
These isolated targets do not measure continuous-gesture FPS or presentation.

| Capture     | Core first          | Core warm           | Paired ECS first     | Paired ECS warm     |
| ----------- | ------------------- | ------------------- | -------------------- | ------------------- |
| control-1   | 210.1 / 14.4 / 61.2 | 150.9 / 9.8 / 33.4  | 245.9 / 9.4 / 64.3   | 235.3 / 13.5 / 60.4 |
| candidate-1 | 154.0 / 4.7 / 47.7  | 59.2 / 3.1 / 12.9   | 335.8 / 10.5 / 110.3 | 205.7 / 10.1 / 55.5 |
| candidate-2 | 135.5 / 4.1 / 47.1  | 50.5 / 3.6 / 13.7   | 298.3 / 13.4 / 82.8  | 270.6 / 17.2 / 64.1 |
| control-2   | 197.6 / 13.1 / 55.9 | 156.5 / 11.9 / 33.6 | 246.0 / 10.2 / 58.3  | 211.4 / 13.6 / 62.9 |

Core improves in both candidate captures across first/warm totals and tails.
Paired ECS timings are mixed, including slower candidate first traversals.
This change establishes a Core curve-scene benefit in this environment; it
does not establish a Workflow ECS improvement.

| Capture     | Workflow ECS first  | Workflow ECS warm   |
| ----------- | ------------------- | ------------------- |
| control-1   | 646.7 / 12.7 / 72.2 | 438.3 / 12.5 / 52.6 |
| candidate-1 | 628.6 / 14.6 / 89.8 | 450.4 / 14.3 / 59.2 |
| candidate-2 | 657.8 / 16.8 / 75.2 | 542.7 / 17.8 / 71.7 |
| control-2   | 602.7 / 12.3 / 71.0 | 502.8 / 14.6 / 63.7 |

Workflow candidate warm p95 is 59.2 / 71.7 ms, versus 52.6 / 63.7 ms
for the controls. The 2,400-node smooth-interaction goal remains open. Further
work should prioritize ECS stroke-page packing and repeated compatibility/
component access, with matched workloads and separate measurement boundaries.

## Work, quality and resource parity

The real Workflow contains 2,400 cards and 2,400 edges. Its 1,148 × 914 CSS-pixel
canvas (outer viewport 1500 × 980) shows 36–2,400 cards and 36–2,400 edges along
each traversal. Every traversal creates/allocates/deletes 177 buffers and
uploads 326 times. First/warm upload payloads are 21,113,128 / 21,147,976 bytes.
Draws range 3–22, submitted indices peak at 633,846, and array vertices stay
at 4. Peak requested live buffer allocation is 3,170,524 bytes. These counters
match across all four captures.

The paired stroke trace has 0–2,400 visible strokes, 0–11 draws and up to
999,000 submitted indices. An additional parity-only audit checks every native
counter, geometry work count, stroke page count and live resource map, alongside
the committed replay comparisons. It passes all four captures per workload:
40 Workflow steps and 48 paired Core/ECS steps per capture. Requested/actual
views, visible membership and surfaces match. Documents, GPU error gates and
native teardown pass. No drawcall, upload or vertex-count reduction is claimed.

## Validation and diagnostic limits

Passed locally:

-   81 Core cases (13 lifecycle plus 68 related stroke/text/image batching cases).
-   The 13 lifecycle regressions also pass against the unchanged base.
-   101 ECS cases, including ordered screen/export removal and resource ownership.
-   34 Chromium 149 and 34 WebKit browser cases after the teardown correction:
    pixels, caps/joins/order, picking, history, transforms, camera migration,
    WebGL1, full raster export, cull reentry, same-frame deletion and GPU teardown.
-   100 tooling cases, repository ESLint with zero warnings, changed-content
    formatting, Markdown lint and diff checks. Existing ECS formatting is preserved.
-   Core/ECS and browser/Workflow benchmark TypeScript projects; Core checked again
    after the teardown correction.
-   Eight final ordinary captures and the exact-work/resource parity audit.

Separate optional timeline attempts are not ordinary timing evidence. The final
control paired timeline passes. The candidate paired attempt is rejected by
its ECS clock bracket; one retry is rejected for a negative Core sample delta.
An earlier pre-fix control sample also had a negative closing delta. The raw
captures and failures are retained, guards are unchanged, and no cross-variant
profiling comparison is reported. These rejected captures do not replace any
ordinary sample in the tables.

The Node CLIs use the installed toolchain directly rather than pnpm 9.15.9.
WebKit uses the environment's existing host-requirement precheck override with
real browser assertions unchanged. Full site/package builds, complete renderer
suites, hardware-GPU/WebGPU measurements and sustained gesture/presentation
acceptance were not run locally. Raw captures, producers, audits, exact source
bundle and failure logs are retained in the private review archive.
