---
title: 'Vector Network cube — drag an edge'
description: 'Wireframe cube with 7 vertices and 9 segments; drag a whole edge in Move mode.'
---

<!-- example-intro:en -->

# Vector Network cube — drag an edge

This demo follows the classic [Figma Vector Networks](https://www.figma.com/blog/introducing-vector-networks/) / [alexharri.com](https://alexharri.com/blog/vector-networks) wireframe cube: **7 vertices** and **9 segments** (hidden back lines omitted). Unlike three separate paths, the graph stays connected when you move geometry.

See [Lesson 22 — VectorNetwork](/guide/lesson-022#vector-edit-mode) for Move / Bend / Cut editing.

## Interactive demo

1. The cube opens in **vertex edit mode** (Move tool selected).
2. **Hover a segment** until the midpoint handle appears, or click near an edge.
3. **Drag the segment** — both endpoints move together and shared vertices follow (e.g. pull the front-top edge to change extrusion).

<script setup>
import VectorNetworkCube from '../components/VectorNetworkCube.vue'
</script>

<VectorNetworkCube />

## Topology {#topology}

```ts
// 7 vertices — front face 0–3, back 4–6 (hidden back-bottom edge omitted)
vertices: [
  { x: 0, y: 80 }, { x: 80, y: 80 }, { x: 80, y: 0 }, { x: 0, y: 0 },
  { x: 30, y: 100 }, { x: 110, y: 20 }, { x: 30, y: 20 },
],
// 9 segments
segments: [
  { start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 0 },
  { start: 3, end: 6 }, { start: 6, end: 5 }, { start: 2, end: 5 },
  { start: 0, end: 4 }, { start: 4, end: 6 },
],
```

Source: [`packages/site/docs/lib/vector-network-cube.ts`](https://github.com/xiaoiver/infinite-canvas-tutorial/blob/main/packages/site/docs/lib/vector-network-cube.ts).
