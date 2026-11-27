# Surviving batch-member classification: rejected cache experiment

Dirty membership plans reclassify surviving members. This follow-up to #740
counted that work, then tested a limited ECS stroke-classification cache.
**The cache is rejected: ordinary interaction timing does not improve reliably,
and source review identified invalidation boundaries requiring more work.**
Only Core/ECS mutable-input regression tests and this report/data are retained.
Both packages' production source, defaults, dependencies and exports are unchanged;
no changeset is needed.

## Measured work and attempted change

A separate count-only diagnostic observes the dirty planner's original methods.
Workflow performs 30,211 raw classifications per 20-input traversal: 14,992
StrokeBatch, 15,218 ImageBatch and one SDF. Of those, 25,482 repeat a previous
constructor/key result without explicit add/reassignment or a sampled dirty tag.
The stroke subset is 12,628 repeated results, with 2,364 first results since
removal/reset. These are observations within this fixed workload, not proof
that arbitrary mutable inputs are unchanged. A first result includes reentry;
it is not a count of unique document nodes.

The candidate caches only successful single-StrokeBatch screen classifications.
It attempts to certify unchanged inputs using MeshPipeline component-change
queries. Explicit add/remove, feature transitions, failed plans and clear reset
entries. Stored ownership uses a held entity, public ordinal and `isSame`, not
Becsy private identifiers; no geometry, page or GPU buffer is cached. Geometry
preparation continues live, and isolated export managers do not opt in.

The diagnostic confirms raw stroke resolutions fall from 14,992 to 2,364 per
Workflow traversal, and from 8,396 to 4,816 on paired ECS strokes. Workflow image
resolutions remain 15,218. Core production code is identical in both sources;
its existing full-plan reuse already handles unchanged visible membership.
Paired Core observes 8,396 first-per-member stroke-key checks per traversal,
including 3,580 repeated results. The Core dirty flags were sampled _after_ its
lazy predicate; they do not certify that a check could safely be skipped.
ECS's ordinary StrokeBatch classification reads inputs without those Core lazy
geometry side effects. No allocation/retained-heap saving was measured.

Count hooks restore original descriptors before renderer/probe teardown and
verify that no owned method wrapper survives. They retain primitive IDs and
key/constructor strings, clear state on removal/reset and dispose, and reject
duplicate ordinals within an ECS plan. Query memberships overlap: they are
labels on an add call, not exclusive causal attribution. Diagnostic captures
keep `mode: batch-replan-diagnostic` and are excluded from ordinary timing.
Stable frame data, native work, geometry-call counts and resources match their
corresponding ordinary sources. All raw records and hook sources are archived.

## Why the cache is not retained

Workflow warm engine totals are 483.4/520.3 ms for the candidates versus
488.8/443.5 ms for controls. Warm p95 is 63.4/64.1 versus 73.3/45.6 ms; the
control variation straddles the candidate, and candidate-2 has a worse warm total
than either control. Paired ECS warm totals are 206.1/274.7 versus 197.3/224.6 ms;
p95 is 48.8/73.2 versus 46.0/65.9 ms. Reducing classification calls has not
established smoother interaction. No significance or causal JIT/GC conclusion
is drawn from this small software-rendering cohort.

Source review also found that a frame-wide unchanged proof must survive frames
that do not draw. The candidate calls its certification method in `renderCamera`,
so an eligibility event consumed in an undrawn frame could be forgotten before
later camera work. Newly observed UI changes, for example, are not themselves
an existing redraw trigger. This path was identified by inspection, not claimed
as an end-to-end reproduced failure. Nested paint arrays and Core's raw color
objects also remain mutable: a component-write proof alone is not a general
input version. The retained tests explicitly edit a surviving member's raw
paint/color, change visible membership, and require the current plan to split
and later reunite the two material pages. These tests pass on the control runtime.

The experimental cache's unit ownership/eviction/failure tests are preserved
with its bundle, not retained as tests of an API removed from this PR.
The candidate was not advanced into production or presented as correct for all
editing/idle/export cases. Fixing its cache protocol would require a new clean
qualification cohort; these negative results do not justify that complexity.

## Sources and ordinary protocol

| Source             | Commit                                     | Tree                                       |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| Control            | `c365717f3fd694b1d6f362ba8ab950a5f4ed9cd6` | `cf2813093e1d38456d1b7d385289ff7a0aa6be84` |
| Rejected candidate | `2d8720a82e13e3567681a847f3b7021d7d9c829f` | `d5932f0fe4f60cf787f5e977c94ad8cd11f8e0d6` |

