---
'@infinite-canvas-tutorial/webcomponents': patch
---

Queue document variable edits through the canvas edit boundary. Preserve both Light and Dark values during rapid changes, give each valid edit its own undo step, and cancel stale row commands. Restore invalid or failed controls without recording unrelated pending changes and retain newer add drafts.
