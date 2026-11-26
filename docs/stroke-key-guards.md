# Stroke-key temporary eligibility arrays: rejected runtime experiment

After #739 identified material-key costs, this experiment replaced the numeric
`Array.every(Number.isFinite)` guards in Core and ECS with scalar finite guards.
ECS also scanned for any enabled fill and exactly one enabled stroke without
creating filtered layer arrays. **Ordinary results did not show consistent
end-to-end improvement, so the runtime candidate is rejected. The retained
review adds tests and this report/data only.** Production package source,
defaults, dependencies and exports are unchanged, and no changeset is needed.

## Candidate and retained tests

Core avoided one source-level numeric guard array. ECS avoided up to three
source-level temporary arrays on eligible paths: enabled-fill results,
enabled-stroke results and numeric guards. The key's JSON tuple/string,
Becsy component checks and other existing allocations remained. These are
source-level observations; V8 allocations or GC effects were not measured,
and compiler optimization may already remove some allocations. No allocation
ratio, retained-memory saving or smoother interaction is established.

The abandoned ECS helper skipped sparse-array holes and selected exactly one
enabled stroke, retaining the raw material string, opacity normalization,
blend/effect/arrow fallbacks and finite-value policy. No material key, entity
handle or GPU resource was cached across calls. The numeric checks and paint
policy were evaluated afresh on every call. Constructor/page planning and GPU
submission remained unchanged. This experiment does not revive #722's rejected
per-plan key reuse or early Rect guard.

The retained tests cover every guarded numeric field with NaN and both
infinities, restoration to its original key, finite extreme and negative-zero
translations, absent/empty/sparse/disabled/multiple paint layers, current paint
edits and exact raw stroke-key bytes. The same extended stroke suites pass on
the unchanged baseline: 33 Core and 28 ECS cases. Those 61 cases are part of
the larger retained validation totals, not additional cases. Both backends'
new tests assert existing behavior rather than an allocation implementation.

## Qualified sources and protocol

| Source             | Commit                                     | Tree                                       |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| Control            | `f09d2e14711f81356f5c2587b890df3ab8a5ebff` | `f22422019848a11c5877e6764ac74a54012c0b08` |
| Rejected candidate | `8a756e345eb65ea5d8ee23e9f95af9162088b406` | `18c6254d64b837211db1eaa46d420d36ccd96f30` |

Eight sequential fresh-page ordinary captures, four per workload, in the order
control-1, candidate-1, candidate-2, control-2. All captured worktrees were clean.
No other local tests, per-method diagnostic timers, CDP sampling or timelines
ran during these captures. No timing run was discarded or replaced. The
ordinary paired producer retains its existing lightweight plan scope; no new
instrumentation was layered onto it. Node 24.22.3, Chromium 140.0.7339.186,
headless SwiftShader, DPR 1.

Engine and completion clocks below are wall durations, not process CPU counters,
GPU completion or presented FPS. Core remains synchronous and ECS awaited;
their root timing boundaries are not equivalent. Each Workflow row has 20
trusted wheel inputs and each paired row has 12 poses. Nearest-rank p95 is the
maximum at 12 poses. First (0) and warm (1) traversals stay separate.

