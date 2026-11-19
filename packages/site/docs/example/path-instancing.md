---
title: 'Path instancing'
description: 'Compare ordered repeated-Path batching in Core and ECS using actual WebGL submissions.'
---

<!-- example-intro:en -->

# Path instancing

Repeated solid Path fills can share geometry and an instance page in both Core and ECS. This example explicitly enables the experimental optimization; both library defaults remain off. It reduces submissions without simplifying the original paths.

<script setup>
import PathInstancing from '../components/PathInstancing.vue'
</script>

<PathInstancing />

## Compare compatible and alternating paths

1. Leave **Alternating geometry** off. The paths have identical geometry but different colors. Toggle **Path instancing** at the same camera position and compare the visible counts and actual drawcalls in both canvases.
2. Enable **Alternating geometry**. Two different geometries alternate in painter order, so there are no adjacent compatible pairs. The switch cannot combine these paths across the intervening geometry.
3. Choose 1,000 paths, pan, zoom or resize the page. **Overview** fits both scenes independently. Click or marquee-select paths; **Clear selection** removes selection and hover overlays before comparing counts.
4. Use either PNG button to preview a full precision raster export. Export uses the ordinary full Path rendering path, independently of the screen optimization.

The drawcall counters observe real native WebGL submissions on each example's own context, including the background and selection/hover overlays. Index and nonindexed vertex counts include instance multiplicity; they measure submitted work, not unique geometry storage. Idle canvases retain the last completed screen frame. Export frames are excluded. There is no frame-rate or GPU-time claim; instrumentation itself adds overhead.

With 1,000 visible identical paths and no interaction overlays, the current scene normally changes from **1,001 to 2 submissions**: 1,000 independent fills become one instanced fill, plus one background draw. Alternating geometry retains 1,001 submissions. Hovering or selecting can increase counts. Each compatible page holds at most 4,096 paths; unsupported paints, strokes, effects, differing linear transforms and other rendering barriers use the full path. Core also uses ordinary meshes for singleton runs.

## Enable it in your canvas

```ts
// Core: a canvas switch plus explicit per-Path eligibility.
canvas.pathInstancing = true;
const path = new Path({
    d: 'M0 0 H20 V20 H0 Z',
    fill: '#2563eb',
    batchable: true,
});
canvas.appendChild(path);
```

```ts
// ECS: neither flag is serialized into the document.
api.setPathInstancingEnabled(true);
await api.edit(
    (editor) => {
        const node = editor.getNodeById('your-path');
        editor.getEntity(node).write(Renderable).batchable = true;
    },
    { capture: 'NEVER' },
);
```

Set the canvas switch back to `false` to restore ordinary drawing. Picking, bounds and selection keep the original geometry; document JSON, history and collaboration remain unchanged. This optimization is separate from [text LOD](./text-lod).
