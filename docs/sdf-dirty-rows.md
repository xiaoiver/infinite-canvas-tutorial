# SDF dirty-row preparation

After #697 reduced GPU upload bytes, a small SDF edit still regenerated every row
on the page. Core repacked a page whenever any member was dirty. ECS also routed
leaf `GeometryDirty` markers through page preparation, rebuilding the CPU row map
and marking every member for packing even while GPU capacity was reused.

Core and ECS now distinguish leaf geometry updates from page membership changes.
A renderer opts in through `canUpdateGeometryRows`; the default remains false.
SDF opts in for nonempty, instanced, non-wireframe draws without image fills. Other
renderers, full draws and the existing complex-style paths retain their rebuilds.
Eligibility and all public feature defaults are unchanged; there is no new switch,
material-result cache, document field or dependency.

## Preparation and invalidation

Core routes eligible leaf geometry changes to the existing render marker, while
still running the original shape geometry preparation before consuming the marker.
SDF packs only marked rows or rows whose current Float32 painter depth changed.
It still scans active depth values, so this does not promise constant-time planning
or infer that a conservative dirty marker must contain different values. The #697
Float32 mirror continues to decide whether selected rows actually need uploading.

ECS routes an eligible leaf geometry marker to `dirtyInstances` rather than marking
the whole page geometry dirty. Existing row indices and capacity stay valid. The
original point, bounds, transform, visibility and ordering systems still run.
Core retains its existing GPU buffers for these ordinary size changes; ECS continues
to reuse capacity and additionally avoids rebuilding the CPU map and packing peers.

Adding, removing or reordering page members still sets `geometryDirty` directly.
New/replaced storage receives full initialization; growth, shrink, culling reentry,
real reorder and camera migration retain their existing lifecycle paths. The row
hook never clears a pending page rebuild. Full/partial export keeps the existing
representation and precision. Original shapes/entities still drive picking, hover,
marquee, history and collaboration. Upload-failure retries and retirement remain
owned by the existing #697 instance-buffer mirrors.

## Operation counts

[Raw data and diagnostic source](./sdf-dirty-rows-benchmark.json) preserve both
runtime trees and the exact measurement boundaries. A fresh scene has 1,000
actually visible grouped objects, including 200 full text labels. Text batching is
on for this counter; screen LOD and Path instancing are off. Totals below cover
three edit frames, including one warmup, and only the **instanced SDF** work:

| Metric                          | Core before → after | ECS before → after |
| ------------------------------- | ------------------- | ------------------ |
| Packed rows                     | 1,200 → 12          | 1,200 → 12         |
| Page geometry preparation calls | 0 → 0               | 3 → 0              |
| Attribute bytes                 | 1,536 → 1,536       | 1,536 → 1,536      |
| Matrix bytes                    | 0 → 0               | 0 → 0              |

The new browser contract also resizes one rectangle: both backends pack one row,
perform zero SDF page geometry builds and retain exactly the same resource counts.
Screen and raster-export pixels still match independent full SDF draws. The ECS
preparation count refers to its CPU map/dirty bookkeeping, not new GPU allocations
in every baseline color-edit frame.

Enabled edit frames keep 407 native drawcalls, 395,280 submitted indices and four
array vertices. Core retains 11 buffer uploads / 1,456 bytes and 7 uniform uploads /
944 bytes; ECS retains 19 / 8,008 and 5 / 800 respectively. Steady pan still uploads
only the 192-byte scene buffer. This patch avoids repeated CPU preparation; it does
not claim another drawcall or buffer-byte reduction for this color-edit workload.

## Ordinary frame measurements

Before and after ran serially on clean source trees, using Chromium 140.0.7339.186,
Node v24.22.3 and the existing software WebGL configuration. Each phase has 15
warmup and 30 measured frames. Entries are milliseconds, p50 / p95:

| Backend / text batching | Pan before  | Pan after   | Edit before | Edit after  |
| ----------------------- | ----------- | ----------- | ----------- | ----------- |
| Core off                | 10.8 / 15.9 | 9.1 / 15.1  | 10.5 / 16.8 | 10.5 / 18.4 |
| Core on                 | 6.6 / 8.9   | 6.1 / 10.4  | 12.6 / 24.3 | 11.7 / 17.9 |
| ECS off                 | 21.9 / 49.1 | 19.6 / 37.4 | 41.1 / 50.1 | 39.7 / 48.9 |
| ECS on                  | 10.7 / 18.5 | 14.4 / 21.0 | 40.7 / 63.3 | 39.4 / 71.9 |

The operation-count reduction is established; **a stable whole-frame speedup is
not**. In this one cohort Core's enabled edit median/tail decreased, while ECS's
median decreased and its p95 increased. Pan and off controls also vary. Keep all
results rather than selecting only improved samples; this is not a multiplier or
a statistical regression determination. ECS tail latency and broader planning,
edit/derivation and text work still need investigation. All eight before/after
ordinary modes passed resource teardown assertions. No hardware GPU-time,
WebGPU-performance or retained-heap result is asserted.

## Reproduction and verification

```sh
TEXT_BATCHING_BENCH_OUTPUT=.test-results/sdf-row-frames.json pnpm bench:text-batching
pnpm exec playwright test -c playwright.browser.config.ts sdf-packing.spec.ts --grep "packs only changed"
pnpm exec playwright test -c playwright.webkit.config.ts sdf-packing.spec.ts
```

The updated benchmark adds a separate count-only pass **after** its ordinary
frames/edits timings and glyph assertions. Ignore timing fields nested under
`sdfUpdates.result`. Because that already-edited scene starts with an unchanged
color, its three-frame count is Core eight rows and ECS twelve; the latter still
receives conservative component notifications. The fresh-scene browser/diagnostic
counter above starts with three actual changes and records twelve on both.
Wrappers restore original SDF methods in `finally` and do not run in ordinary
rendering. The raw JSON includes the portable results and the older diagnostic
script/config needed to reproduce the same counter on the parent source.

-   Core: 68 targeted tests across eight suites passed, including dirty/depth row
    packing, full initialization after storage replacement, geometry routing and
    membership/full rebuilds, retries, wireframe buffers and resource ownership.
-   ECS: 137 tests across eleven suites passed, including geometry routing plus
    existing row uploads, capacity/reorder, lifecycle/history, LOD and export recovery.
-   Chromium and WebKit: 61 relevant browser cases each passed. The selection covers
    SDF pixels/depth/size/export, exact native byte budgets, conservative no-op edits,
    affine changes, parent paint inheritance, gradients, LOD interaction, culling,
    camera migration, order, glyph sharing and teardown.
-   Browser/benchmark, Core and ECS TypeScript checks, all 41 tooling tests, normal
    source/docs hooks and diff checks passed. SDF cases are now also included in the
    normal WebKit CI selection; no timeout, retry or failure threshold is relaxed.
-   Both fresh-scene counter backends and all four after ordinary modes passed.
-   Full local headless-gl SSR was not run because this Node 24 cache lacks its
    optional native binding. Repository CI remains separate and must pass before
    merging this draft. This follow-up remains a draft on its own branch.
