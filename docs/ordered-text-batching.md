# Ordered ordinary text batching

The immutable glyph snapshots in #690 share atlas textures while each text still
owns an SDF drawcall. This next slice combines adjacent compatible full text into
one indexed geometry page in **both Core and ECS**. It reduces submission and
per-object GPU resources; it does not simplify text or change glyph count.

## Enable

The canvas switch defaults to **false**. Text must also explicitly be batchable.
Core currently constructs Text with `batchable = false`; opt in after construction:

```ts
const text = new Text({
    content: 'N42',
    fontFamily: 'sans-serif',
    fontSize: 12,
});
text.batchable = true;
canvas.appendChild(text);
canvas.textBatching = true; // Or CanvasConfig.textBatching at initialization.
```

In ECS, mark each intended text's `Renderable.batchable` in an API edit, then call
`api.setTextBatchingEnabled(true)`. The canvas-local switch applies on the next
frame, stays outside document serialization/history, and can be disabled at runtime.

## Conservative scope

-   Stock generic families: sans-serif, serif, monospace and system-ui.
-   ASCII labels, including multiline text and whitespace, with nonempty content.
-   One solid normal paint, matching font configuration, paint and opacity.
-   At most 4,096 source characters per page, including whitespace. A single label
    exceeding the budget falls back; labels are never split across pages.
-   Font size at most 256 and measured width/height at most 8,192 logical units.
-   Exactly equal affine linear transforms and a common local translation cell.

Non-ASCII text, custom fonts, text on paths, bitmap/physical text, decoration,
stroke, effects, texture paint, wireframe, attenuation and unsupported transforms
keep independent full SDF drawing. ECS also excludes UI, clip/blend/filter ancestry
and translucent ancestors. Core excludes unsupported ancestor effects/opacity.
These exclusions preserve typography and can be expanded with dedicated tests.

## Order, precision and ownership

The existing ordered planners combine only consecutive compatible items. Paint
changes, unsupported text and other primitives are painter barriers. Each glyph
keeps its source object's depth. Core detects changed depth even when preceding
non-text siblings disappear without changing text membership.

The first member's model matrix remains the batch model. Only object anchors are
translated into its coordinates; existing glyph offsets and shaders keep their
layout calculations. Subtracting world translations in double precision before
conversion avoids baking huge absolute world coordinates into Float32 vertices.
Singular, ill-conditioned, nonfinite and extreme transforms safely fall back.
Linear-transform equality and the 8,192-unit translation cell bound local offsets.

A page generates one immutable atlas for the union of its bounded ASCII glyphs,
using the existing leased atlas pool. Membership, content, transform and material
changes invalidate geometry. Camera-only frames reuse geometry. Empty text pages
are retired, including their buffers and atlas leases; ECS does not retain empty
text pages for arbitrary keys. Core removal cancels pending frame membership.

Screen batching keeps original entities, text metrics, bounds and document data.
Hit testing and box selection continue to use those original objects. This is
full text, so selection, hover and editing require no proxy restoration. Existing
ECS text LOD still selects its own proxy drawcall before considering full batching.
Raster exports disable screen batching and use independent full geometry, including
when Core exports with the grid enabled. No serialization, history or collaboration
schema changes are introduced.

Core enables its ordered solid planner when text batching is enabled. Its legacy
global solid batches may therefore split at painter barriers; interleaved scenes
can gain non-text drawcalls. ECS already uses the ordered planner. The benchmark
reports total native submissions separately for each backend rather than assuming
every workload improves.

## Reproduce and verify

```sh
pnpm exec playwright install chromium
pnpm bench:text-batching
```

The script runs fresh off/on pages for each backend with the same grouped 1,000
visible objects: 200 each of Rect, ellipse, text, 128-point Polyline and curved
Path. Labels N0–N99 occur twice. Other LOD and Path instancing switches stay off.
The text batching switch is the only changed control. Thirty samples follow
15 warmup frames for pan and 1% paint editing. Counters observe actual WebGL2
submissions, submitted indices, array vertices, uploads, native resources and
allocated buffer bytes. CPU timing measures Core.render or ECS world.execute;
the boundaries differ, so compare within a backend. This is software WebGL in
headless Chromium, not a GPU frame-time or general FPS claim.

