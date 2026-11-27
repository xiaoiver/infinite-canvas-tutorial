# Page-boundary reuse: two rejected runtime prototypes

After #741, this investigation attempted to keep existing stroke/image page
boundaries during culling changes. **Neither runtime prototype is retained.**
The first increases native work and fails an interleaved-order regression; the
second reduces work on a paired ECS trace but never hits the reuse path in the
real 2,400-card Workflow. A faster timing sample with zero applicability is not
accepted as evidence that this optimization improves Workflow interaction.

The review retains shared Core/ECS behavioral contracts and this report/data.
Both packages' production source matches the control. Defaults, dependencies,
exports and package versions are unchanged; no changeset is needed.

## Attempted algorithms and disposition

The partial-page prototype indexes prior StrokeBatch/ImageBatch pages when at
least half their members remain visible. It rereads every current eligibility
and material key, then prefers the prior group's drawcalls and boundaries.
It adds no cross-frame classification cache, component version, held entity or
GPU geometry cache. The ownership index is local to each dirty plan.

This prototype is too aggressive. Workflow warm draw submissions increase from
159 to 213 per traversal and buffer creates from 177 to 244, while upload bytes
barely change. It also lets interleaved order edits alternate old page owners:
in an isolated diagnostic, all four Core/ECS stroke/image contracts produce
512 single-member planned pages for 512 same-material nodes, where two compact
pages are required. GPU submission is stubbed in these unit checks; this is a
planned-page count, not a claim of 512 measured GL submissions. These expected
failures are preserved separately and not counted as passing tests.

The whole-page revision accepts only a complete old page whose member sequence
is still contiguous in the current painter order. Two groups that fit together
compact instead of forcing a boundary. This fixes the reorder/refill cases and
restores the original native draw/index counts on both measured workloads.
Fresh key/eligibility reads, constructor fallbacks, sampler budgets, per-camera
ownership and isolated exports continue through existing paths.

The revised paired ECS trace creates 87 instead of 95 buffers and uploads
15,874,184 instead of 17,108,488 bytes per traversal: 1,234,304 fewer bytes.
Paired Core's native work is unchanged. Workflow's native counters, live resource
tables and allocated buffer bytes are identical to the control on every matching
frame. The revised Workflow warm p95 is 53.1/50.6 ms versus 67.9/61.9 ms in its
controls; warm totals are 494.3/434.4 versus 533.3/467.3 ms. The total ranges
overlap, and these small cohorts alone do not establish causation or significance.

A separate applicability diagnostic resolves that ambiguity: **Workflow records
zero anchor-member hits in both traversals**, with the source hook positively
loaded. Paired Core and ECS each record 2,544 anchor-member hits across ten
page-steps per traversal, so the recorder is not simply missing its target.
The revised helper does not take its reuse branch on the measured real example.
Its lower Workflow timing samples cannot be attributed to page retention;
no specific JIT, GC or host mechanism was measured. Keeping an extra per-plan
index for that example is not justified by these results. Both prototypes are
therefore withdrawn, including the partial version's changeset.

## Qualified sources

