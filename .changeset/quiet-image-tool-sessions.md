---
'@infinite-canvas-tutorial/webcomponents': patch
'@infinite-canvas-tutorial/ecs': patch
---

Bind image tool requests and shortcuts to their canvas lifecycle. Cancel stale
picker, upload, and queued insertion results on tool changes or teardown, restore
the selection tool before inserting, and keep insertion as one undo step without
recording unrelated pending edits. Add optional cancellation to image insertion
and release temporary image measurement bitmaps.

Open legacy image file inputs with a native click for WebKit compatibility,
cleaning them up on selection or cancellation without polling.

Declare the text hit-testing reads used by the arrow tool so switching tools and
hovering a target cannot stop the ECS frame loop.
