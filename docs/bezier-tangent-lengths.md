# Reuse Bezier tangent lengths during render subdivision

Core and ECS use the same adaptive cubic/quadratic subdivision. Once a control
polygon is flat enough, thick strokes compare every nonzero control edge with
every other edge, and boundary tangents with the chord. Previously each angle
comparison recomputed both vector lengths. Each derived tangent now carries its
length for reuse within that one subdivision span. The chord length is computed
only when an endpoint comparison is required.

The dot product, clamping, `acos`, comparison order (including self comparisons),
centerline tolerance, turn/end limits, depth/segment budgets and de Casteljau
splits retain the original arithmetic. This avoids changing floating-point
threshold decisions. Zero control edges remain filtered out. All derived vectors
are local; authored control points, curves and output vertices are not mutated
or retained in a new cache. Arcs and straight SVG commands keep their paths.

The same utility serves full and batched rendering and export in each backend.
No new switch, dependency or changed default. Picking, bounds, curve length/text
layout, document/history data, culling and GPU ownership retain their existing
paths. Existing quarter-pixel quality, high-DPI native-pixel, thick-join,
interaction, export and strict-resource browser regressions cover both engines.
The shared tangent contract checks repeated controls, immutable inputs and the
straight cubic's reduction from 27 to at most nine `Math.hypot` calls.

## Performance verification

Run the existing fixed-pose controls serially in clean before/after worktrees,
using the same browser, viewport and DPR:

```bash
CAMERA_REPLAY_OUTPUT_DIR=.test-results/strokes pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
CAMERA_REPLAY_OUTPUT_DIR=.test-results/workflow pnpm exec playwright test -c playwright.workflow-replay-bench.config.ts
pnpm exec node scripts/compare-camera-replay.mjs before.json after.json --require-native-parity
```

`WORKFLOW_CHROMIUM` selects an explicit browser executable. The stroke control
covers both engines and 2,400 authored cubic strokes; Workflow measures ECS's
actual 2,400 cards plus 2,400 edges, with ordinary/profiled cohorts separated.
Preserve first visits and warm rounds separately. Require equal target cameras,
actual memberships, native geometry/uploads and resource ownership. Report CPU
percentiles alongside draw/resource counts and every timing increase; CPU scopes
are not GPU time or presented FPS. Warm precision-cache hits do not subdivide
again, so the call-count reduction alone does not establish a navigation speedup.
The PR records qualified results. Captures and profiles stay ignored local
artifacts, and smooth 2,400-node interaction remains an end-to-end goal.
