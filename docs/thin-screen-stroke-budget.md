# Thin screen stroke error budget

Follows #750, merged as `94161a135dcaac07ff6f21f584c91a3fcebffc45`. The real
Workflow explicitly enables `pathInstancing`; both packages still default it to
false. This change is shared by Core and ECS screen `StrokeBatch` pages. It does
not enable the separate Polyline LOD feature or add a public switch.

## Why these segments can be removed

Adaptive curves already reserve 0.125 physical px for the centerline and 0.125 px
for stroke joins/endpoints. They additionally impose a fixed 0.25-radian tangent
ceiling. For a sufficiently thin stroke that ceiling is stricter than the
existing error formula requires, even when the curve occupies only a few pixels.

Only single, open Bézier paths with a bucketed radius at most 0.5 physical px
and control points monotone along at least one nonconstant axis use the full
join bound `r * (sec(theta) - 1) <= 0.125`. The existing control-polygon flatness,
endpoint tangent test, exact command endpoints, Float32 seam handling and finite
subdivision budgets remain in force. The monotone control axis proves the interior derivative never vanishes or
reverses on that axis. The derived angle stays below pi/2; tangent cones cannot
silently accept a reversal. For smooth neighboring segments, their
half-angle is bounded by the same cone angle. Miter extension and bevel sag stay
inside the reserved join budget. Authored joins can amplify an endpoint-angle change, so compound, closed,
multipart and unproved curves (including loops/reversals/arcs) retain exactly
the original sampling. Pathological precision still has the existing work cap;
exhausting it is not an unconditional accuracy guarantee for arbitrary coordinates.

Thicker strokes keep the original angular ceiling. DPR participates through the
actual render-pass metrics, rather than a CSS-size heuristic. Cache forks carry
their owning policy and independent hysteresis. The existing four-level pool,
weak device/shape/point ownership and edit invalidation stay unchanged. There is
no extra GPU object, document field, history entry or collaboration payload.

## Full geometry and compatibility

Default individual drawcalls and independent full/export drawcalls construct
`PathGeometryCache()` with the original policy. Only opt-in screen StrokeBatch
constructs its own `PathGeometryCache(true)`. Source Path points, bounds, picking,
selection, editing and snapping therefore retain their original geometry.
Complete raster exports remain byte-identical with batching enabled/disabled.
Fills, dashed/effect/unsupported shapes follow the existing full fallback.
Turning batching off or crossing to a thick precision level cannot reuse a thin
screen level from a full context. Culling, page retirement and camera reentry
retain their original ownership rules.

Both backends run shared tests for low/high precision, independent full/device
contexts, retirement, edits, original corners and immutable retained samples.
Dense analytic tests cover cubic inflections/loops/reversals, quadratics and
ellipses, centerline error, endpoint normals and smooth miter extension.
Browser tests compare all nine cap/join combinations against the original full
renderer in WebGL1 and WebGL2, require real nonblank pixels, bounded edge coverage,
complete exports, culling/reentry and strict GPU teardown. WebGL1's ANGLE extension
bypasses this fixture's WebGL2 index counter: its pixel/export/resource assertions
still run; no zero counter is claimed as a geometry reduction.

## Qualified workload and source

The measured local implementation is `d5ba021cfb140ba288b0a99c9ca306cc00872e31`,
clean tree `cec893c20dda2ea4e30b8a681e35f3ac611d7b18`. Public implementation/test
head [baaa7c1](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/baaa7c1f10661f78c075b07defebbaba7de39b92)
has that exact tree. This report changes no measured runtime code.

Eight fresh captures ran serially without overlapping local tests/profilers.
Group 1: base Core/ECS replay, candidate Core/ECS replay, base Workflow input,
candidate Workflow input. Group 2 reverses candidate/base within both workloads.
Node 24.22.3, Playwright 1.61.1, Chromium 140.0.7339.186, ANGLE/SwiftShader, DPR 1.
Workflow viewport 1500 x 980; CSS/backbuffer 1148 x 914. This is software WebGL,
not hardware-GPU, native WebGPU or physical-display acceptance.

Each group has 48 paired Core/ECS camera targets and 40 actual Workflow trusted
wheel targets, first/warm rounds separate. All **176 before/after frame pairs**
qualify. Paired replay uses its original qualifier. Each input capture also passes
the complete original input self-qualifier; the cross-source audit then requires
identical inputs/anchors, requested/derived camera, UI view, surface, visible
identities, document versions and live resource maps. Native counters and logical
allocated buffer bytes are audited as changed quantities, rather than passed
through the original unchanged-native-work comparator. No missing data is zeroed.

