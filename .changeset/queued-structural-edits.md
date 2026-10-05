---
"@infinite-canvas-tutorial/webcomponents": patch
---

Commit context-menu grouping, ungrouping, and cropping through `api.edit()`.
Keep queued commands bound to their original canvas and target IDs, skip deleted
targets, and observe edit failures without leaving unhandled promises.