| Workload     | Variant/run | Round | Engine p50 / p95 / total ms | Input/operation-to-frame p50 / p95 ms |
| ------------ | ----------- | ----- | --------------------------- | ------------------------------------- |
| workflow ecs | control-1   | 0     | 18.8 / 92.6 / 780.5         | 19.1 / 92.9                           |
| workflow ecs | control-1   | 1     | 15.3 / 65.3 / 564.4         | 15.7 / 65.5                           |
| workflow ecs | control-2   | 0     | 12.8 / 85.5 / 601.1         | 12.9 / 85.8                           |
| workflow ecs | control-2   | 1     | 15.1 / 62.8 / 516.8         | 15.3 / 62.8                           |
| workflow ecs | candidate-1 | 0     | 17.9 / 92.4 / 731.8         | 18.1 / 92.6                           |
| workflow ecs | candidate-1 | 1     | 16.6 / 75.6 / 539.9         | 16.8 / 75.8                           |
| workflow ecs | candidate-2 | 0     | 17.9 / 73.1 / 695.6         | 18.2 / 73.4                           |
| workflow ecs | candidate-2 | 1     | 17.8 / 57.1 / 470.7         | 17.9 / 57.2                           |
| strokes core | control-1   | 0     | 5.7 / 64.1 / 173.9          | 5.7 / 64.1                            |
| strokes core | control-1   | 1     | 5.2 / 16.6 / 72.0           | 5.2 / 16.7                            |
| strokes ecs  | control-1   | 0     | 15.8 / 66.7 / 330.4         | 20.1 / 68.2                           |
| strokes ecs  | control-1   | 1     | 15.3 / 81.3 / 291.4         | 22.2 / 87.7                           |
| strokes core | control-2   | 0     | 6.4 / 50.2 / 209.7          | 6.5 / 50.2                            |
| strokes core | control-2   | 1     | 6.6 / 55.7 / 166.7          | 6.7 / 55.7                            |
| strokes ecs  | control-2   | 0     | 9.6 / 67.1 / 262.5          | 24.8 / 82.1                           |
| strokes ecs  | control-2   | 1     | 10.8 / 44.0 / 174.3         | 18.4 / 53.9                           |
| strokes core | candidate-1 | 0     | 5.9 / 46.3 / 145.1          | 5.9 / 46.3                            |
| strokes core | candidate-1 | 1     | 3.8 / 17.1 / 73.1           | 3.8 / 17.1                            |
| strokes ecs  | candidate-1 | 0     | 11.1 / 59.7 / 283.2         | 22.7 / 65.4                           |
| strokes ecs  | candidate-1 | 1     | 13.7 / 107.4 / 270.3        | 17.2 / 122.2                          |
| strokes core | candidate-2 | 0     | 5.9 / 53.1 / 146.2          | 5.9 / 53.1                            |
| strokes core | candidate-2 | 1     | 3.4 / 12.4 / 54.4           | 3.4 / 12.4                            |
| strokes ecs  | candidate-2 | 0     | 15.2 / 89.0 / 324.1         | 25.6 / 99.5                           |
| strokes ecs  | candidate-2 | 1     | 12.5 / 51.0 / 213.0         | 20.3 / 66.7                           |

Workflow warm totals are 539.9/470.7 ms in the candidates versus 564.4/516.8 ms
in the controls, but warm p95 is 75.6/57.1 versus 65.3/62.8 ms. The first
candidate worsens the tail while the second improves it. First-traversal totals
are 731.8/695.6 versus 780.5/601.1 ms, within substantial control variation.
The paired ECS warm totals are 270.3/213.0 versus 291.4/174.3 ms and p95
107.4/51.0 versus 81.3/44.0 ms. Core's lower candidate totals do not establish
a benefit for the real ECS Workflow or a backend-independent gain. These small
cohorts do not establish statistical significance or a causal JIT/GC mechanism.
The code complexity is not justified by a stable interaction improvement.

All eight captures pass the public ordinary qualifiers and an additional strict
audit of per-step clocks, source identities, targets, actual views, membership,
surfaces, every native counter, CPU geometry work, lightweight plan-entry counts,
allocated bytes and live resource maps in their original order. No diagnostic
markers were stripped or resource arrays normalized. Document equality, GPU
error gates, injected-error control, trusted-input checks and complete teardown
all pass. Raw metrics and work arrays are in
[`stroke-key-guards-benchmark.json`](./stroke-key-guards-benchmark.json).

Workflow uses the real 2,400-card + 2,400-edge document, 1,500×980 outer viewport
and 1,148×914 canvas. Actual visibility ranges 36–2,400 cards and 36–2,400 edges;
per-input drawcalls 3–22, indices 15,516–633,846 and array vertices 4. Allocated
buffer bytes range 94,772–3,170,524. Every traversal creates/allocates 177
buffers and uploads 326 times, 21,113,128 bytes first / 21,147,976 warm.