`TEXT_BATCHING_BENCH_OUTPUT` selects the raw JSON destination. Correctness tests
compare the same current document with the switch off/on in Chromium and WebKit,
including overlap/alpha, rotation, content/multiline/unsupported typography,
capacity overflow, visibility/culling reentry, hit-test membership, raster export,
repeated changes, deletion and teardown. Small edge-pixel tolerance accounts for
floating point evaluation order; source geometry and documents remain full.

## Recorded cohort

The clean measured source is local commit `4899c8d107f8d068b03e9e435861373a86f00d99` (tree
`b4de87a4b65653fdbe6480af0ab5207113813f10`). The [raw data](./text-batching-benchmark.json)
contains every CPU sample and native frame. The published source commit
[`b740e76`](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/b740e76aaee49ae02926f493d7e68c1843539fba)
has the identical measured tree. This single sequential cohort is
a measurement, not a timing threshold.

| Backend / switch | Native calls | Pan CPU p50 / p95 ms | Paint-edit CPU p50 / p95 ms | Live buffers / textures | Allocated buffer bytes |
| ---------------- | -----------: | -------------------: | --------------------------: | ----------------------: | ---------------------: |
| core / off       |          603 |           8.1 / 13.0 |                  7.9 / 19.1 |               2411 / 62 |                1931220 |
| core / on        |          403 |           5.3 / 12.8 |                 15.7 / 19.1 |                1611 / 8 |                1892956 |
| ecs / off        |          602 |          21.2 / 28.3 |                 46.3 / 60.8 |              2608 / 267 |                2206188 |
| ecs / on         |          403 |          15.6 / 30.2 |                 64.0 / 89.7 |              1613 / 213 |                2158428 |

All four modes rendered **1,000 visible objects**, with zero text proxies,
395,280 submitted indices and four array vertices per measured pan frame.
Camera-only frames uploaded just the 192-byte scene uniform buffer; no glyph
geometry was uploaded. Initial atlas uploads fell from 55 to one in both backends.
Every teardown returned native resources to its baseline.

Core reduces total calls by 200: 199 text submissions plus one additional merge
of adjacent compatible solid pages. ECS reduces calls by 199. Changing painter
order can remove these opportunities; no global regrouping crosses barriers.

Both backends show a paint-edit CPU regression in this cohort. ECS pan p95 also
rises from 28.3 to 30.2 ms, despite a lower median. Different paints
split text pages, and changing them can retire/rebuild pages and glyph geometry.
This first slice is most useful for dense, mostly static labels during camera
movement. It remains opt-in; per-glyph paint attributes and stable edited pages
are follow-up work, rather than justification for enabling this path by default.

## Validation

-   Core: 43 tests across five targeted suites passed.
-   ECS: 107 tests across six targeted suites passed.
-   ECS BatchManager coverage: statements 99.33%, branches 95.52%, functions 100%,
    lines 99.64%, exceeding the unchanged repository thresholds.
-   Chromium: 16 browser regression cases passed.
-   WebKit: 16 browser regression cases passed, including the new four Core/ECS
    batching cases. Screenshots use CSS pixel scale to normalize device DPR.
-   Changed TypeScript passed ESLint; Core, ECS and browser TypeScript checks passed.
    Normal lint-staged, markdownlint and commit hooks passed.
-   The sequential four-mode benchmark passed; raw CPU/native/resource records are
    committed above.
-   The full headless-gl SSR suite was not run locally: this Node 24 dependency
    cache lacks the optional native gl binding. The targeted suites and real
    Chromium/WebKit WebGL tests above ran successfully.
-   A new remote PR and its CI are pending: automatic approval rejected creating
    the remote Git tree until explicit push/publication authorization is provided.
