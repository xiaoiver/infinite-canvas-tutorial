# Shared immutable Core/ECS glyph atlases

This follows the demand-driven construction in #689. Both renderers now lease
immutable atlas snapshots shared by device, observable font state, rasterization
parameters and complete requested grapheme set. Different string order can reuse
the same set (AB/BA); layout, transforms, paint uniforms and geometry remain local
to each drawcall. This stage targets repeated glyph sets. It does not combine
arbitrary subsets into a font-wide mutable atlas or batch full-text drawcalls.

## Ownership and compatibility

The pool publishes a snapshot only after construction/upload succeeds. A failed
acquisition leaves the current snapshot usable and publishes no cache entry.
Pool entries have reference-counted leases; the final release removes the entry
and destroys its manager/texture. A drawcall owns at most two leases for short
edit/undo and paint roundtrips, evicting the older one on a third distinct key.
Retirement, bitmap-font migration and destruction release all of its leases.
There is no globally idle GPU-atlas retention after all owners leave.

A new immutable snapshot borrows only still-required CPU glyphs from a retained
snapshot with the same rasterization key. It rasterizes missing glyphs and builds
its own atlas/texture; a fully seeded snapshot still uploads a complete texture.
This preserves peer UVs and avoids redrawing an entire paragraph when one character
is added. Cycling through evicted snapshots can regenerate glyphs or textures.

Font identity needs more than a CSS family name. The key includes FontFace object
identity, descriptors and loading status, covering already-loaded faces added
without loading events. The implementation conservatively considers the complete
observable FontFaceSet. Canonical browser/worker adapters can share; custom canvas
adapters or environments without observable font state keep private snapshots.
Bitmap-font pages retain their original ownership. The lease exposes read/layout
methods rather than manager mutation/destruction methods.

LOD/batching switches and their defaults remain unchanged. The normal full-text
rendering path uses this internal cache; it does not alter document attributes,
interaction geometry or export intent. Private/shared query controls exist only
in the test fixture. The actual parent runtime had a different incremental
private-manager topology, so the private benchmark control below is an isolation
control within this implementation, not a measured historical parent.

## Reproduce

```sh
pnpm bench:glyph-sharing
GLYPH_SHARING_BENCH_MODES=shared GLYPH_SHARING_BENCH_OUTPUT=.test-results/shared-only.json pnpm bench:glyph-sharing
pnpm exec playwright test -c playwright.browser.config.ts glyph-sharing.spec.ts glyph-atlas.spec.ts core-text-lifetime.spec.ts text-lod.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts glyph-sharing.spec.ts glyph-atlas.spec.ts core-text-lifetime.spec.ts text-lod.spec.ts
pnpm exec jest -c jest.config.js --runInBand --coverage=false --runTestsByPath __tests__/unit/core-glyph-atlas-pool.spec.ts __tests__/unit/core-glyph-manager.lifecycle.spec.ts
pnpm exec jest -c jest.ecs.config.js --runInBand --coverage=false --runTestsByPath __tests__/ecs/ecs-glyph-atlas-pool.spec.ts __tests__/ecs/glyph-manager.lifecycle.spec.ts __tests__/ecs/render-cache.spec.ts __tests__/ecs/batch.lifecycle.spec.ts __tests__/ecs/renderer.lifecycle.spec.ts
```

The workload is [the mixed-scene contract](mixed-renderer-benchmark.md): 1,000
actually visible objects, including 200 full-text labels and 200 each of four
other primitives; grouped painter order, screen switches off, 960 × 640 CSS px,
DPR 1. Labels N0–N99 repeat twice, giving 55 unique complete grapheme sets under
the same rasterization parameters. This reuse profile is a stated workload
property, not a claim for arbitrary text documents.

