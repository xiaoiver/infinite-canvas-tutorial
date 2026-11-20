# Mixed Core/ECS renderer baseline

This benchmark measures mixed scenes within each renderer, before choosing the
next optimization. It does not rank Core against ECS: their CPU measurement
boundaries and available screen optimizations differ.

## Reproduce

Use pnpm 9.15.9, install workspace dependencies, then run:

```sh
MIXED_BENCH_TIMEOUT_MS=3600000 pnpm bench:mixed-renderers
# A smaller development run:
MIXED_BENCH_COUNTS=100 MIXED_BENCH_BACKENDS=ecs pnpm bench:mixed-renderers
# Reproduce the balanced 10,000-object stress profile (may time out):
MIXED_BENCH_COUNTS=10000 MIXED_BENCH_TEXT_CAP=2000 pnpm bench:mixed-renderers
```

Playwright starts the renderer-only Vite fixture on `127.0.0.1:4175` and writes
`.test-results/mixed-renderer-benchmark.json` after every measured row. The
runner uses Chromium with software WebGL2, DPR 1, a 960 × 640 CSS-pixel canvas,
and one worker. Every backend/count/order/switch combination gets a fresh page;
errors, missing draws, unexpected visibility and retained owned resources fail
the run. The default run budget is 20 minutes; the full software-WebGL matrix may need
the explicit one-hour budget above or separate filtered cohorts. It is not part of the
normal browser CI workload. Small browser regressions validate the harness in
Chromium and WebKit.

## Workload and controls

-   Default sizes: 1,000 and 10,000 actually visible shapes. Text is capped at
    200 labels; the remaining objects are divided evenly among rectangles,
    circles, 128-point open polylines and curved filled Paths. The 1,000-object
    scene has 200 of each type. The 10,000-object geometry-scaling scene has
    200 labels and 2,450 of each other type; it is not a balanced 20%-text scene.
-   Circles use a 20 × 20 ellipse node in ECS and radius 10 in Core. Other input
    geometry, coordinates, labels and paints match. Curves retain the existing
    adaptive tessellation in both off and on cases.
-   Half the Paths share one exact geometry key; half have distinct keys. Their
    counts and the complete primitive distribution are recorded in each row.
-   Grouped order puts each primitive type in a consecutive run. Interleaved
    order changes only painter order and z-index; IDs, geometry, positions and
    paints stay unchanged. Shapes do not overlap. A pixel regression verifies
    that these two full-rendering controls show the same scene.
-   Shapes opt into runtime `batchable` where supported; Core full Text and
    Polyline retain their existing independent drawing behavior. Off disables
    the experimental screen switches while preserving existing batching. On
    enables Path instancing in Core; in ECS it enables Path instancing, text LOD
    and polyline LOD. Core has no equivalent text/polyline LOD switch.
-   Font size is 12 world units; overview zoom is capped at 0.25. Polylines use
    one solid centered round stroke with round caps and no fill, meeting the
    current LOD eligibility rules.
-   Each configuration measures pan, zoom and 1% color editing in that order.
    Pan alternates by 0.25 CSS pixels, zoom by 1%, and editing distributes the
    changed objects proportionally across all five types at the default sizes
    (largest-remainder quotas, with evenly spaced members of each type). Polyline edits
    change stroke color; other edits change fill color. These bounded changes
    retain every object in the viewport.

## Measurement contract

ECS initialization adds at most 1,000 nodes per awaited edit. A single edit with
10,000 mixed nodes exceeded Becsy's 131,072-entry shape-change log. The complete
scene and original painter order are checked before settling and measurement;
no object count is reduced. This fixture does not change App or library limits.
The runner reports setup completion and operation start separately, logs browser
errors, rejects page failures immediately and records whether the source working
tree was dirty at run start. Use a clean commit and do not edit runtime sources
during a measurement.

Each operation warms up 15 frames and records 30 frames. Percentiles use sorted
samples at `floor(n × 0.50)` and `floor(n × 0.95)`; raw CPU samples and every
native-work sample are retained.

Core CPU time includes the mutation and `Canvas.render()`. ECS CPU time covers
`world.execute()`, including the queued edit and all systems in that world.
Neither includes the next animation-frame wait, initial scene construction,
network/font downloads or a GPU completion wait. `setupWallMs` separately
records scene configuration plus settling and setup warmup, including animation-
frame waits; it is wall time and must not be read as CPU frame time. Instrumentation overhead is
included. These are CPU frame measurements, not GPU timings or displayed FPS.

Native counters observe only the owned canvas's real WebGL2 context, from its
first acquisition, preserving renderer context attributes. Drawcalls include
the background; indexed and nonindexed submitted vertex counts include instance
multiplicity. Buffer subdata counts/bytes and their uniform-buffer subset are
reported separately. Requested live buffer storage bytes are tracked from
`bufferData` and deletion; texture storage and driver overhead are not inferred.
A WebGL error fails the run. Resource snapshots include the complete backend contexts,
including ECS's shared export device; they are live object counts, not GPU bytes.

The runner reports actual visible object counts and text-proxy counts. It does
not infer polyline simplification from a predicted count: submitted indices and
vertices expose its real geometry workload. Camera-only samples should still
include the scene uniform upload. The harness restores its context wrappers at
teardown. ECS must release all native resources after world exit; the
Core device retains its documented startup fallback resources, so tests require
an exact return to the baseline captured immediately after device creation.

## Additional lifecycle finding

An exploratory same-canvas sequence that replaced the complete mixed document
several times found retained Core full-text buffers/textures after destruction.
The legacy nonbatchable removal path drops cached text drawcalls without
releasing them; source comparison shows this deletion behavior predates #684.
The parent reproduction and drawcall-ownership fix are now complete in #688;
[the follow-up](glyph-atlas.md) records the subsequent Core/ECS atlas work.
This benchmark uses a fresh page per configuration, enforces that contract, and
checks teardown against each page's exact startup baseline. It does not claim
that repeated whole-document replacement is covered or fixed.

## Balanced stress-profile limit

The first full run used 20% text at both sizes. Its four Core 1,000-object
configurations completed 12 operation rows, but Core 10,000/grouped/off did not
finish scene configuration within the entire test's 20-minute budget. No valid
10,000-object frame sample was produced. The budget also included the preceding
1,000-object cases, so this is not an isolated 20-minute setup measurement.
[The failure record](mixed-renderer-balanced-limit.json) retains the requested
profile, measured source tree, environment and failure phase. This does not
establish OOM or prove a single cause. Full Core text currently creates its own
glyph manager/atlas per drawcall, which is a candidate for a separate profile.

The default 200-label cap keeps text population fixed when increasing geometry.
`MIXED_BENCH_TEXT_CAP` explicitly selects another cap; `MIXED_BENCH_BACKENDS`,
`MIXED_BENCH_COUNTS`, `MIXED_BENCH_LAYOUTS` and `MIXED_BENCH_MODES` filter the matrix.
`MIXED_BENCH_OUTPUT` selects a separate raw JSON destination; it is reset at run
start. `MIXED_BENCH_TIMEOUT_MS` changes the explicit run budget. A filtered or
capped run must retain those qualifiers when reporting results.

[Measured results](mixed-renderer-results.md) include the complete 48-row capped
matrix, raw samples, resource counts, source provenance and failed attempts.
