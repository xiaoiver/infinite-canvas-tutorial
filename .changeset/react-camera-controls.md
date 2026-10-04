---
'@infinite-canvas-tutorial/react': minor
'@infinite-canvas-tutorial/webcomponents': minor
'@infinite-canvas-tutorial/ecs': patch
---

Add useCanvasCamera and Provider-scoped zoomTo / fitToScreen actions. Expose
ic-camera-changed with full camera state, including rotation-only updates and
identical camera changes in separate canvases.

Fit scene bounds in one camera transition, accounting for camera rotation and
excluding editor overlays. Immediate camera changes cancel previous animations.
Add view controls to the React documentation playground and framework starters.