Paired Core/ECS use the same 2,400-stroke document on an 800×600 surface, with
visibility 0–2,400, draws 0–11, indices 0–999,000 and array vertices 0–4,
including offscreen/reentry and idle. Both create/allocate 95 buffers per
traversal. Core uploads 125 times / 15,208,704 bytes; ECS 116 times /
17,108,488 bytes. All native and resource work matches exactly per step across
sources and repetitions; no reduced rendering workload explains the timings.

## Reproduction and validation

The review archive retains the rejected candidate's thin Git bundle/patch,
raw captures, sequential runner, strict audit and validation logs. The bundle
requires public control commit `f09d2e1` as a prerequisite. The final review
starts from that control, copies only the semantic tests, and does not contain
the candidate helper, scalar guards or package changeset.

Run in separate clean control/candidate worktrees with the same browser binary,
separate output directories and no concurrent local tests:

```sh
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/absolute/output/workflow \
WORKFLOW_CHROMIUM=/absolute/path/to/chromium \
pnpm exec playwright test -c playwright.workflow-input-bench.config.ts

CAMERA_REPLAY_OUTPUT_DIR=/absolute/output/strokes \
WORKFLOW_CHROMIUM=/absolute/path/to/chromium \
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
```

Unset `CAMERA_PHASES`, `CAMERA_TIMELINE_DIR` and `CAMERA_TIMELINE_MODE` for all
ordinary captures. Keep backend scopes separate. The private baseline-test
invocation first used the candidate directory instead of the reference directory
and failed to find the copied test before running any test; its log is retained.
The directory was corrected and both complete extended stroke suites passed on
the baseline. No benchmark capture was affected or rerun.

Passed on both candidate and retained review: 46 focused Core and 115 ECS unit
cases, Core/ECS typechecks and repository ESLint with zero warnings. Passed on
the retained review: 137 tooling cases on checksum-verified Node 20.20.2,
browser/paired benchmark/Workflow benchmark typechecks, and 54 Chromium +
54 WebKit browser cases. The baseline-only extended stroke suites (33 Core,
28 ECS) are included in the review's 161 focused cases, not added to them.
The eight ordinary captures and strict comparison audit pass. Browser cases
verify the retained control runtime, not the abandoned scalar/layer helper;
the candidate is covered by its unit suites and ordinary work/ownership audit.
Coverage includes current pixels, WebGL1, full exports, interaction/history,
culling/reentry, same-frame removal, camera migration and resource retirement.

Correctness uses Chromium 149.0.7827.55 and cached WebKit build 2388;
performance uses the separately pinned Chromium 140 executable. WebKit skips
only the installed host-requirements preflight; runtime assertions are unchanged.
Cached dependency CLIs on Node 24.22.3 were used directly rather than a fresh
pnpm 9.15.9 install. The restored local Husky helper is absent; local commits
use a per-command hooksPath override after explicit checks without changing
repository hooks. No local full site/package build, entire renderer suite,
hardware GPU/WebGPU, allocation/heap profile or continuous-presentation
measurement was run. The 2,400-node interaction goal is not qualified by these
software-rendering, one-target-per-input observations.

## Next direction

The next investigation should measure why dirty plans reclassify unchanged
members, rather than infer benefit from temporary-array syntax. ECS
`MeshPipeline` currently queues membership/LOD/transform/order changes separately
from style-component reassignment, while `BatchManager.plan` resolves every
active member of a dirty plan. Record those causes and the number of unchanged
members before proposing any retained classification. A safe update path must
observe paint/component writes, in-place data edits, ancestor effects, LOD,
selection/hover/editing, camera migration, feature switches, export intent,
removal/reentry and failed plans; Core's mutable shape/color contract must also
be evaluated. No new retained cache is proposed from this negative result.
The 2,400-node smooth zoom/pan goal remains open.
