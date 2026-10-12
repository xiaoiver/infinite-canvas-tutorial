---
'@infinite-canvas-tutorial/ecs': patch
---

Replace the bundled HEIC decoder with heic-to 1.6.6 (libheif 1.23.6), fixing color
shifts in full-range SDR images and preserving PNG transparency. Keep conversion lazy and in a background worker,
with the existing PNG/JPEG fallback and caller-owned bitmap behavior.
