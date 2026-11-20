# SDF instance stream updates

Core and ECS now upload only changed Float32 rows of their existing SDF instance
buffers. Paint attributes (32 floats) and affine transforms (six floats) are tracked
independently. A conservative dirty marker with unchanged values performs no upload;
a fill edit does not upload an unchanged matrix. Eligibility, shader packing,
text/Path LOD and batching switches retain their existing contracts and defaults.
This also applies to the existing SDF instance path when text batching is disabled.

## Ownership and correctness

Each drawcall borrows its existing CPU storage and physical GPU buffers through two
small internal `InstanceBuffer` objects. Float32 comparison uses `Math.fround` and
`Object.is`, preserving signed zero while avoiding repeated stable-NaN uploads.
No shape, entity, document, interaction or persistent style cache is added.

Adjacent pending rows form one upload. More than eight disjoint ranges use one
spanning range: this bounds native calls at the cost of uploading intervening clean
rows. A few scattered changes can still increase call count; fewer bytes is the
measured benefit here. The threshold is a conservative bound, not an adaptive or
hardware-tuned optimum.

Rows leave the pending set only after a successful native upload. Failed and later
ranges retry even if CPU values and dirty flags no longer change. Inactive rows stay
pending until reentry. Buffer/storage replacement rebinds the mirrors; disposal
clears queued work and borrowed references without assuming GPU ownership. Core's
wireframe rebuild flushes and releases mirrors before replacing physical buffers.
ECS rechecks physical identity every instanced render, including after wireframe
replacement and capacity growth. Retired drawcalls do not submit queued uploads.

Core also detects numeric painter-depth changes without depending on paint dirty
flags, for both full and instanced SDF draws. Removing an earlier text node can
change a surviving solid's depth without changing its paint. ECS already reads the
current full-draw rank and marks instance rows through its geometry/order updates;
its existing full uniform path remains intact. Pixel tests cover the removal case
in both backends against independent full SDF draws.

Selection, hover, picking, marquee, editing, culling/reentry, camera migration and
exports continue to use the original scene and existing full rendering paths.
Serialization, history and collaboration data are unchanged.

## Measurements

Raw results, source trees and the diagnostic probe are in
[sdf-row-updates-benchmark.json](./sdf-row-updates-benchmark.json).
The workload has 1,000 actually visible grouped objects, including 200 full text
labels. Screen LOD and Path instancing are off. Text batching is on for the upload
comparison; the ordinary timing run also retains the off control. Chromium
140.0.7339.186 uses the existing software WebGL configuration on Node 24.

The diagnostic compares unchanged #696 runtime `da6460` with this implementation.
Totals below cover **three** edit frames and only the instanced SDF streams:

| Metric                     | Core before → after | ECS before → after |
| -------------------------- | ------------------- | ------------------ |
| Attribute bytes            | 153,600 → 1,536     | 153,600 → 1,536    |
| Matrix bytes               | 28,800 → 0          | 28,800 → 0         |
| Attribute upload calls     | 3 → 12              | 3 → 12             |
| Matrix upload calls        | 3 → 0               | 3 → 0              |
| Packed rows                | 1,200 → 1,200       | 1,200 → 1,200      |
| Geometry preparation calls | 0 → 0               | 3 → 3              |

The final enabled edit frame retains 407 native drawcalls, 395,280 submitted indices
and four array vertices in both backends. Whole-renderer buffer uploads change from
9 calls / 61,744 bytes to 11 / 1,456 for Core, and 17 / 68,296 to 19 / 8,008 for ECS.
These totals include non-SDF work. Uniform uploads remain Core 7 / 944 bytes and
ECS 5 / 800 bytes. Steady pan retains one scene-buffer upload of 192 bytes.

The ordinary benchmark ran serially on a clean source tree, with 15 warmup and
30 measured frames per phase. CPU frame times below are milliseconds, p50 / p95:

| Backend | Text batching | Pan         | Edit        |
| ------- | ------------- | ----------- | ----------- |
| Core    | Off           | 6.5 / 10.8  | 10.9 / 18.7 |
| Core    | On            | 7.7 / 15.4  | 13.3 / 19.2 |
| ECS     | Off           | 20.8 / 28.1 | 40.7 / 72.9 |
| ECS     | On            | 15.2 / 19.1 | 42.3 / 79.4 |

**A CPU speedup is not established.** Off/on compares the existing text batching
feature on this new source, not this patch against its parent. Prior runs are
separate cohorts. The measured reduction is GPU transfer bytes; SDF CPU packing
and ECS geometry preparation still occur. Lower CPU tail latency needs a separate
investigation. All four ordinary modes passed teardown resource assertions; no
retained-heap or physical GPU-time claim is made.

Reproduce the ordinary benchmark with:

```sh
TEXT_BATCHING_BENCH_OUTPUT=.test-results/sdf-row-frames.json pnpm bench:text-batching
```

The diagnostic probe and its reconstruction instructions are preserved in the raw
JSON. The committed `text-batching.spec.ts` additionally asserts the real enabled
edit-frame buffer-byte budgets (Core 1,456 and ECS 8,008), so upload regressions run
in the normal browser suite.

## Validation

-   Core: 65 tests in eight targeted suites passed; the final four SDF update cases
    also passed after extending independent matrix-failure retry coverage.
-   ECS: 135 tests in eleven targeted suites passed, including actual SDF upload
    boundaries, conservative no-op dirtiness, partial row updates, growth/shrink,
    reorder, lifecycle/history and export restoration.
-   Shared helper contracts cover coalescing, fragmented fallback, Float32 behavior,
    byte-offset views, partial failures, input exceptions, inactive reentry and disposal.
-   Chromium and WebKit: 47 relevant browser cases each passed. The final exact-byte
    assertions also passed both targeted Chromium cases and all 47 WebKit cases.
    These include new depth pixels and existing export, LOD interaction, atlas sharing,
    fallback, culling/reentry, camera migration and teardown regressions.
-   Browser, Core and ECS TypeScript checks and all 41 tooling tests passed. Normal
    changed-file hooks run for source and documentation commits. No dependencies or
    CI thresholds change.
-   All four ordinary benchmark modes and both diagnostic backends passed.
-   Full local headless-gl SSR was not run: this Node 24 dependency cache lacks its
    optional native binding. The PR's repository CI must still pass before merging.

The first repository CI run found an older `batching.spec.ts` expectation that a
material edit always uploads both a 128-byte attribute row and a 24-byte matrix
row. The test now requires only the changed attribute row, then separately checks
an unchanged edit (zero uploads) and a transform edit (one 24-byte matrix row),
with zero allocations throughout. All seven batching browser cases passed locally.
This updates the observed contract without changing runtime source or thresholds.