Eight sequential fresh-page ordinary captures: control-1, candidate-1,
candidate-2, control-2 for each workload. All worktrees were clean; no local
checks, extra method diagnostics, CDP sampling or timelines overlapped these
captures. No ordinary run was discarded or replaced. The paired producer keeps
its existing lightweight plan scope. Node 24.22.3, Chromium 140.0.7339.186,
headless SwiftShader, DPR 1. Workflow has 2,400 cards and 2,400 edges and 20
trusted wheel inputs per round; paired strokes have 2,400 paths and 12 poses.
First (0) and warm (1) traversals stay separate. Two preliminary ordinary
baseline captures only anchor diagnostic parity and are excluded from this
A/B timing cohort; their complete records are also preserved.

Engine and completion durations are wall time, not process CPU counters, GPU
completion or presented FPS. Core's synchronous and ECS's awaited root clocks
are different boundaries and must not be compared as identical CPU measures.
Nearest-rank p95 is the maximum for the 12-pose paired workload.

| Workload     | Run         | Round | Engine p50 / p95 / total ms | Input/operation-to-frame p50 / p95 ms |
| ------------ | ----------- | ----- | --------------------------- | ------------------------------------- |
| workflow ecs | control-1   | 0     | 17.3 / 87.2 / 729.6         | 18.1 / 87.4                           |
| workflow ecs | control-1   | 1     | 14.4 / 73.3 / 488.8         | 14.6 / 73.6                           |
| workflow ecs | candidate-1 | 0     | 15.5 / 68.2 / 566.0         | 15.6 / 69.7                           |
| workflow ecs | candidate-1 | 1     | 14.9 / 63.4 / 483.4         | 15.1 / 63.6                           |
| workflow ecs | candidate-2 | 0     | 15.5 / 76.2 / 683.2         | 16.0 / 76.4                           |
| workflow ecs | candidate-2 | 1     | 16.9 / 64.1 / 520.3         | 17.5 / 64.3                           |
| workflow ecs | control-2   | 0     | 14.6 / 71.7 / 672.5         | 14.8 / 71.9                           |
| workflow ecs | control-2   | 1     | 14.6 / 45.6 / 443.5         | 15.0 / 45.7                           |
| strokes core | control-1   | 0     | 3.9 / 52.1 / 128.5          | 3.9 / 52.2                            |
| strokes core | control-1   | 1     | 3.9 / 11.8 / 55.7           | 3.9 / 11.8                            |
| strokes ecs  | control-1   | 0     | 11.4 / 121.2 / 405.9        | 17.8 / 133.0                          |
| strokes ecs  | control-1   | 1     | 13.2 / 46.0 / 197.3         | 17.0 / 61.2                           |
| strokes core | candidate-1 | 0     | 6.7 / 70.1 / 206.5          | 6.7 / 70.1                            |
| strokes core | candidate-1 | 1     | 3.9 / 22.5 / 75.4           | 3.9 / 22.5                            |
| strokes ecs  | candidate-1 | 0     | 8.2 / 55.8 / 236.6          | 19.8 / 60.3                           |
| strokes ecs  | candidate-1 | 1     | 10.7 / 48.8 / 206.1         | 18.5 / 64.2                           |
| strokes core | candidate-2 | 0     | 4.7 / 48.1 / 149.5          | 4.7 / 48.1                            |
| strokes core | candidate-2 | 1     | 5.3 / 21.9 / 76.5           | 5.3 / 21.9                            |
| strokes ecs  | candidate-2 | 0     | 9.2 / 82.0 / 289.0          | 19.9 / 86.3                           |
| strokes ecs  | candidate-2 | 1     | 13.0 / 73.2 / 274.7         | 18.8 / 80.7                           |
| strokes core | control-2   | 0     | 5.6 / 56.1 / 161.8          | 5.6 / 56.1                            |
| strokes core | control-2   | 1     | 4.2 / 16.0 / 69.4           | 4.2 / 16.0                            |
| strokes ecs  | control-2   | 0     | 11.9 / 64.7 / 297.5         | 24.8 / 66.5                           |
| strokes ecs  | control-2   | 1     | 12.3 / 65.9 / 224.6         | 17.7 / 76.6                           |

Strict comparison checks every ordinary frame's requested/reached view, trusted
input payload, surface, complete visible ID set, native submission counters,
resource tables, geometry-call counts and existing phase call counts. It also
checks initial document/theme/version state and each sample's engine/observation
clock arithmetic. Absolute timestamps and elapsed timings are compared as
measurements, not required equal. Initial demo frame counters and diagnostic
count payloads are not renderer invariants. No native/resource field or mode
marker was silently normalized away. Corresponding ordinary and count-only
diagnostics pass the same stable-data comparisons; source identities match.

## Native work and ownership

