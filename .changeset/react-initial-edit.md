---
'@infinite-canvas-tutorial/react': patch
---

Seed initialNodes through the shared pre-render api.edit phase after async onReady
preparation, without capturing history. Cancel pending initialization on unmount
or recreation, and clear the loading fallback only after the initial edit commits.
