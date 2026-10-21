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

For glTF imports, each triangle primitive keeps its own base color, textures, metallic and roughness factors, `alphaMode` (`OPAQUE`, `MASK`, or `BLEND`), and `alphaCutoff`. The optional `metallicRoughnessMap` follows glTF's channel convention: green multiplies roughness and blue multiplies metallic; its red and alpha channels are ignored. Missing factors use the glTF defaults of `1`. A node's explicit `material3d` values override the corresponding imported values across all primitives, including `metallic: 0`, `roughness: 1`, and `metallicRoughnessMap: null`. Multiple primitives share one transform and are selected as one model. GLB export preserves each primitive's color, PBR factors, PBR texture, and alpha mode.

Base-color and metallic-roughness textures can independently use `TEXCOORD_0` or `TEXCOORD_1`. Their glTF `texCoord` choices survive GLB export. For a custom texture, set `material3d.mapTexCoord` or `material3d.metallicRoughnessTexCoord` to `0` or `1`. `KHR_texture_transform` offset, scale, rotation, and UV-set override are applied on import and preserved by GLB export. Use `material3d.mapTextureTransform` or `material3d.metallicRoughnessTextureTransform` for a custom transform, for example `{ offset: [0.25, 0], scale: [0.5, 1], rotation: Math.PI / 4 }`. Set either transform to `null` to clear an imported transform. Higher UV set indices are skipped during import.

Use `await api.exportGlb()` to fetch and embed base-color and metallic-roughness textures. PNG and JPEG bytes are kept; other decodable image formats, including SVG, are rasterized to PNG. The returned GLB can be imported with its textures intact. Texture URLs must be fetchable with CORS. The synchronous `api.export({ format: ExportFormat.GLB })` remains available for untextured exports and omits textures.

glTF emissive materials are also supported. `material3d.emissiveFactor` is linear RGB and defaults to `[0, 0, 0]`; `material3d.emissiveMap` is sampled as sRGB and multiplies the factor. For example, `{ emissiveFactor: [0, 1, 0], emissiveMap: '/glow.png' }` brightens green where the texture has green. `emissiveTexCoord` and `emissiveTextureTransform` select and transform its UVs independently. `emissiveStrength` defaults to 1 and supports nonnegative values above 1 via glTF `KHR_materials_emissive_strength`. GLB export preserves the factor, strength, texture, UV set and transform.

Set `material3d.unlit: true` for flat base color that ignores scene light and tone mapping. It retains `alphaMode`, `alphaCutoff`, and base-color texture alpha. This maps to glTF `KHR_materials_unlit` in imported and exported GLB files.
