# Reusing ordinary text pages during paint edits

The opt-in ordinary text batching in #691 reduces submissions but replacing
paint-specific pages can make editing more expensive. This follow-up changes
**both Core and ECS** while keeping the existing eligibility, defaults, painter
barriers, page budget and full export path.

The planners first look for an exact material-key page. If none remains, they may
reuse a live TextBatch whose first member is the same object/entity. Each previous
page is consumed at most once. The current ordered plan still determines every
member, material key and submission position. Empty or unsupported pages retire
normally; no extra inactive-page cache is introduced.

Each TextBatch records the geometry inputs after a successful build: member
identity, text/layout/font state, transform and depth. Dirty markers still trigger
validation, but an unchanged snapshot reuses its buffers. Actual content, font,
layout, transform, depth and membership changes rebuild them. The ready flag is
cleared before construction and committed only after success, so a partial GPU
failure always retries rather than accepting a stale snapshot.

Eligible ASCII gets its RGB from uniforms. Core already rasterizes that path
without fill color. ECS batches now use a canonical black raster color while
preserving the original raster alpha and colored-SDF mode. Its snapshot includes
that alpha; CSS color alpha changes can still require rebuilding geometry/atlas.
Ordinary RGB edits and object/fill opacity uniforms keep the glyph layout. The
independent full paths retain their existing atlas rules, including emoji colors.

Picking, document/history data and export remain on the original objects. Switches
still default off. This change keeps different paints as separate ordered pages;
it does not add per-glyph paint attributes or merge across barriers.

## Verification and reproduction

The paired browser tests repeatedly change arbitrary RGB colors and object
opacity after the first split, require no new SDF geometry/atlas/glyph work, check
stable native resource counts, compare a long CSS-alpha label against full drawing,
and verify teardown. Unit tests cover rotating material keys without lending a
page twice, real layout changes and failed-build retries. Existing text, LOD,
export and ownership tests run for both backends.

Run `pnpm bench:text-batching` for the same grouped 1,000-visible-object workload
as #691, with 30 measured frames after 15 warmup frames. The fixture now records
real SDF geometry construction as well as glyph rasterization/atlas uploads before
and after camera/paint phases. CPU timings retain each backend's existing boundary
and software WebGL caveats. Results will distinguish structural work reduction
from wall-clock variation; no speed multiplier is assumed.

## Recorded cohort

The measured source is local commit `29198910476d3f4d738dac13604b0e69bf535611`,
identical to published commit
[`3e2a72e`](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/3e2a72eee034989d4d483912bd923ea092d1b1c7)
(tree `63ee9e71753c500af8f147483908ab3fac50d0f8`). The
[raw records](./text-batch-paint-benchmark.json) include every CPU sample and
native frame. All four modes rendered 1,000 objects, 200 full texts, zero text
proxies, 395,280 submitted indices and four array vertices per sampled frame.

| Backend / switch | Pan CPU p50 / p95 ms | Paint CPU p50 / p95 ms | Pan / paint drawcalls | Paint uploads / bytes per frame |
| ---------------- | -------------------: | ---------------------: | --------------------: | ------------------------------: |
| core / off       |           7.0 / 13.4 |             8.0 / 11.8 |             603 / 603 |                      11 / 61744 |
| core / on        |           3.6 / 10.5 |             8.6 / 18.8 |             403 / 407 |                       9 / 61744 |
| ecs / off        |          15.4 / 25.6 |            33.7 / 52.1 |             602 / 602 |                      25 / 69496 |
| ecs / on         |          15.2 / 19.2 |            45.1 / 67.1 |             403 / 407 |                      17 / 68296 |

With batching enabled, each backend constructed one initial text geometry and
five more during the first split. The remaining paint edits constructed none;
the two atlases (original union plus the edited glyph subset) stayed stable.
The independent browser tests confirm this for arbitrary RGB colors and object
opacity after a split. Camera frames uploaded only the 192-byte scene uniform.
All four teardown checks passed.

The previous #691 cohort recorded paint CPU p50/p95 of 15.7/19.1 ms in Core and
64.0/89.7 ms in ECS, with 62,560 and 184,296 upload bytes per paint frame. The
current enabled rows are lower, with fewer uploads, but these are **separate
cohorts**, not a controlled timing ratio. Current enabled painting is still slower
than current disabled painting in both backends. Compatibility planning and
snapshot validation remain costs to investigate; this change does not establish
that batching improves edit CPU time in general. The feature stays off by default.

## Validation

-   Core: 45 targeted tests across five suites passed.
-   ECS: 110 targeted tests across six suites passed.
-   ECS BatchManager coverage: statements 99.36%, branches 95.94%, functions 100%,
    lines 99.65%, above unchanged thresholds.
-   Chromium: 18 regression cases passed; WebKit: 18 regression cases passed on
    the final fixed source. A fixture import-order issue that left WebKit at Loading
    was corrected; the renderer bootstrap precedes drawcall instrumentation.
-   Browser, Core and ECS TypeScript checks and changed-file ESLint passed.
    Normal commit and Markdown hooks passed.
-   The clean, sequential four-mode benchmark passed. No hardware GPU/FPS claim.
-   Full headless-gl SSR was not run locally because this Node 24 cache lacks the
    optional native gl binding; repository CI remains a separate check.
