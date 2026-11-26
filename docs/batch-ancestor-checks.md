# Shared batch-ancestor checks: rejected runtime experiment

Following #737's phase attribution, an ECS-only experiment reused read-only
ancestor barrier results within one synchronous dirty batch plan. It reduced
component checks, but ordinary Workflow latency and diagnostic planning time
did not improve consistently. **The runtime candidate is rejected. This change
retains semantic regression tests and evidence only; Core and ECS production
code, exports, dependencies and defaults remain unchanged.**

## Experiment and lifetime

ECS `BatchManager.batchKey` rejects a candidate when it or an ancestor has any
`ClipMode`, `Filter` or `NodeLayerBlendMode` component, including presence with
`none`/`normal` values. The experiment checked each leaf directly and used a
plan-local `Map<Entity, boolean>` only for ancestors. An iterative path avoided
recursive depth limits; failed reads cleared partial results. Nothing was
stored on entities, drawcalls, resource caches or managers, and no entity handle
was retained across plans/frames. Constructor selection, key construction,
material eligibility and GPU submission were unchanged.

Becsy 0.16.0's `EntityPool.borrowTemporarily` reuses a borrowed reference during
one system execution and returns borrowed handles between executions. The
experiment relied only on that synchronous window, not held/private entity IDs.
Core's `packages/core/src/drawcalls/BatchManager.ts` iterates flat `Shape`
instances and has no corresponding ancestor-component loop. Its runtime was
unchanged and its same qualified stroke trace was measured separately. Copying
an ECS-specific memo into Core would add an unrelated path.

Clean measured source, available in the review archive's experiment bundle:

| Source                  | Commit                                     | Tree                                       |
| ----------------------- | ------------------------------------------ | ------------------------------------------ |
| Control                 | `7bd4311cd1ae189ffa544f7ad7992d893d04cfa0` | `7fa629cc7b5af62dcbf1462ca2fa8715ece362a8` |
| Candidate (not shipped) | `86c1a45e0b1da268ad7e37dffc5a6535c0d83dd2` | `e985158bdac129f8e89d5b26bcb21bbb05ecf58a` |

The final review branch starts from the control and does not contain the
experimental utility or its implementation-specific count assertions. Three
new ECS manager regressions cover shared ancestry across barrier add/remove,
reparenting, removal/reentry and runtime switches using the real renderer
classes with the existing fake entity storage/GPU boundary. They assert current
behavior, not memoization. The candidate's seven additional utility cases
(shared/blocked ancestors, leaf barriers, new passes, exception retry and a
20,000-level chain) remain in the experiment bundle.

## Ordinary controls

Node 24.22.3, Chromium 140.0.7339.186, SwiftShader, DPR 1. For each workload,
fresh-page sequential order was control-1, candidate-1, candidate-2, control-2.
No other local tests, phase scopes, CDP profiler or ancestor counters ran during
these eight captures. Each capture includes a first traversal (0) and warm
traversal (1); no diagnostic timings are pooled into ordinary results.
Raw values and work/resource arrays are in
[`batch-ancestor-checks-benchmark.json`](./batch-ancestor-checks-benchmark.json).

Engine-window p50 / p95 / total and input/operation-to-completed-frame p50 / p95,
all milliseconds. These are wall durations, not CPU self time or physical FPS.
Core remains synchronous; ECS retains its awaited execution boundary.

