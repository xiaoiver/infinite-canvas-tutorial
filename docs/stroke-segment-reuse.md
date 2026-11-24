# Screen stroke segment reuse

Core and ECS rebuild a stroke page when its membership, placement or render
precision changes. The original page builder also rebuilt each member's local
segment flags and travel distances, even when the immutable precision points
were already retained by the curve cache.

Screen `StrokeBatch` pages now reuse that CPU segment data by the identity of
those points and the current cap/join. Page assembly still copies the current
translation and render order into independently owned buffers. Native submissions,
GPU uploads and allocation/teardown contracts are unchanged.

The cache is a weak map with one cap/join variant per point object. It holds no
shape, entity, camera, device or GPU object, and no builder callback. Its lifetime
follows the existing four-level curve cache and any live precision contexts;
it adds no strong root for old levels. A style change replaces the single
variant. A failed build leaves the previous variant usable. Path edits receive
new precision points, so they cannot revive old segment bytes.

This trades retained CPU segment arrays for less repeated segment construction.
It does not cache packed pages or retain empty GPU pages. Cold precision levels
still build, and packing/upload work still runs when a page changes. Full and
export drawcalls continue using their existing uncached segment builder. Existing
batch eligibility, opt-in defaults, picking, editing, history and source documents
are unchanged.

The shared Core/ECS contracts exercise page retirement, translation, separate
devices/full passes, all cap/join combinations, open/closed/compound paths, edits,
precision revisits and build failures. Browser checks compare against full-path
pixels and cover exports, interaction, culling/reentry, same-frame deletion,
WebGL1, idle work and strict GPU teardown.

Use the [fixed camera replay](camera-replay.md) for qualified before/after
measurements of both renderers and the actual 2,400-card Workflow. Keep cold and
warm rounds separate and inspect geometry phases alongside total CPU time.
Native submission parity is required for this change. Report uploads and resource
counts even though this optimization is limited to CPU construction. The replay
is a diagnostic workload; native-device interaction remains a separate check.