Each private/shared backend case gets a fresh page. Private mode makes each
acquisition independent while retaining real rendering and the same bounded
snapshot behavior. Each case measures 30 pan frames and then 30 proportional
1%-color-edit frames, with 15 warmup frames per operation. Core CPU boundaries
include mutation plus render; ECS uses world execution. Setup wall time includes
configuration and frame settling after renderer initialization. Atlas upload MB
is cumulative RGBA payload, not resident GPU bytes. Raw native work and CPU
samples are retained; there is no GPU completion wait. Instrumentation is included.

## Measured cohort

Node 24.22.3, Chromium 140 / Playwright 1.55.1, software WebGL2. One clean runtime
tree, one worker, four cases in private-then-shared order within each backend,
with no other GPU workload running. These are single cohorts; cache/order effects
and cloud scheduling are not isolated. Compare within each backend: Core/ECS use
different SDF scales and CPU boundaries.

| Backend | Control | Atlas builds | Glyph draws | Upload MB | Setup wall ms | Pan p50 / p95 ms | 1% edit p50 / p95 ms | Live textures cold / after edits | Drawcalls |
| ------- | ------- | -----------: | ----------: | --------: | ------------: | ---------------- | -------------------- | -------------------------------- | --------: |
| core    | private |          200 |         762 |      6.59 |        1032.3 | 6.9 / 13.6       | 9.4 / 15.6           | 207 / 207                        |       603 |
| core    | shared  |           55 |         210 |      1.81 |         588.4 | 7.3 / 11.5       | 8.0 / 11.4           | 62 / 62                          |       603 |
| ecs     | private |          200 |         762 |     23.69 |        2825.8 | 19.5 / 30.4      | 43.3 / 56.9          | 412 / 414                        |       602 |
| ecs     | shared  |           55 |         210 |      6.53 |        1768.5 | 20.9 / 34.4      | 45.9 / 51.0          | 267 / 268                        |       602 |

Buffers stay at 2,411 for Core and 2,608 for ECS; the ECS counts include its
screen and shared-export contexts. All four cases submit the same native work:
395,280 indexed vertices, four array vertices, and 603/602 drawcalls for Core/ECS.
The additional post-edit ECS textures are bounded cached paint snapshots, held
by drawcall leases. All cases return exactly to their backend-specific teardown
baseline (Core startup fallbacks; zero observed ECS objects).

The reliable resource finding is fewer duplicate atlas constructions, payload
bytes and live textures for this reused-glyph-set workload. CPU frame samples
are mixed: shared ECS pan/edit p50 are higher in this cohort. These samples do
not establish a frame-rate improvement. Full glyph batching remains a separate
step requiring explicit eligibility, painter-order and instance-buffer work.

[The raw data](glyph-sharing-benchmark.json) retain 240 measured CPU samples,
per-frame native counters, active resource snapshots and source identities.
Local measured commit `b810739fff0b527bbc161fe8b5243bbbb393348e` has the exact
same source tree as published runtime commit
`823b30e6a1a0c9eed8189fc0dbe2a8face7af71f`.

## Validation and limits

-   Core: 36 tests passed across glyph, pool, ownership and Path suites.
-   ECS: 44 tests passed across glyph, pool, render-cache, batch and renderer
    lifecycle suites. The separate native `api.text-resize.spec.ts` suite could
    not load the missing headless-gl binding under Node 24 and is not counted as passed.
-   Chromium and Linux WebKit each pass 12 targeted cases: private/shared pixels,
    AB/BA order, live peers on deletion, Greek/CJK edits, already-loaded FontFace
    insertion, bounded three-state edit cycles, full PNG exports, Core reentry and
    ECS LOD interaction/export. Image comparisons account for edge antialiasing.
-   Core/ECS build types, full browser-test types, repository ESLint and 41 tooling
    tests pass. Existing normal commit hooks run. No dependency/lock changes.
-   Hardware WebGL, native WebGPU, physical Safari and a no-reuse/large-paragraph
    workload remain unmeasured. Shared snapshots require identical complete glyph
    sets; differing font state/configuration, display font stack or emoji fill keys
    can reduce reuse. Global FontFaceSet inspection is deliberately conservative.