Workflow has 36–2,400 visible cards and 36–2,400 visible edges along the fixed
trace (plus zero/one overlay). Native work is 3–22 draws, 15,516–633,846 submitted
indices and four array vertices per completed frame. Each traversal has 159
draws, 177 buffer creates and 177 deletes. Tracked allocated buffer bytes range
from 94,772 to 3,170,524. These counters include final passes; index submissions
are not unique vertices. First/warm geometry precision differs in some frames;
comparison uses the matching round rather than requiring first and warm equal.

Paired Core/ECS have 0–2,400 visible paths, 0–10 stroke pages and 0–11 native
draws per frame. Both submit 57 draws and 4,562,115 indices per traversal, with
95 buffer creates/deletes and 48 precision plus 38 segment-geometry calls.
Core/ECS upload boundaries differ: 125 versus 116 buffer uploads per traversal.
Every matching native/resource field equals its control across all four runs.
Document equality and teardown/resource ownership assertions pass in all eight
ordinary captures and the four qualified count-only captures. This experiment
does not reduce GPU work or prove the 2,400-node smooth-interaction goal.

## Verification and reproduction

The private archive includes all raw captures, source identities, rejected
candidate patch and thin Git bundle, cloned count-only producers, probe,
sequential runner, strict audit and logs. The bundle requires the public control
commit. Reproduce ordinary captures with `playwright.workflow-input-bench.config.ts`
and `playwright.camera-replay-bench.config.ts`, `WORKFLOW_INPUT_COUNT=2400`, the
pinned `WORKFLOW_CHROMIUM`, and `WORKFLOW_INPUT_OUTPUT_DIR` /
`CAMERA_REPLAY_OUTPUT_DIR`; leave CAMERA_PHASES and CAMERA_TIMELINE variables
unset. The archive's `run-ab.py` gives the exact sequential order, and
`audit.py` gives the excluded timing fields and invariant checks. The separate
member configs/producers install and restore the count hook. Move outputs to
new directories on repetition; do not replace this cohort.

Before freezing the candidate, initial setup failures included a formatter path
that assumed the
wrong cached Prettier layout; the first Core unit added a DOM canvas dependency
before its DOMAdapter mock existed; the first candidate typecheck lacked a
Stroke import. These were fixed before freezing the candidate. A 24-node
counter smoke initially reset on every flag setter call; it was corrected to
reset only effective transitions. The first paired counter setup assumed a
Core method named beginFrame rather than clear and failed before capture.
Its failed output remains separate; corrected paired diagnostic and ordinary
baseline captures are retained. Some early formatter/type/unit setup logs were
overwritten by later verification; they are not represented as fully archived
failures. None of these setup fixes replaced an ordinary A/B run.

Passed on the retained review: 100 Core and 165 ECS unit cases (12 focused
suites), 137 tooling cases on the previously checksum-verified cached Node
20.20.2, Core/ECS typechecks, browser/paired-benchmark/Workflow-benchmark
typechecks, repository ESLint with zero warnings, and 54 Chromium plus 54
WebKit browser cases. The two new mutable-input cases are included in those
265 unit cases, not additional cases. Browser regressions exercise the retained
control runtime: pixels, WebGL1 limits, full exports, interaction/history,
culling/reentry, same-frame removal, camera migration and resource retirement.
Candidate-only checks passed 127 ECS cases across four focused suites, 34 Core
stroke cases, ECS typecheck and focused changed-source lint before its commit.
Its broader browser suite was not run; ordinary ownership parity does not prove
all abandoned cache transitions correct.

Correctness used Chromium 149.0.7827.55 and cached WebKit build 2388; timing
used the separate pinned Chromium 140 executable. WebKit skipped only the host
requirements preflight, leaving rendering/resource assertions active. Cached
dependency CLIs on Node 24.22.3 were used directly rather than a fresh pnpm
9.15.9 install. The local Husky helper is absent, so local commits use a
per-command hooksPath override after explicit checks without changing hooks.
No local full site/package build, entire renderer suite, hardware GPU/WebGPU,
allocation/heap profile or continuous-presentation measurement was run.

The merge of #740 (`c365717`) had successful automatic publish and Vercel
production deployment workflows. This review does not manually deploy or merge
its follow-up draft.

## Next structural investigation

Do not layer more cross-frame eligibility caches onto these results. Measure
how much dirty-plan time is spent rebuilding ordered page membership/pools and
preparing native uploads when only a culling boundary changes. A candidate should
reduce work for those membership deltas while still rereading mutable material
inputs whenever a plan changes. Validate retained page ownership and painter
order before measuring both backends on the same traces. Stable p95 and total
work improvement on the real 2,400-card Workflow remains the acceptance target;
continuous wheel/pan and hardware GPU presentation still require measurement.