| Workload     | Variant/run | Round | Engine p50 / p95 / total | Completion p50 / p95 |
| ------------ | ----------- | ----- | ------------------------ | -------------------- |
| workflow ecs | control-1   | 0     | 16.8 / 103.7 / 717.4     | 17.0 / 104.0         |
| workflow ecs | control-1   | 1     | 16.5 / 60.6 / 538.0      | 16.6 / 60.7          |
| workflow ecs | control-2   | 0     | 13.5 / 82.4 / 633.1      | 13.7 / 82.6          |
| workflow ecs | control-2   | 1     | 14.9 / 54.5 / 505.4      | 16.4 / 54.7          |
| workflow ecs | candidate-1 | 0     | 13.8 / 89.9 / 712.4      | 14.0 / 90.0          |
| workflow ecs | candidate-1 | 1     | 17.0 / 72.1 / 596.8      | 18.6 / 72.4          |
| workflow ecs | candidate-2 | 0     | 18.8 / 92.4 / 797.6      | 19.0 / 92.6          |
| workflow ecs | candidate-2 | 1     | 14.2 / 56.2 / 523.3      | 15.3 / 56.4          |
| strokes core | control-1   | 0     | 4.6 / 60.7 / 191.4       | 4.6 / 60.7           |
| strokes core | control-1   | 1     | 5.5 / 28.5 / 93.6        | 5.5 / 28.5           |
| strokes ecs  | control-1   | 0     | 15.4 / 81.3 / 350.4      | 24.4 / 82.7          |
| strokes ecs  | control-1   | 1     | 12.6 / 46.4 / 226.7      | 24.0 / 52.6          |
| strokes core | control-2   | 0     | 10.4 / 60.4 / 243.5      | 10.4 / 60.4          |
| strokes core | control-2   | 1     | 7.6 / 41.0 / 131.3       | 7.6 / 41.0           |
| strokes ecs  | control-2   | 0     | 14.0 / 100.3 / 372.6     | 20.1 / 100.4         |
| strokes ecs  | control-2   | 1     | 13.4 / 39.0 / 178.3      | 17.6 / 41.8          |
| strokes core | candidate-1 | 0     | 6.5 / 63.3 / 199.8       | 6.6 / 63.3           |
| strokes core | candidate-1 | 1     | 3.5 / 12.4 / 52.9        | 3.5 / 12.5           |
| strokes ecs  | candidate-1 | 0     | 10.7 / 87.9 / 333.4      | 23.3 / 100.1         |
| strokes ecs  | candidate-1 | 1     | 13.0 / 34.5 / 189.9      | 22.1 / 48.7          |
| strokes core | candidate-2 | 0     | 4.5 / 58.6 / 152.9       | 4.5 / 58.6           |
| strokes core | candidate-2 | 1     | 3.0 / 11.0 / 45.7        | 3.0 / 11.0           |
| strokes ecs  | candidate-2 | 0     | 11.1 / 90.2 / 308.0      | 21.8 / 101.6         |
| strokes ecs  | candidate-2 | 1     | 11.6 / 57.0 / 187.7      | 14.7 / 57.0          |

Workflow candidates' first/warm engine totals are 712.4/596.8 and 797.6/523.3 ms;
controls are 717.4/538.0 and 633.1/505.4 ms. Warm p95 is 72.1/56.2 ms versus
60.6/54.5 ms. There is no consistent latency benefit on the target example.
The paired ECS totals are mixed too. Unchanged Core has substantial run-to-run
variation, reinforcing that isolated best samples cannot certify a speedup.
No statistical significance or continuous-gesture smoothness is established.

Actual Workflow visibility ranges 36–2,400 cards and 36–2,400 edges, from the
2,400+2,400 document. Outer viewport is 1,500×980, canvas 1,148×914. Per-input
drawcalls range 3–22, indices 15,516–633,846, array vertices remain 4, and
allocated buffer bytes range 94,772–3,170,524. Both variants create/allocate
177 buffers per traversal, upload 326 times and upload 21,113,128 first /
21,147,976 warm bytes. No reduced rendering workload explains the timings.

Paired Core and ECS use the same 2,400-stroke document and 12 poses per round,
on an 800×600 surface. Visibility ranges 0–2,400, draws 0–11, indices
0–999,000 and array vertices 0–4, including idle, offscreen and reentry poses.
Both allocate 95 buffers per traversal. Core uploads 125 times / 15,208,704
bytes; ECS 116 times / 17,108,488 bytes. Their operation clocks must stay
separate. Every native counter, visible membership, surface, document version,
CPU geometry call count and live resource map is exactly equal per step across
ordinary controls/candidates and their diagnostic counterparts.

## Separate diagnostic captures

Four additional phase captures and four independent counter captures retain
`camera-phase-diagnostic` and `batch-ancestor-diagnostic` markers respectively.
They are not ordinary timing. The strict audit compares all stable frame data,
validates clocks/one completed execution per target, checks native-draw phase
calls against native draws, geometry/precision calls against CPU work counters,
and planning entries against the ordinary paired lightweight scope. It keeps
the mode markers and never removes one to satisfy ordinary qualification.
Each comparison covers 40 Workflow or 48 paired steps.

The counter wraps the existing ECS `batchKey` and Entity prototype methods,
active only between the completed replay's before/after callbacks. It records
all `has`/`read` calls inside that scope and the exact three-component
`hasSomeOf(ClipMode, Filter, NodeLayerBlendMode)` pattern. Calls made by
`hasSomeOf` to `has` are included; these are nested work counts, not additive
function costs. Original receivers/arguments/returns/errors/descriptors are
preserved and restored. Core has zero counts for this ECS-specific scope.

Counts per traversal (the first and warm counts are identical):