Each real Workflow capture still has 2,400 cards and 2,400 edges. The fixed input
trace sees 36-2,400 cards and 36-2,400 edges; paired strokes see 0-2,400 during
explicit culling/reentry. Source cleanliness, original document equality, GPU
errors, pending requests on disposal and strict resource teardown remain gates.

## Geometry, upload and resource results

The two groups produce identical native totals; below are per traversal, not
pooled frame averages. Drawcalls and array vertices stay equal in every matched
frame. All live GPU-object counts also match.

| Workload / traversal | Submitted indices, base -> candidate | Draws | Buffer upload bytes, base -> candidate |
| --- | --- | --- | --- |
| Core / each round | 4,562,115 -> 2,719,905 | 57 -> 57 | 15,208,704 -> 9,614,208 |
| ECS / each round | 4,562,115 -> 2,719,905 | 57 -> 57 | 17,108,488 -> 10,814,680 |
| Workflow / first | 4,194,504 -> 2,994,834 | 159 -> 159 | 21,113,128 -> 15,354,712 |
| Workflow / warm | 4,201,764 -> 3,012,474 | 159 -> 159 | 21,147,976 -> 15,439,384 |

Paired stroke indices fall 40.4%; Workflow indices fall 28.6% first / 28.3% warm.
Workflow peak logical allocated buffer bytes fall **3,322,588 -> 2,417,116**
(27.3%). These are tracked logical backing allocations, not total native GPU
memory. The maximum per-frame index count falls 633,846 -> 399,240, while draws
remain 3-22 per frame and array vertices remain 4. No additional culling, lower
canvas resolution, hidden canvas or changed graph is used to produce the drop.

## Timing observations

Nearest-rank p50 / p95 milliseconds. Core's boundary is synchronous camera plus
render; ECS/Workflow records complete `world.execute` wall time. These are not
CPU-utilization or GPU-execution measurements. Each paired row has 12 targets;
each Workflow row has 20. First/warm refers to initialized traversals, not startup.

| Group | Backend | Round (0 first, 1 warm) | Base engine wall p50 / p95 | Candidate engine wall p50 / p95 |
| --- | --- | --- | --- | --- |
| g1 | core | 0 | 4.9 / 98.8 | 5.2 / 37.1 |
| g1 | core | 1 | 3.7 / 15.0 | 2.8 / 9.4 |
| g1 | ecs | 0 | 10.4 / 58.4 | 14.0 / 90.0 |
| g1 | ecs | 1 | 13.5 / 36.5 | 9.9 / 52.3 |
| g1 | workflow | 0 | 18.2 / 60.9 | 14.8 / 85.7 |
| g1 | workflow | 1 | 13.9 / 75.8 | 13.2 / 45.9 |
| g2 | core | 0 | 3.5 / 40.7 | 6.2 / 63.1 |
| g2 | core | 1 | 3.9 / 21.5 | 3.4 / 13.1 |
| g2 | ecs | 0 | 9.5 / 67.3 | 18.2 / 56.2 |
| g2 | ecs | 1 | 9.7 / 47.6 | 11.8 / 38.7 |
| g2 | workflow | 0 | 14.6 / 82.7 | 15.8 / 88.9 |
| g2 | workflow | 1 | 15.3 / 61.3 | 11.7 / 53.0 |

Workflow DOM-receipt-to-engine-completion p50/p95, separately from physical presentation and host delivery:

- g1, round 0: 18.4/67.9 -> 15.0/85.9 ms.
- g1, round 1: 14.1/76.1 -> 15.0/46.0 ms.
- g2, round 0: 15.1/83.0 -> 16.0/89.1 ms.
- g2, round 1: 15.5/61.9 -> 11.9/53.3 ms.

The final narrowed source does **not** show a uniform latency improvement. Both
Workflow first-traversal p95 samples increase (60.9 -> 85.7 and 82.7 -> 88.9 ms),
while both warm p95 samples decrease (75.8 -> 45.9 and 61.3 -> 53.0 ms). Core
and ECS also have mixed medians/tails, including the adverse ECS group 1 and Core
group 2 first results in the complete table. These are two ordered samples, not
a statistical speedup. Do not substitute the earlier broader prototype's more
favorable timing observations. The repeatable result is reduced geometry,
uploads and tracked buffer allocations. Every fixed native counter for the
narrowed candidate matches its broader prototype counterpart on this qualified
ordinary workload, but these final timings were captured afresh.

