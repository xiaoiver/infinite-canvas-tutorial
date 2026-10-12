---
'@infinite-canvas-tutorial/filter': patch
---

Preserve translucent colors in brightness, contrast, hue/saturation, noise and halftone filters by distinguishing straight paint textures from premultiplied canvas textures and clamping before premultiplication. Synchronize these color-filter uniforms before every WebGL1 pass and allocate scalar std140 blocks with 16-byte alignment so noise renders in WebKit.
