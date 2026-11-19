# Repeated Path fill instancing prototype

[#682](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/682) reduced precision-cache bookkeeping. This prototype addresses repeated solid filled Paths that still submit one fill draw per object. ECS can now opt into one shared triangulated fill mesh per ordered instance page, with affine placement, color and opacity carried in 48-byte rows. Pages contain at most 4,096 objects.

## Scope and activation

This prototype is **ECS only and disabled by default**. Core uses a different batch manager and the external `@antv/g-device-api`; it has not been migrated. Existing core path tests are an unchanged control. This is an explicit prototype, not automatic batching of arbitrary SVGs or multi-part icons.

Both the canvas switch and the existing per-entity `Renderable.batchable` flag must be enabled. The latter is a runtime ECS option, not serialized node data:

```ts
import { Renderable } from '@infinite-canvas-tutorial/ecs';

await api.edit(
    (api) => {
        for (const node of repeatedPathNodes) {
            api.getEntity(node).write(Renderable).batchable = true;
        }
    },
    { capture: 'NEVER' },
);
api.setPathInstancingEnabled(true);

// Return to the existing independent Mesh path at runtime.
api.setPathInstancingEnabled(false);
```

Only consecutive compatible objects batch. A key includes exact path data, fill rule, tessellation method and the model's linear transform. Equal linear transforms give equal projected precision under the same pass; translation and paint can vary per row. Nonfinite, projective or singular transforms fall back. The eligibility gate accepts one enabled solid fill, normal blending and no positive-width stroke. Rough rendering, textures, wireframe, size attenuation, effects, clipping and 3D extrusion remain on the existing path. Ancestor clip/filter/blend barriers and intervening painter-order items prevent grouping.

Different linear transforms or interleaved geometry keep separate draws. Multi-part icons whose different paths interleave are not collapsed into one draw. The alternating-geometry control below demonstrates this limit. Original entity geometry, bounds, picking and document data remain authoritative. Whole and partial raster exports always build an independent full Mesh plan; SVG data and history formats are unchanged.

## State and lifetime

The page retains one adaptive CPU geometry cache and one vertex/index mesh. A precision change updates that mesh; membership changes remap instance rows. Style-only dirty markers do not rebuild unchanged geometry. Float32 row comparison skips equal writes; adjacent dirty rows upload together. Pending rows remain dirty after an upload failure so an identical retry still writes. Camera-only frames upload no instance data; a single color, translation or opacity edit writes one 48-byte row.

Geometry-specific keys are potentially unbounded. Unlike reusable finite-material pages, an unused Path page is retired immediately rather than retained empty. This prevents repeated geometry edits from accumulating old buffers. Private bindings belong to the page; programs/layouts belong to the existing render cache and are released with that cache.

Path data writes now trigger renderer reassignment even when the renderer family is unchanged. The integration also refreshes Path camera ownership after hierarchy changes. Viewport culling remembers the spatial-index owner so a bounds update after reparenting removes the old camera's RBush entry before inserting into the new tree; removal uses the remembered owner as well. The camera test moves a Path between cameras with the normal transform invalidation and checks both draw membership and spatial-index membership. Existing same-frame hidden/deleted/moved guards still apply.

## Measurements

Reproduce from the repository root:

```sh
PATH_INSTANCE_COUNTS=600,1000 pnpm exec playwright test -c playwright.path-instancing-bench.config.ts
```

The same build is measured with the runtime switch off/on and `batchable` enabled on every Path. Each case uses a fresh page, 800×600 canvas, DPR 1, zoom 0.75, varying solid paints/opacity, 15 warmup frames and 30 completed measured frames. The shared fixture now awaits the final `world.execute()` before calculating timings and takes native counters from a completed-frame snapshot. Runs are sequential, with no concurrent local checks. Environment: Linux, Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader. CPU times include probe overhead and exclude initial scene loading.

| Actual visible | Geometry order       | CPU p50 / p95 off → on (ms) | Native drawcalls off → on |
| -------------- | -------------------- | --------------------------- | ------------------------- |
| 600            | identical            | 12.4 / 22.0 → 3.1 / 9.4     | 601 → 2                   |
| 1,000          | identical            | 15.9 / 20.3 → 4.0 / 5.3     | 1,001 → 2                 |
| 600            | alternating two keys | 8.5 / 16.9 → 6.4 / 13.1     | 601 → 601                 |
| 1,000          | alternating two keys | 16.5 / 20.4 → 9.4 / 13.0    | 1,001 → 1,001             |

The extra native draw is the existing `GridRenderer` background quad. Actual Path fill submissions in the identical case drop from N to one. Submitted index counts remain 5,400 / 9,000 for 600 / 1,000 objects: instancing shares storage, not coverage. Every measured camera frame uploads only the existing 192-byte scene block.

For 1,000 identical Paths, main-canvas live buffer counts fall from 3,003 to six and texture counts from 1,007 to seven. Programs/shaders/VAOs are 3/6/3 off and 4/8/4 on: the runtime transition retains the old full shader/layout plus the new instance shader/layout in the existing cache. All are released at canvas teardown. In the 1,000-object alternating control, buffers remain 3,003 and drawcalls remain 1,001, while textures still fall to seven. The instance path uses cached row paint rather than the full Mesh path's per-object solid fill textures and material setup, so that control's CPU gain cannot be attributed to fewer draws. It also issues more vertex attribute setup calls; all counters are retained in the raw data.

These short software-renderer samples do not establish a universal CPU/FPS multiplier or GPU speedup. GPU execution time, peak loading memory and allocated GPU bytes were not measured. The existing `vertices` fixture field counts retained indices, not literal or submitted vertices; use `native.indices` for actual submitted index work. The legacy `builds` probe counts only SmoothPolyline and is not a Path triangulation metric. Full results are in [path-fill-instancing-benchmark.json](./path-fill-instancing-benchmark.json).

## Validation and limits

-   115 tests across seven related Jest suites passed: batching and retirement, exact key selection, 4,096-row capacity, screen/export intent, failed-upload retry, geometry reuse, renderer lifecycle and existing path/LOD invariants.
-   The final Chromium run passed all 52 related browser cases. Seven new cases cover repeated fills, reflected/nonuniform affine overlap and holes, transparency/order barriers, complex-style fallback, history and direct Path writes, visibility/reentry, same-frame deletion, picking/hover/marquee, camera/spatial-index migration, WebGL1, native 4,097-row paging, partial row uploads and native resource teardown. Full and partial export bytes match feature-off output.
-   The 4,097-object fixture loads and clears in bounded chunks to respect the existing ECS component-change log capacity. No product entity/log limits were raised.
-   An initial existing WebGL1 blend case crashed on page reload. Its isolated rerun and the final full run passed without assertion, timeout or retry-policy changes; no underlying crash fix is claimed.
-   ECS/browser TypeScript, changed-file ESLint, Markdown lint, diff checks and the ECS ES module build passed. All nine browser CI tooling checks passed; the new cases join the existing WebKit suite.
-   Local WebKit could not run on this host's missing system libraries. Native WebGPU, physical devices, the full native headless-GL suite and live collaboration with this prototype enabled remain unverified. Default-off collaboration/document paths are covered by normal CI.

No dependency, audit exception, deployment setting, CI timeout or retry-policy changes are included.