## Continuous input: smoothness target remains open

Four further fresh serial captures on the same final measured tree use the
original continuous-wheel protocol: 40 trusted host commands at 16 ms cadence per
gesture, without waiting for an engine frame per input. The second group reverses
base/candidate order. First/warm in/out stay separate. All captures pass original
trusted-delta, camera-prefix, final-target, document and teardown qualifiers.

640 host commands become 352 received DOM events, 306 engine executions
and 292 rendered frames. Receipt spans range 1.14-7.21 seconds for a nominal
624 ms issuance span. Different coalesced prefixes mean these are not fixed-native-
work pairs and support no speedup ratio.

Completed rendered-frame interval p95 milliseconds (engine completions, not
physical display presentation):

| Group | Base first in / out | Candidate first in / out | Base warm in / out | Candidate warm in / out |
| --- | --- | --- | --- | --- |
| g1 | 1158.3 / 217.4 | 994.4 / 170.9 | 792.2 / 130.5 | 775.2 / 161.7 |
| g2 | 1500.3 / 253.1 | 1061.5 / 320.1 | 769.3 / 490.2 | 903.1 / 289.5 |

Long intervals remain and several candidate samples regress. The **2,400-node
smooth-interaction target is not achieved in this software renderer**. Engine
wall time, GPU execution and physical presentation are different boundaries;
further diagnosis must isolate delays outside World execution and qualify the
actual hardware path. No GPU execution timer or native hardware acceptance ran.

## Validation and reproduction

151 relevant unit cases (both backends/shared path math/cache/ownership), 198
tooling cases, Core/ECS build typechecks plus browser/paired/Workflow benchmark
typechecks pass. Chromium 149 and WebKit 2388 each pass the 16 original stroke
cases and four new thin WebGL1/2 cases across runs. WebKit's OS-library preflight
alone was skipped locally; assertions and timeouts are unchanged. Full CI is
recorded on the draft PR.

An earlier broader prototype was narrowed during review because authored joins
can amplify endpoint-angle changes. Its source, 34 successful CI checks and raw
captures remain separately labelled prototype evidence and are never pooled with
the final narrowed results. Superseded local attempts are retained too. New tests initially
read an idle frame and accumulated ECS counters, then used a curve scale at which
centerline error rather than the angular ceiling dominated. The final physical
cohort holds shape/stroke dimensions fixed across DPR and explicitly resets and
captures completed redraws. ANGLE's missing instanced index observation is labelled
instead of used as a reduction. One typecheck invocation named a nonexistent
benchmark config; the actual paired/Workflow projects subsequently pass. The added tiny-compound-path test initially reused a minimum-ink count for a
larger scene; its final comparison requires nonblank output and <=3 difference
in every RGBA channel without changing the original helper. No timeout, existing
assertion or dependency warning was disabled.

```sh
# Two clean worktrees, same pinned browser; run each capture serially, then
# repeat in reverse order. Do not enable other diagnostic modes.
WORKFLOW_CHROMIUM=/path/to/chromium CAMERA_REPLAY_OUTPUT_DIR=/tmp/base-paired pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
WORKFLOW_CHROMIUM=/path/to/chromium CAMERA_REPLAY_OUTPUT_DIR=/tmp/candidate-paired pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
node scripts/compare-camera-replay.mjs /tmp/base-paired/camera-replay-strokes.json /tmp/candidate-paired/camera-replay-strokes.json
WORKFLOW_CHROMIUM=/path/to/chromium WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/tmp/workflow pnpm bench:workflow-input
pnpm test:browser stroke-batching.spec.ts
pnpm test:browser:webkit stroke-batching.spec.ts
```

The private review archive retains source bundle/patch, all eight final fixed captures and four final continuous captures, plus
separately labelled prototype captures,
full native counter distributions, cross-source qualification code, reproduction
runner and verification logs. It excludes browser screenshots/traces, installed
dependencies and build outputs. Ordinary input comparison intentionally requires
all native counters to match; it is not the geometry-change audit used above.
