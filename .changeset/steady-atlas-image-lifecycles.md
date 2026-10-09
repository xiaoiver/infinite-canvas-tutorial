---
'@infinite-canvas-tutorial/ecs': patch
---

Keep the previous glyph atlas intact when allocation or upload fails, publish replacement atlas data atomically, and release atlas caches idempotently. Preserve multiline layout origins, default glyph scale to one, and apply bitmap kerning before positioning each glyph.

Prevent late image decodes from replacing newer cached bitmaps, release obsolete decoded images, allow retry after synchronous adapter failures, and ignore disabled image layers when resolving raster options.

Match renderer constructors when reusing batches, and keep removed or cleared UI drawcalls out of the restored frame queue.