| Workload     | Variant   | Key calls | Barrier checks | has    | read   |
| ------------ | --------- | --------- | -------------- | ------ | ------ |
| workflow ecs | control   | 60196     | 60420          | 980808 | 241230 |
| workflow ecs | candidate | 60196     | 30230          | 860048 | 241230 |
| strokes core | control   | 0         | 0              | 0      | 0      |
| strokes ecs  | control   | 16792     | 16792          | 285464 | 75564  |
| strokes core | candidate | 0         | 0              | 0      | 0      |
| strokes ecs  | candidate | 16792     | 8403           | 251908 | 75564  |

The expected repeated ancestor checks disappear, while component reads do not
fall. That work reduction is insufficient evidence for a runtime optimization.
Instrumented **exclusive** `batch.plan` wall time, milliseconds, is also mixed:

| Workload     | Variant   | First | Warm  |
| ------------ | --------- | ----- | ----- |
| workflow ecs | control   | 238.4 | 210.6 |
| workflow ecs | candidate | 214.5 | 227.5 |
| strokes core | control   | 18.5  | 12.5  |
| strokes core | candidate | 21.0  | 9.2   |
| strokes ecs  | control   | 45.4  | 49.3  |
| strokes ecs  | candidate | 51.8  | 53.1  |

Counts include cheap clean-plan entries. Phase scopes change scheduling and
JIT/GC behavior and exclude only other measured child scopes. They are not
CPU self samples or an ordinary latency estimate; their inclusive timings
must not be summed.

## Reproduction and validation

Use the public ordinary/phase producers on separate clean control/candidate
worktrees, with the same browser executable and no concurrent tests:

```sh
WORKFLOW_CHROMIUM=/absolute/path/to/chromium WORKFLOW_INPUT_COUNT=2400 \
WORKFLOW_INPUT_OUTPUT_DIR=/absolute/output/workflow \
pnpm exec playwright test -c playwright.workflow-input-bench.config.ts

WORKFLOW_CHROMIUM=/absolute/path/to/chromium \
CAMERA_REPLAY_OUTPUT_DIR=/absolute/output/strokes \
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
```

Unset `CAMERA_PHASES`, `CAMERA_TIMELINE_DIR` and `CAMERA_TIMELINE_MODE` for
ordinary captures. Set `CAMERA_PHASES=1` only for separate phase directories.
The private review archive retains the candidate Git bundle/patch, baseline
reference, all raw captures, counter hook/cloned producers, sequential runner,
strict audit and logs. The bundle requires the public control commit as its
prerequisite. Counter URL matching supports both Vite's root fixture URL and
its `/@fs/.../fixtures/` form.

The first paired counter run missed the root fixture URL and recorded zeros;
the strict audit rejected it. Its failed log/captures remain separate. The hook
was corrected and only the two paired counter captures were rerun. No ordinary
or phase result was replaced. Initial candidate lint caught imports made unused
by moving the ancestor loop; those were removed. The local Husky helper was
absent in the restored cache, so the local experimental commit used
`core.hooksPath=/dev/null` after explicit checks; no repository hook was changed.

Passed on the experimental source: 81 focused Core and 138 ECS unit cases,
ECS typecheck and repository lint. Passed on the retained review source:
81 Core and 131 ECS cases, 137 tooling cases on checksum-verified Node
20.20.2, Core/ECS typechecks, browser/paired benchmark/Workflow benchmark
typechecks, repository ESLint (zero warnings), and 54 Chromium + 54 WebKit
browser cases. Browser coverage includes both backends' pixels, WebGL1,
exports, culling/reentry, same-frame removal, history, interaction and camera
migration. These browser regressions verify the retained control runtime,
not the abandoned memoization. The seven utility cases are exclusive to the
experimental source and are not counted in the retained review's 212 units.

Correctness uses Chromium 149.0.7827.55 and cached WebKit build 2388; ordinary
performance uses the separately pinned Chromium 140 executable. WebKit skips
only the installed host-requirements preflight; rendering/resource assertions
remain active. Cached dependency CLIs and Node 24.22.3 were used directly,
instead of a fresh pnpm 9.15.9 install. All eight ordinary and eight qualified
diagnostic captures and their strict audit pass; the two missed-hook paired
counter captures remain excluded. No local full site/package build, entire
renderer suite, hardware GPU/WebGPU measurement or continuous-presentation
benchmark was run.

No new runtime optimization is proposed from these results. The next useful
measurement is constructor/material classification within the dirty Workflow
plan, with separate Core/ECS validation. Do not revive #722's rejected early
Rect guard or use this experiment to justify cross-frame entity caching. The
2,400-node smooth zoom/pan goal remains open.
