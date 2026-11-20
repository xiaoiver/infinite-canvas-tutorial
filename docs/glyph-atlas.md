# Core/ECS demand-driven glyph atlases

Core full text previously baked 96 ASCII glyphs for each private drawcall,
including glyphs absent from the label. ECS already generated requested glyphs
plus space. Both implementations now use that same default and deduplicate new
and cached graphemes with Sets. `GlyphManager.generateAtlas(..., preloadAscii)`
accepts explicit ASCII warming; its default is `false` in both packages. No Canvas
or App LOD/batching switch changes, and independent full-text drawcalls remain.

Core now also follows ECS's atlas ownership contract: publish the glyph map,
packing and texture only after upload succeeds, retain the previous usable atlas
on allocation/upload failure, dispose a failed candidate, and release CPU/GPU
caches idempotently. An edit containing new graphemes grows the atlas on demand.
The original bitmap-font, layout, interaction and export paths remain in use.

## Reproduce

```sh
pnpm bench:glyph-atlas
GLYPH_BENCH_MODES=default GLYPH_BENCH_OUTPUT=.test-results/glyph-default.json pnpm bench:glyph-atlas
pnpm exec playwright test -c playwright.browser.config.ts glyph-atlas.spec.ts core-text-lifetime.spec.ts text-lod.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts glyph-atlas.spec.ts core-text-lifetime.spec.ts text-lod.spec.ts
pnpm exec jest -c jest.config.js --runInBand --coverage=false --runTestsByPath __tests__/unit/core-glyph-manager.lifecycle.spec.ts
pnpm exec jest -c jest.ecs.config.js --runInBand --coverage=false --runTestsByPath __tests__/ecs/glyph-manager.lifecycle.spec.ts
```

The benchmark uses the [mixed-scene workload and counters](mixed-renderer-benchmark.md):
1,000 actually visible objects, including 200 ordinary full text labels; 200 each
of rectangles, ellipses, 128-point polylines and filled curved Paths; grouped painter
order, DPR 1, 960 × 640 CSS pixels, screen optimizations off. Every backend/mode
gets a fresh Chromium page. Both native-resource teardown checks must pass.
The default compares normal generation and an explicit ASCII-preload control.

`atlasCpuMs` sums synchronous `generateAtlas()` calls, including rasterization,
packing and GPU upload submission. `uploadedBytes` sums successful RGBA atlas
payloads; it is not resident GPU memory or driver allocation. `setupWallMs`
measures scene configuration and settling after renderer initialization, including
animation-frame waits. Thirty pan CPU-frame samples follow fifteen warmup frames,
using each renderer's existing measurement boundary; raw samples and native work
are retained. Camera-only frames must not generate further glyphs. There is no GPU
completion wait. Instrumentation overhead is included.

## Measured cohorts

Node 24.22.3, Playwright 1.55.1 / Chromium 140 / software WebGL2, one worker.
The two parent-default cases and four changed-default/control cases completed
serially on clean source trees, with no other GPU workload running. These are
single cohorts, not repeated cold-start trials or hardware WebGL measurements.
Core uses SDF scale 2 and ECS scale 4; compare before/after within a backend.

| Backend | Case          | Glyph draws | Uploaded MB | Atlas CPU ms | Setup wall ms | Pan CPU p50 / p95 ms | Drawcalls |
| ------- | ------------- | ----------: | ----------: | -----------: | ------------: | -------------------- | --------: |
| core    | Before        |      19,762 |      164.01 |       7775.2 |        8382.6 | 7.2 / 11.6           |       603 |
| ecs     | Before        |         762 |       23.69 |       1087.5 |        2490.2 | 22.1 / 54.5          |       602 |
| core    | After         |         762 |        6.59 |        471.5 |         949.3 | 5.7 / 10.0           |       603 |
| core    | ASCII control |      19,200 |      164.01 |       7222.6 |        7653.3 | 6.0 / 12.4           |       603 |
| ecs     | After         |         762 |       23.69 |        988.2 |        2514.1 | 20.2 / 32.0          |       602 |
| ecs     | ASCII control |      19,200 |      582.55 |      27050.6 |       28525.2 | 21.0 / 28.5          |       602 |

Core's old default generated duplicate requested ASCII glyphs in addition to the
preloaded set; the new explicit-preload control removes those duplicate draws.
ECS was already demand-driven: its default glyph count and payload remain exactly
unchanged. Its observed timing variation does not establish a new speedup.

Native work is unchanged: 603 drawcalls for Core and 602 for ECS, each submitting
395,280 indexed vertices and four array vertices in these frames. Core retains
2,411 buffers / 207 textures while active; ECS retains 2,608 / 412 across its
screen and shared-export contexts. Texture _counts_ remain unchanged because
atlases are still private. All six cases pass exact backend-specific teardown.
The Core cold-work reduction is not a drawcall optimization or a throughput promise.

[Raw data and source mapping](glyph-atlas-benchmark.json) preserve both measured
local commit/tree identities and published commits with identical trees. The
parent harness is `accba5049d2c51956c04e98ad1f6f94f838f515f`; the measured runtime
is `e36868257b50adac0b29729563c036553e9fda0b`. Later documentation/runner diagnostic
changes do not alter the rendering workload or measured runtime sources.

## Validation and limits

-   Core ownership, Path and glyph suites: 28/28 passed; ECS glyph suite: 17/17 passed.
-   Identical default-grapheme cases run in both packages; Core additionally mirrors
    ECS's existing allocation/upload rollback, retry and idempotent-disposal cases.
    The unmodified parent has eight Core failures and one packing control pass;
    the ECS parent control already passes all seventeen cases.
-   Chromium and Linux WebKit each pass ten targeted cases: both-backend readable
    text/ASCII-preload pixels, Greek/CJK edits and full PNG exports; Core replacement,
    culling and graph reentry; ECS LOD hysteresis, interaction geometry and exports.
    Atlas repacking changes edge sampling, so perceptual pixel comparison accounts
    for antialiasing while still rejecting missing/misplaced glyphs.
-   Core/ECS build types, full browser-test types, repository ESLint and 41 tooling
    tests pass. ECS types require building the workspace device-api package first.
-   The initial local broad run included Vue-based text-path tests with a renderer-only
    Vite configuration and could not load those components; it was stopped. The
    targeted ten-case runs above passed. Full text-path/site tests remain in CI.
-   Physical GPUs, native WebGPU, physical Safari, shared atlases, full glyph batching
    and the balanced 2,000-label stress case were not measured here.
