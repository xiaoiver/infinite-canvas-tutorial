# Ordered solid batching

This change fixes the existing opt-in `Renderable.batchable` path on top of master `51ccb7d`. It is independent of the text LOD implementation in #674 and the LOD design in #673. The default remains independent full rendering.

## Correctness and ownership

The old manager searched global material groups and then sorted groups by their first entity. A compatible object could cross an intervening transparent object. Depth testing cannot repair alpha compositing after that reorder. The new manager sorts active entities first and builds only adjacent compatible runs. Multi-pass nodes stay atomic; unsupported renderers, UI, clipping, filters, and node blend chains form barriers. Hiding UI does not append it out of order when restored.

Renderer capability is explicit: `Drawcall.batchKey()` defaults to `null`. Only the ordinary solid SDF renderer currently opts in, for single-pass rectangles, circles and ellipses with at most one normal solid fill/stroke, without textures, gradients, dashes, shadows or wireframes. Different colors and opacities are instance data, so they can share a page. Full SDFText, Mesh, Polyline and other renderers retain independent rendering until their shaders and resources support verified multi-object drawing. In particular, text no longer accidentally shares its first object's transform. The text material hash also uses the computed font string rather than stringifying the metrics object.

Cached resources are separate from the current ordered plan. Material eligibility is re-evaluated even when the constructor stays the same. ECS changes to eligibility, transforms, ordering, inherited effects and opacity schedule reassignment. Deletions and culling remain guarded before pending adds are consumed. Native pages contain at most 4,096 instances; surplus pages are retired and at most one empty page per key is retained for reentry. Row indexes use weak entity keys. Private renderer bindings are evicted before their buffers/textures are released, avoiding cache references to retired resources.

The affine instance buffer now uploads `[m00, m01, m10, m11, m20, m21]`, matching the shader's two-dimensional transform. The former packing included the third row instead of translation and made even an identity transform degenerate. Solid instance shaders use per-instance colors without a shared fill texture. Buffers grow geometrically, remain allocated on shrink, and upload coalesced changed rows. Camera-only updates upload no instance data. Viewport membership uses a Set instead of repeated array searches.

The raster regression also exposed a transient ECS component view retained across rendering; export now snapshots the request's needed values before render/preload can rebind that view, matching the fix already needed in #674.

## Reproduce

```sh
pnpm exec playwright test -c playwright.batching.config.ts
pnpm bench:batching
pnpm exec jest -c jest.ecs.config.js --runInBand --coverage=false \
  __tests__/ecs/batch.transitions.spec.ts __tests__/ecs/batch.lifecycle.spec.ts \
  __tests__/ecs/sdf.instances.spec.ts __tests__/ecs/render-cache.spec.ts
```

The renderer-only fixture avoids importing the site's UI. The benchmark writes `.test-results/batching-benchmark.json`; the recorded run is [batching-benchmark.json](batching-benchmark.json). It uses fresh pages per mode and an alternating red/blue grid of ordinary solid rectangles, all inside a 240 × 160 CSS px canvas. Capacity is raised only in the fixture to construct 10,000 nodes in one edit. There are 15 warmup iterations and 89 measured ECS executions. CPU times measure elapsed `world.execute()`, including CPU submission, and are not GPU timers.

## Measured run

Cloud environment, Node 24.22.3, Chromium 140 / SwiftShader, DPR 1. No other benchmark ran concurrently. These are results for compatible solid shapes, not text LOD or arbitrary documents.

| Actual visible shapes | Batching | Drawcalls | Vertices | CPU p50 / p95 (ms) | Main canvas live buffers / textures |
| --------------------- | -------- | --------- | -------- | ------------------ | ----------------------------------- |
| 1,000                 | off      | 1,000     | 4,000    | 28.0 / 35.2        | 3,003 / 1,007                       |
| 1,000                 | on       | 1         | 4,000    | 3.4 / 4.7          | 7 / 7                               |
| 10,000                | off      | 10,000    | 40,000   | 689.5 / 835.4      | 30,003 / 10,007                     |
| 10,000                | on       | 3         | 40,000   | 24.0 / 38.5        | 15 / 7                              |

The 10,000-node page sizes are 4,096 + 4,096 + 1,808. The initial benchmark attempt hit the fixture's ECS shape-change log capacity; raising the fixture's entity budget allowed the complete four-case run to pass. One material edit uploads two vertex-buffer ranges totaling 152 bytes (128 bytes of attributes plus 24 bytes of affine transform) and allocates no buffer. A camera-only frame uploads zero instance bytes. These upload checks observe actual WebGL buffers, including WebGL2 COPY_WRITE_BUFFER updates.

## Validation and limits

-   Six Chromium/SwiftShader regressions pass: overlapping half-alpha colors, rotations/mirrors, text fallback and ordering barriers, same-constructor material migration, camera/local uploads, batch flag changes, visibility and viewport reentry, repeated migrations, same-frame deletion, full/partial raster export equality, and zero live native GPU resources after teardown.
-   Deterministic planner/buffer/cache tests cover ordering, inherited clip/effect fallback, pagination, empty-page retirement, private renderer release, affine translation, partial uploads and capacity reuse. BatchManager coverage is 99.27% statements, 94.54% branches, 100% functions, 99.61% lines, above the existing thresholds.
-   Repository lint, ECS build typecheck and isolated browser fixture/test/benchmark typecheck pass. Thirteen applicable ECS suites pass: **207 tests passed**, including selection layout, document history and existing GPU cache ownership.
-   `app.spec.ts` was attempted but cannot load the missing native headless-gl binding in this Node 24 environment. Full ECS/SSR coverage, the complete site browser suite, WebKit, native WebGPU and physical GPU testing were not run locally. Existing dependency-audit failure GHSA-fc5q-39xc-vjpf remains unrelated and unsuppressed; no dependencies or overrides were added.

Order-preserving runs can legitimately produce many drawcalls when incompatible objects alternate. This work deliberately avoids a global opaque-reordering optimization. Camera changes still traverse visible ECS objects, and membership changes rebuild page rows; the benchmark does not imply a universal frame-rate guarantee. Text glyph batching and the LOD proxy's batching adapter remain follow-up work, so #674's original 1,000 text proxy drawcalls are not claimed as solved by these solid-shape results.
