---
'@infinite-canvas-tutorial/react': minor
'@infinite-canvas-tutorial/ecs': patch
---

Add useCanvasCoordinates with stable, Provider-scoped client/viewport/world
coordinate conversions and null results when no API is available. Add a
bilingual drag-to-place example with click/tap placement at the view center.

Fix viewport2Client to apply CSS scaling to the local point before adding the
canvas client offset, restoring correct placement in scaled containers.
