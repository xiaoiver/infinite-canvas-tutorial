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
