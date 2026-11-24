# Read-only node lookup during image planning

ECS image raster variants prefer the current document's image fit/position options,
then fall back to the component layer. The ordinary API resolves an entity by
scanning its command map, then scans the document for that node's ID. Repeating
that lookup while describing many image members can make a dense plan quadratic.

The image planner now owns a lazy lookup for one synchronous read-only pass. It
indexes only the command and document prefixes requested so far. A dense pass
visits each entry at most once under normal Becsy identity semantics; a sparse
view does not eagerly scan the full scene. Mapping insertion order and first wire
ID matches are preserved, including a first alias with no corresponding node.
Held/transient identity validation still runs. The public API lookup is unchanged.

Each new dirty plan starts with fresh lookup state. This covers document replacement,
material edits, deleted/reused mappings, independent APIs and culling reentry without
a persistent ID cache. A failed read discards partial iterator state before retry.
No snapshot is created while image batching is disabled or if all descriptions hit
the existing raster cache. Image options are resolved before entering the texture
lease factory, so returned acquisition callbacks cannot retain the pass lookup.

Core already reads image source identity/dimensions directly from each Shape in
`coreImageToken` and `ImageBatch.prepareGeometry`; it has no entity-to-wire scan.
Its production path stays unchanged. Core tests cover current source/dimension
reads and share the same image pixel, export, interaction and resource regressions.
Both backends retain page/sampler limits, native geometry/uploads, runtime defaults,
source documents and history. Full/export raster-option resolution keeps its
ordinary API path and complete precision.

Use the existing [image controls](image-batching.md) and
[fixed camera replay](camera-replay.md), with ordinary/profiled Workflow cohorts
kept separate. A diagnostic CPU profile motivates the lookup change; it is not a
before/after timing result. Keep first and warm rounds and negative results, and
verify native/resource parity. Smooth 2,400-node interaction still needs a separate
end-to-end and native-device check.
