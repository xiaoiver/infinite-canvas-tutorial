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
