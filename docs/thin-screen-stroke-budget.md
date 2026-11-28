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

Only screen pages with a bucketed radius at most 0.5 physical px now use the full
join bound `r * (sec(theta) - 1) <= 0.125`. The existing control-polygon flatness,
endpoint tangent test, exact command endpoints, Float32 seam handling and finite
subdivision budgets remain in force. The derived angle stays below pi/2; tangent
cones cannot silently accept a reversal. For smooth neighboring segments, their
half-angle is bounded by the same cone angle. Miter extension and bevel sag stay
inside the reserved join budget. Authored command corners retain their original
vertices and join/cap styles. Loops, cusps and pathological precision retain the
existing bounded-work behavior; exhausting that budget is not an unconditional
accuracy guarantee for arbitrary coordinates.

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

The measured local implementation is `e6f0baee06400ee4edaba156d1129c79e162be5f`,
clean tree `2da8a8d167d42e719d64b07649285789ed4bb2ba`. Public implementation/test
head [b451804](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/b451804d3041b5519bc4d0262273d3bd4adcaf3f)
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
| g1 | core | 0 | 4.3 / 62.1 | 3.9 / 29.2 |
| g1 | core | 1 | 2.8 / 10.0 | 2.7 / 8.6 |
| g1 | ecs | 0 | 9.6 / 69.7 | 10.1 / 51.2 |
| g1 | ecs | 1 | 11.6 / 63.4 | 11.6 / 51.9 |
| g1 | workflow | 0 | 12.9 / 79.7 | 15.2 / 63.8 |
| g1 | workflow | 1 | 11.8 / 68.8 | 12.9 / 46.5 |
| g2 | core | 0 | 3.8 / 42.0 | 6.0 / 42.1 |
| g2 | core | 1 | 3.7 / 14.3 | 3.1 / 12.5 |
| g2 | ecs | 0 | 9.9 / 72.3 | 8.9 / 46.2 |
| g2 | ecs | 1 | 10.3 / 49.8 | 12.7 / 38.4 |
| g2 | workflow | 0 | 13.5 / 65.9 | 13.3 / 54.2 |
| g2 | workflow | 1 | 20.9 / 59.8 | 13.8 / 48.1 |

Workflow DOM-receipt-to-engine-completion p50/p95 is 13.1/81.1 -> 15.5/64.0
(first) and 11.9/69.0 -> 13.4/46.8 (warm) in group 1; group 2 is 13.7/66.1 ->
13.4/54.4 and 23.0/59.9 -> 14.0/49.6. This excludes host delivery and physical
presentation. It is one trusted event per completed target, not a continuously
issued gesture.

All four Workflow p95 samples are lower, but median results are mixed: group 1's
first/warm medians increase. Core group 2's first p95 is essentially unchanged
and its median increases; ECS group 2 warm median also increases. Two ordered
groups do not establish a statistical speedup or sustained 60 FPS. Geometry and
upload reduction are the repeatable result; the **2,400-node smooth-interaction
target remains open**. Continuous gesture, hardware GPU and physical presentation
must be requalified before claiming the target is met. Pixel/shading execution
cost was not measured independently.

## Validation and reproduction

139 relevant unit cases (both backends/shared path math/cache/ownership), 198
tooling cases, Core/ECS build typechecks plus browser/paired/Workflow benchmark
typechecks pass. Chromium 149 and WebKit 2388 each pass the 16 original stroke
cases and four new thin WebGL1/2 cases across runs. WebKit's OS-library preflight
alone was skipped locally; assertions and timeouts are unchanged. Full CI is
recorded on the draft PR.

Superseded local attempts are retained with the raw evidence. New tests initially
read an idle frame and accumulated ECS counters, then used a curve scale at which
centerline error rather than the angular ceiling dominated. The final physical
cohort holds shape/stroke dimensions fixed across DPR and explicitly resets and
captures completed redraws. ANGLE's missing instanced index observation is labelled
instead of used as a reduction. One typecheck invocation named a nonexistent
benchmark config; the actual paired/Workflow projects subsequently pass. No
renderer change was needed for these test/invocation corrections.

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

The private review archive retains source bundle/patch, all eight raw captures,
full native counter distributions, cross-source qualification code, reproduction
runner and verification logs. It excludes browser screenshots/traces, installed
dependencies and build outputs. Ordinary input comparison intentionally requires
all native counters to match; it is not the geometry-change audit used above.
