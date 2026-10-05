---
'@infinite-canvas-tutorial/webcomponents': patch
---

Commit inserted nodes, highlight clearing, and selection in one cancellable
edit instead of selecting after a fixed 100ms timeout. Preserve the legacy
updateAndSelectNodes arguments and return a promise for commit completion.

Await insertion in clipboard, drop, Mermaid, and image workflows. Propagate edit
failures without treating them as Mermaid conversion failures or inserting a
second text fallback. Keep asynchronous drops bound to their original canvas.
