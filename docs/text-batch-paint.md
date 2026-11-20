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
