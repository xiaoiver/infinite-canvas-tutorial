# Text line proxy batching

Small-text LOD previously reduced glyph work but still submitted one independent Mesh drawcall per text object. Eligible TextProxy objects now opt into the same adjacent-run planner as solid SDF shapes. This changes screen submission only: full glyph rendering, interaction geometry, document JSON, history/collaboration and full-precision exports retain their existing paths.

## Opt-in and layout

LOD remains disabled by default. When LOD is enabled, set an existing text entity's `Renderable.batchable` field to `true` inside `api.edit`. This is a runtime ECS flag, not a serialized node attribute. The English/Chinese Text LOD examples now set it for their labels; setting it back to `false` gives an independent-proxy comparison.

Each nonempty text line is one native instance of a shared quad. A 64-byte instance record stores the local line rectangle, the six affine transform values, render order, inherited opacity, and solid fill RGBA including paint opacity. Different colors and transforms can share a page. Empty lines preserve layout spacing but submit no quad.

Pages contain at most 4,096 line instances. `Drawcall.instanceCount()` defaults to one for existing adapters; TextProxy reports its nonempty line count. The planner keeps adjacent compatible runs and treats full text, non-batchable objects, clipping/effects/blending and other renderers as boundaries. A single object with more than 4,096 nonempty lines stays on the private Mesh path, so a scene object is never split around another object's passes.

Membership/line-count changes rebuild row ranges. Buffers grow geometrically and are retained on shrink. Material/transform edits upload only dirty text row ranges, coalescing adjacent ranges; camera-only frames update the shared scene buffer. One two-line material edit uploads 128 native vertex-buffer bytes without allocating a buffer. The browser probe observes actual WebGL ARRAY_BUFFER/COPY_WRITE_BUFFER uploads. Private page bindings are destroyed with their page. Retirement also releases geometry allocated before program creation completes. Existing empty-page retention remains bounded to one per compatible key.

## Validation and reproduction

```sh
pnpm exec playwright test -c playwright.text-lod.config.ts
pnpm exec jest -c jest.ecs.config.js --runInBand --coverage=false \
  __tests__/ecs/text-proxy.instances.spec.ts __tests__/ecs/batch.transitions.spec.ts \
  __tests__/ecs/batch.lifecycle.spec.ts __tests__/ecs/sdf.instances.spec.ts \
  __tests__/ecs/text-lod.spec.ts
TEXT_LOD_COUNTS=1000 TEXT_LOD_MODES=off,on,batched pnpm bench:text-lod
TEXT_LOD_COUNTS=10000 TEXT_LOD_MODES=on,batched pnpm bench:text-lod
```

The benchmark defaults to comparing independent and batched proxies at both sizes. Explicit `TEXT_LOD_MODES=off` still requests full glyph rendering. The fixture uses an App entity budget of 131,072; production defaults are unchanged. Fresh pages use a fixed two-line document, 800 × 600 CSS px canvas, DPR 1, 100 columns and overview zoom 0.024. The camera alternates 0.024/0.0241. Each completed mode records 89 measured `world.execute()` frames after 15 warmup frames; CPU times include ECS and CPU submission, not GPU timers. Counts below are actual visible entities and submitted work, with live native objects rather than GPU byte estimates. Runs are serial; no other GPU test runs concurrently.

| Visible texts | Mode              | Drawcalls | Vertices | CPU p50 / p95 (ms) | Main live buffers / textures |
| ------------- | ----------------- | --------- | -------- | ------------------ | ---------------------------- |
| 1,000         | full              | 1,000     | 164,000  | 32.2 / 57.8        | 5,003 / 1,007                |
| 1,000         | proxy independent | 1,000     | 8,000    | 36.0 / 71.0        | 3,003 / 7                    |
| 1,000         | proxy batched     | 1         | 8,000    | 12.3 / 18.0        | 6 / 7                        |
| 10,000        | proxy independent | 10,000    | 80,000   | 730.9 / 850.3      | 30,003 / 7                   |
| 10,000        | proxy batched     | 5         | 80,000   | 130.9 / 174.9      | 18 / 7                       |

Recorded in the cloud environment on the implementation working tree based on `f8dd205`; raw values, browser/Node versions, resources and incomplete attempts are in [text-proxy-benchmark.json](text-proxy-benchmark.json). These are environment-specific results, not a promised speedup. The 10,000-text batched CPU frame is still expensive. Full 10,000-text construction was interrupted during seeding without a comparable frame sample, consistent with the earlier incomplete workload documented in [text LOD](text-lod.md). One initial large batched attempt was invalidated by development-server HMR; it was discarded and rerun with unchanged sources.

Pixel regressions compare the private and instanced proxy paths for overlapping colors/alpha, rotation, reflection, varying line counts and painter-order barriers. Other cases cover selection/hover/edit forcing full, opt-in changes, visibility, viewport reentry, same-frame deletion, bounded native resources and full/partial export pixel equality. The proxy suite is also listed in WebKit CI. Native WebGPU and physical-device testing remain separate checks.

## Production initialization investigation

An isolated production build of the real Vue documentation component initially threw in d3-color because the temporary reproduction config omitted the site's existing UMD alias. Matching that alias, top-level-await transform and public assets makes both language interaction regressions pass locally. This does not establish the cause of the cloud-browser production-site block (dynamic resource loading/client interception); no renderer initialization behavior was changed based on that unconfirmed cause.

The documentation build CI now serves the **full VitePress output** and checks the actual English and Chinese page routes, including a narrow viewport, startup, LOD toggles, hysteresis, selection and module failures. This covers the production chunk graph rather than only the development fixture. The first full-site CI trace confirmed startup and proxy rendering, then exceeded the generic five-second wait while restoring 400 cold glyph renderers; its post-failure screenshot already showed all 400 full labels. That measured 7.4-second cold transition now has a bounded 15-second phase wait, with other interaction waits unchanged:

```sh
# First build workspace packages and the documentation site as in docs-build.yml.
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test -c playwright.site-production.config.ts
```
