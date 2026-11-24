# Image page compatibility planning

Core and ECS keep ordered image pages within 256 rows and eight raster variants.
An append check describes the candidate, then the next check includes that member
in the page's sampler set. Previously both checks resolved its texture token.
Core also repeated image eligibility inside validation after classifying the shape.

Each synchronous dirty plan now owns a resolver retaining only the previous shape
and token. The candidate of one append check is the new member inspected by the
next check, so this adjacent repeated description is reused. A rejected ninth
sampler becomes the first member of a fresh page without another description. The ordered Core planner already established image
eligibility, so its append check only checks the existing page limits. The legacy
Core validation path still performs its full eligibility check.

The two values and resolver are discarded when planning returns. They are never stored on
a page, renderer, entity or device, and they acquire no texture leases. A subsequent
plan resolves current image sources and raster variants again; failed descriptions
are not cached. This avoids relying on cross-frame component/version invalidation.
The existing raster-description cache and material invalidation remain unchanged.

Painter order, page sizes, sampler order, drawcalls, upload data, defaults, full
renderers and export paths are unchanged. This reduces repeated planning work;
it does not reduce GPU upload volume or establish smooth 2,400-node interaction.

Shared tests exercise sampler and row boundaries, adjacent shape identities,
source edits, fresh plans and description failures. Both managers are tested with
300 shapes and an edit introducing a ninth raster variant. Existing browser tests
cover full-path pixels, raster exports, interaction, culling/reentry, deletion,
fallbacks and strict GPU ownership. Use the [fixed camera replay](camera-replay.md)
for qualified before/after measurements and report ordinary Workflow and profiled
cohorts separately, with first and warm rounds preserved.
