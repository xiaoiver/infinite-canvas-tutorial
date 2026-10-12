---
'@infinite-canvas-tutorial/ecs': patch
'@infinite-canvas-tutorial/filter': patch
---

Preserve translucent blur colors and extend SDF and ordinary Path fill output beyond the original outline. Capture the original silhouette into a padded texture, keep selection geometry unchanged, release replaced capture resources, and update WebGL1 blur uniforms per pass. Make zero blur an identity and avoid undefined SDF stroke derivatives inside hollow shapes.
