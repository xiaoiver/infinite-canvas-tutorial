---
"@infinite-canvas-tutorial/webcomponents": patch
---

Bind smart selection previews to the current image, discard stale segmentation
responses, and clean up masks on exit or teardown. Submit mask removal results
as one undoable image edit with owned mask pixels and retryable failure states.
