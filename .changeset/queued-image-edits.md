---
"@infinite-canvas-tutorial/webcomponents": patch
---

Commit background removal, upscaling, and decomposition results as one edit after
preparation. Keep requests bound to their source image and canvas, ignore stale
results, and reset busy state on empty results and errors. Use the registered
decomposition provider instead of fixed sample images.
