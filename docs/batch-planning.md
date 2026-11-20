# Resolving batch compatibility once

The paint-page reuse in #692 removes repeated glyph construction, while edit
frames still pay for compatibility planning and layout validation. This follow-up
evaluates **Core and ECS together** and keeps the switches off by default.

A diagnostic on 1,000 actually visible objects, including 200 full text labels,
observed the following across three paint-edit frames:

| Backend | Text-key checks before | Text-key checks after | Layout checks before / after | Text builds before / after |
| ------- | ---------------------: | --------------------: | ---------------------------: | -------------------------: |
| Core    |                  3,000 |                   600 |                    204 / 204 |                      5 / 5 |
| ECS     |                  1,200 |                   600 |                    600 / 600 |                      5 / 5 |

The diagnostic wrapped the real methods in the browser. Its baseline runtime was
`9e3fef16b8cc619deedb951e7d10591cee05cf5a`, with counter-only fixture changes;
the after run used this implementation with the same scene and counters.
The five builds occur during the first paint split. Each later edit frame resolves
200 text keys, one per text. Layout validation still runs where dirty markers
require it.

## Changes

ECS now returns the chosen constructors together with their already-computed
compatibility key. The plan consumes that result directly. Eligible text and Path
keys are not calculated again, and no material key survives into another plan.
Style, ancestor, intent and runtime-switch changes therefore use fresh eligibility.

Core dispatches ordinary Text and Path constructor kinds to their specialized
checks, avoiding text qualification calls for unrelated primitives. The existing
checks still decide eligibility and safe fallback.

Both TextBatch implementations capture layout values after a successful geometry
build and compare those values directly instead of JSON-serializing them on dirty
frames. The snapshot owns nested arrays and metric objects. In-place metric edits,
new array lines, membership, depth, transform, content and font-state changes still
invalidate geometry. Objects are compared by their enumerable data, without
relying on derived-object reference equality or property insertion order.
Failed builds retain the retry requirement. Painter barriers, resource retirement,
exports, interaction geometry and document/history data retain their existing paths.

## Reproduce

`pnpm bench:text-batching` runs the qualified grouped 1,000-visible-object workload
with 30 samples after 15 warmup frames. The real browser fixture records text key,
layout, geometry and atlas work, native submissions/uploads, CPU samples and
resource ownership. The paired browser tests assert one text key per label per
edit frame and no compatibility work on camera-only frames. Measurements compare
each backend within its existing Core.render or ECS world.execute boundary.

The diagnostic reduces operation counts; CPU improvement is measured separately.
Software WebGL timing and separate cohorts do not establish a general FPS ratio.

## Recorded cohort

The clean measured source is local commit `00c88056da73c1294ec5a5238eddab3078395f21`,
identical to published commit
[`115bece`](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/115becec6951e7d1b2743abbc33cd004fcfa69f8)
(tree `f0f370591f20543ce83951e71281c87f85b86d99`). The
[raw data](./batch-planning-benchmark.json) preserves both complete runs, every
CPU/native sample, resources and the before/after diagnostic.

The primary run below had no concurrent local publication preparation or tests.
The first run overlapped Git-tree payload preparation and is kept as an additional
cohort, rather than used for the primary timing result. This is a software WebGL
observation, not a controlled cross-commit speedup.

| Backend / switch | Pan CPU p50 / p95 ms | Edit CPU p50 / p95 ms | Edit calls | Edit upload bytes/frame |
| ---------------- | -------------------: | --------------------: | ---------: | ----------------------: |
| core / off       |           6.2 / 11.2 |            7.8 / 12.6 |        603 |                   61744 |
| core / on        |           6.6 / 10.4 |            7.0 / 13.1 |        407 |                   61744 |
| ecs / off        |          15.1 / 33.1 |           32.7 / 42.6 |        602 |                   69496 |
| ecs / on         |          15.4 / 20.2 |           34.5 / 77.0 |        407 |                   68296 |

Every sampled frame has 1,000 actually visible objects, including 200 full texts,
395,280 submitted indices and four array vertices. Enabled camera frames retain
403 calls; editing retains 407. Camera-only frames perform no text compatibility
checks and upload only the 192-byte scene uniform. The 45 paint frames perform
9,000 text compatibility checks in each backend, exactly one per label per frame.
All four modes pass teardown checks, and enabled text geometry construction stays
at one initial build plus five during the first split.

Core performs 288 layout validations across the edit phase, including the first
split's 200 snapshot captures; ECS performs 9,000. These checks remain for correct
invalidation. The snapshots now compare values without serializing them.

The #692 cohort recorded enabled edit p50/p95 of 8.6/18.8 ms in Core and
45.1/67.1 ms in ECS. The current medians are lower, but the cohorts are independent.
Current Core edit p95 is slightly above its disabled control. Current ECS enabled
edit p95 is 77.0 ms versus 42.6 ms disabled, and is higher than the previous cohort.
The work reduction therefore does **not** establish that edit latency is solved;
ECS tail latency remains a profiling target. Both switches stay off by default.

Timing uses the existing harness: Core starts before the operation mutation and
then renders; ECS brackets the complete world.execute, including queued actions
and other systems. Compare within a backend, preserving these boundaries.

## Validation

-   Core: 51 targeted tests across five suites passed.
-   ECS: 116 targeted tests across six suites passed.
-   ECS BatchManager coverage: statements 99.37%, branches 96.59%, functions 100%,
    lines 99.66%, above unchanged thresholds.
-   Chromium and WebKit each passed 36 browser cases, including text/Path pixels,
    interaction geometry, camera migration, export, resource retirement and the
    new one-key-per-label checks.
-   Browser/Core/ECS TypeScript and changed-file ESLint passed; normal commit and
    Markdown hooks passed.
-   Both complete four-mode benchmark runs passed invariant/counter/teardown checks.
-   Full headless-gl SSR was not run locally because this Node 24 dependency cache
    lacks the optional native gl binding; repository CI remains a separate check.