| Source               | Commit                                     | Tree                                       |
| -------------------- | ------------------------------------------ | ------------------------------------------ |
| Control (#741 merge) | `72c4f41961bec08e3d9882611cd1afedb8c8a8d3` | `364cf514414b2b8becd1401cd617e86545ff5388` |
| Partial prototype    | `ea67469c3d9e1ca17437dde5e520f6e0a8ab315f` | `f9ca4fb583f3ee4297279280b6b730dab64d9d0c` |
| Whole-page revision  | `4a3979972079131d392d7806013ec3ec743b0666` | `37e6f34517de141ef884135dd2d9d6a3f4102b81` |

Two independent cohorts of eight sequential fresh-page ordinary captures:
control-1, candidate-1, candidate-2, control-2 for Workflow, then the same order
for paired strokes. All measured worktrees were clean. No other local tests,
extra diagnostics, timelines or CDP sampling overlapped either cohort. No timed
run was discarded or replaced. The first cohort was moved to `ab-partial` with
its bytes preserved; the second uses `ab`. Source identities and raw SHA-256
fingerprints are in the summary data. All sixteen ordinary captures pass the
original per-capture qualifiers and document/resource teardown assertions.

Node 24.22.3, Chromium 140.0.7339.186, headless SwiftShader, DPR 1. Workflow
contains 2,400 cards plus 2,400 edges, with 20 trusted wheel inputs per traversal.
The paired trace has 2,400 paths and 12 poses. First (0) and warm (1) traversals
remain separate. The paired fixture retains its pre-existing lightweight plan
scope. Durations below are engine wall time, not process CPU counters, GPU
completion or presented FPS. Core's synchronous and ECS's awaited root boundaries
are not equivalent. Nearest-rank paired p95 is the maximum at twelve poses.

| Cohort  | Workload     | Run         | Round | Engine p50 / p95 / total ms | Input/operation-to-frame p50 / p95 ms |
| ------- | ------------ | ----------- | ----- | --------------------------- | ------------------------------------- |
| Partial | workflow ecs | control-1   | 0     | 18.8 / 86.3 / 713.7         | 19.1 / 86.5                           |
| Partial | workflow ecs | control-1   | 1     | 18.8 / 55.5 / 488.8         | 19.0 / 55.6                           |
| Partial | workflow ecs | candidate-1 | 0     | 15.5 / 74.2 / 647.6         | 16.8 / 74.4                           |
| Partial | workflow ecs | candidate-1 | 1     | 17.0 / 59.0 / 482.8         | 17.3 / 59.1                           |
| Partial | workflow ecs | candidate-2 | 0     | 11.1 / 76.1 / 568.2         | 11.3 / 76.2                           |
| Partial | workflow ecs | candidate-2 | 1     | 11.9 / 66.2 / 492.8         | 12.0 / 66.4                           |
| Partial | workflow ecs | control-2   | 0     | 21.3 / 83.6 / 702.0         | 21.6 / 83.8                           |
| Partial | workflow ecs | control-2   | 1     | 13.0 / 59.5 / 490.6         | 13.3 / 59.6                           |
| Partial | strokes core | control-1   | 0     | 4.7 / 68.5 / 164.6          | 4.8 / 68.5                            |
| Partial | strokes core | control-1   | 1     | 3.3 / 12.2 / 52.9           | 3.3 / 12.2                            |
| Partial | strokes ecs  | control-1   | 0     | 12.0 / 63.0 / 272.5         | 23.2 / 73.6                           |
| Partial | strokes ecs  | control-1   | 1     | 16.3 / 53.4 / 203.3         | 19.9 / 53.4                           |
| Partial | strokes core | candidate-1 | 0     | 7.4 / 67.1 / 202.5          | 7.4 / 67.2                            |
| Partial | strokes core | candidate-1 | 1     | 3.9 / 20.3 / 73.5           | 3.9 / 20.4                            |
| Partial | strokes ecs  | candidate-1 | 0     | 13.9 / 88.5 / 342.8         | 22.2 / 101.8                          |
| Partial | strokes ecs  | candidate-1 | 1     | 11.6 / 53.0 / 206.0         | 17.7 / 59.5                           |
| Partial | strokes core | candidate-2 | 0     | 4.4 / 50.3 / 142.8          | 4.4 / 50.3                            |
| Partial | strokes core | candidate-2 | 1     | 3.1 / 25.8 / 63.1           | 3.1 / 25.8                            |
| Partial | strokes ecs  | candidate-2 | 0     | 13.9 / 103.5 / 330.7        | 25.4 / 109.1                          |
| Partial | strokes ecs  | candidate-2 | 1     | 17.5 / 69.2 / 284.2         | 29.7 / 82.3                           |
| Partial | strokes core | control-2   | 0     | 5.6 / 51.3 / 177.4          | 5.6 / 51.3                            |
| Partial | strokes core | control-2   | 1     | 4.4 / 36.0 / 106.2          | 4.4 / 36.0                            |
| Partial | strokes ecs  | control-2   | 0     | 15.5 / 87.4 / 348.4         | 24.4 / 97.0                           |
| Partial | strokes ecs  | control-2   | 1     | 9.6 / 34.2 / 171.1          | 20.8 / 46.5                           |
| Whole   | workflow ecs | control-1   | 0     | 17.3 / 90.8 / 683.9         | 17.5 / 91.0                           |
| Whole   | workflow ecs | control-1   | 1     | 15.5 / 67.9 / 533.3         | 15.7 / 68.1                           |
| Whole   | workflow ecs | candidate-1 | 0     | 12.5 / 63.9 / 549.2         | 12.6 / 64.0                           |
| Whole   | workflow ecs | candidate-1 | 1     | 15.8 / 53.1 / 494.3         | 17.2 / 53.3                           |
| Whole   | workflow ecs | candidate-2 | 0     | 16.7 / 81.9 / 627.4         | 16.8 / 83.1                           |
| Whole   | workflow ecs | candidate-2 | 1     | 13.7 / 50.6 / 434.4         | 13.9 / 50.8                           |
| Whole   | workflow ecs | control-2   | 0     | 19.2 / 102.5 / 744.5        | 19.4 / 102.7                          |
| Whole   | workflow ecs | control-2   | 1     | 11.1 / 61.9 / 467.3         | 11.8 / 62.0                           |
| Whole   | strokes core | control-1   | 0     | 5.7 / 42.9 / 135.0          | 5.7 / 42.9                            |
| Whole   | strokes core | control-1   | 1     | 3.3 / 13.0 / 52.9           | 3.3 / 13.0                            |
| Whole   | strokes ecs  | control-1   | 0     | 10.4 / 70.9 / 317.5         | 22.0 / 82.8                           |
| Whole   | strokes ecs  | control-1   | 1     | 11.1 / 48.6 / 202.0         | 18.6 / 54.8                           |
| Whole   | strokes core | candidate-1 | 0     | 5.4 / 57.2 / 169.8          | 5.4 / 57.3                            |
| Whole   | strokes core | candidate-1 | 1     | 4.4 / 16.6 / 62.4           | 4.4 / 16.6                            |
| Whole   | strokes ecs  | candidate-1 | 0     | 9.1 / 64.9 / 257.3          | 20.7 / 68.7                           |
| Whole   | strokes ecs  | candidate-1 | 1     | 7.7 / 35.2 / 158.3          | 20.1 / 50.5                           |
| Whole   | strokes core | candidate-2 | 0     | 4.2 / 58.8 / 155.3          | 4.2 / 58.8                            |
| Whole   | strokes core | candidate-2 | 1     | 3.2 / 12.3 / 50.7           | 3.2 / 12.3                            |
| Whole   | strokes ecs  | candidate-2 | 0     | 11.1 / 74.6 / 291.1         | 18.5 / 84.9                           |
| Whole   | strokes ecs  | candidate-2 | 1     | 11.3 / 54.2 / 212.7         | 20.2 / 58.1                           |
| Whole   | strokes core | control-2   | 0     | 4.5 / 47.0 / 140.5          | 4.5 / 47.0                            |
| Whole   | strokes core | control-2   | 1     | 3.4 / 14.9 / 61.8           | 3.4 / 14.9                            |
| Whole   | strokes ecs  | control-2   | 0     | 9.7 / 57.1 / 245.6          | 24.7 / 66.1                           |
| Whole   | strokes ecs  | control-2   | 1     | 11.5 / 32.3 / 164.1         | 20.8 / 45.9                           |

## Audit boundaries and actual work

The original comparison helpers are unchanged. Each ordinary capture is
self-qualified with its original helper; diagnostics are explicitly rejected
by those same helpers. A dedicated cross-source audit compares input payloads,
requested/reached cameras, complete visible membership, surface, document/theme/
version state, and clock arithmetic. Initial demo frame counters are excluded
as non-renderer invariants. Within each variant, native/resource/geometry-call
and existing phase-call counts must match its second capture exactly. Summary
work metrics group those equal repeat pairs; raw records retain every frame.

Cross-source native, resource and geometry-work differences are deliberately
recorded rather than required equal: changing page topology is the hypothesis.
No counter is replaced with a control value to pass a parity check. The full
per-frame work differences remain in the private raw audit. This is a different
comparison boundary from earlier no-GPU-work-change micro-experiments.

The whole-page revision preserves matching draw/index/array-vertex submissions
across sources. Workflow has 36–2,400 visible cards and 36–2,400 visible edges
(plus zero/one overlay), 3–22 native draws per frame and 159 draws per traversal.
Its tracked buffer bytes range from 94,772 to 3,170,524, with 177 creates and
177 deletes per traversal. Submitted indices range from 15,516 to 633,846 per
frame; they are not unique vertices. The first and warm rounds have different
precision history and must be compared to the matching round.

Paired Core/ECS see 0–2,400 paths, 0–10 stroke pages and 0–11 native draws per
frame in the revised cohort. Both submit 57 draws and 4,562,115 indices per
traversal. Detailed native totals/ranges, geometry-call counts and every cohort's
resources are preserved rather than collapsed into a single performance ratio.
The partial prototype also changes some Workflow index totals; those changes
are recorded, not silently equated with the control. Precision contexts follow
page ownership, so topology is not presumed neutral to precision history.
No raw allocation, retained heap or shader presentation metric was measured.

## Applicability probe

Two additional captures on the frozen whole-page source use
`mode: page-boundary-diagnostic`. The isolated Vite route inserts an observer
immediately after the existing `anchor` expression; it does not change that
expression, grouping decisions or returned values. Weak drawcall identities and
primitive counts record anchor-member hits and distinct page-steps. A source-hook
load count is asserted positive, including on zero-hit Workflow samples.

The original module body still contains an inactive optional observer call until
the page closes; this probe does not claim to restore pristine module descriptors.
Before renderer teardown, the recorder clears its weak identity state and set,
and deletes its global entry. No entity handles or GPU resources are retained
by the recorder. Ordinary and diagnostic native/resources/geometry-call counts
and semantic frame data match on each corresponding sample. Its elapsed timings
are excluded from all ordinary summaries, and the original ordinary qualifier's
rejection of its mode is tested explicitly.

## Retained regression coverage and verification

Sixteen new cases exercise actual planners/drawcall classes through a shared
Core/ECS stroke/image contract. They require compact pages after interleaved
order changes, compact sparse fragments, current eligibility after membership
changes, and empty-page retirement plus fresh ownership on reentry. Only the
GPU submission boundary is replaced in the Core unit harness. These contracts
pass on the unchanged control runtime; they do not assert a discarded cache API
or require page identity preservation. First-prototype expected-failure tests
use the same retained contract on its isolated renderer source plus a saved test
patch, and are explicitly non-qualifying diagnostic runs.

Passed on the retained control runtime: 108 Core and 173 ECS unit cases across
12 focused suites (281 total, including the sixteen new contract cases), 137
tooling cases on Node 24.22.3, Core/ECS typechecks, browser/paired-benchmark/
Workflow-benchmark typechecks, repository ESLint with zero warnings, and 54
Chromium plus 54 WebKit browser regressions. Coverage includes pixels, WebGL1,
full raster exports, interaction/history, culling/reentry, same-frame removal,
camera migration and resource ownership. The four deliberately failing partial-
prototype reorder checks are separate expected-failure diagnostics, not passes.

Both candidates passed focused stroke/image units and Core/ECS typechecks plus
changed-source lint before their ordinary cohorts were frozen. The revised
candidate's two Core and two ECS suites contain 67 and 61 cases respectively;
those experimental tests include a page-identity case removed with the runtime.
A pre-freeze partial-prototype Chromium smoke passed 54 cases; this is not a
claim of a complete fixed-commit browser qualification for either abandoned
prototype. The retained control runtime receives the full 108 browser checks.
An initial constructor comparison triggered three TypeScript `never` errors;
a constructor alias fixed the narrowing before freezing the partial source,
and the original error log is preserved. No ordinary sample was replaced.

Correctness uses Chromium 149.0.7827.55 and cached WebKit build 2388, while
timing uses the separate pinned Chromium 140 executable. WebKit skips only its
host-requirements preflight, with rendering/resource assertions active. Cached
dependency CLIs were used without a fresh pnpm 9.15.9 install. The restored local
Husky helper is absent; per-command hooksPath overrides follow explicit checks
without changing repository hooks. No local full site/package/packed-package
build, entire renderer suite, hardware GPU/WebGPU, heap profile or continuous-
presentation qualification was run.

The private archive includes the sixteen raw ordinary captures, two raw count
captures, their original source identities and hashes, both full audit outputs,
reproduction scripts, a thin Git bundle/patches for both rejected candidates,
the expected-failure test patch/logs, and retained verification logs. The bundle
requires public control commit `72c4f41`. `run-ab-partial.py` and `run-ab.py` give
the original sequential orders and workspace/pinned-browser paths; adapt paths
for a new host without changing source or workload. `audit-partial.mjs` and
`audit.mjs` define the exact semantic/work boundaries. Counter producers/configs
are isolated, explicitly marked, and restore/delete their recorder before
teardown. Repeat captures in new directories rather than overwriting these.
No browser screenshots or traces are delivered in this archive.

## Next implementation target

Whole-page retention does not address this Workflow trace. This does not rule
out every page size or spatial partition; it rules out crediting this specific
zero-hit strategy with the observed timing changes. The next work should measure
reusable geometry _inside_ changing pages before implementing another cache.

1. In a separate marked diagnostic, record actual sampled-point/segment identity,
   per-node geometry version, placement/order changes and bytes repacked on every
   changed page. Raw path text or unchanged style alone must not certify that
   sampled geometry stayed the same across precision/hysteresis changes.
2. If substantial geometry survives, prototype storage that keeps those windows
   resident and updates visibility/placement separately. Compare resident chunks
   plus a compact visible-index stream with simpler upload-span approaches.
   Do not trade upload reduction for one draw per node or drawing all hidden
   geometry. Inventory actual device capabilities before choosing representation;
   WebGL1 and unsupported devices need the existing complete renderer fallback.
3. Give Core and ECS the same ownership/format contracts. Validate primitive
   order and overlap, precision, hover/selection/editing, immutable original data,
   history/collaboration, full exports, culling reentry, migration, same-frame
   deletion, slot reuse and bounded resource retirement before qualifying timing.
4. Qualify fresh ordinary A/B on the real 2,400-card/2,400-edge example, add trusted
   continuous wheel/pan measurements, and report p50/p95 plus native work and
   memory costs. Hardware GPU/presentation remains a separate acceptance boundary.

This is a representation investigation, not a proposed public API or a promised
speedup. The 2,400-node smooth-interaction goal remains open. #741's merge had
successful automatic publish and production deployment; this follow-up stays
draft and does not manually deploy either prototype.
