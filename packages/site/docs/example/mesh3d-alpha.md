---
title: '3D mesh transparency'
description: 'Alpha cutouts, transparent meshes and matching shadows.'
---

# 3D mesh transparency

`material3d.alphaMode` controls how a mesh uses its base color and texture alpha:

| Mode               | Color pass                                     | Shadow pass                                                          |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------- |
| `opaque` (default) | Ignores alpha and writes depth                 | Opaque shadow                                                        |
| `mask`             | Discards pixels with alpha below `alphaCutoff` | Uses the same cutoff                                                 |
| `blend`            | Blends back to front without writing depth     | Uses stable coverage dithering for an approximate translucent shadow |

For textured meshes, effective alpha is the base color alpha multiplied by the map alpha. `alphaCutoff` defaults to `0.5`. The renderer draws opaque and masked meshes first, then sorts blended meshes by camera-space center depth. Intersecting blended meshes and overlapping triangles _within one mesh_ may still have ordering artifacts; use `mask` for crisp cutouts.

<script setup>
import MeshAlpha from '../components/MeshAlpha.vue'
</script>

<MeshAlpha />

```ts
api.updateNodes([
    {
        id: 'cutout',
        type: 'mesh3d',
        geometry: { type: 'plane' },
        x: 36,
        y: 77,
        width: 150,
        height: 150,
        z: 25,
        scale3d: [150, 150, 1],
        rotation3d: [0, Math.PI, 0],
        material3d: {
            map: '/mesh3d-alpha-mask.svg',
            alphaMode: 'mask',
            alphaCutoff: 0.5,
            castShadow: true,
        },
    },
    {
        id: 'glass',
        type: 'mesh3d',
        geometry: { type: 'plane' },
        x: 235,
        y: 95,
        width: 150,
        height: 170,
        z: 0,
        scale3d: [150, 170, 1],
        rotation3d: [0, Math.PI, 0],
        material3d: {
            baseColor: [1, 0.2, 0.16, 0.45],
            alphaMode: 'blend',
            castShadow: true,
        },
    },
]);
```

The scene also needs a `Camera3D`, a light, and a receiving floor; see the [Lighting example](/example/lighting). Blended shadows are a single-layer approximation, so multiple overlapping glass casters do not accumulate physical transmittance.

For a glTF mesh with one material, the loader inherits its `alphaMode` (`OPAQUE`, `MASK`, or `BLEND`) and `alphaCutoff`; an explicit `material3d` value overrides either property. The current loader flattens multiple primitives into one mesh and uses the first material for all of them, so different alpha modes within one imported model are not supported yet.

GLB export preserves an untextured mesh's explicit alpha mode and mask cutoff. The current exporter does not embed base-color textures, so a texture-shaped cutout cannot round-trip through GLB yet.
