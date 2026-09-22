---
title: 'Textured Earth (perspective 3D mesh)'
description: 'Wrap a sphere with an equirectangular Earth map via material3d.map, specular and bump maps, and spin it on the Y axis.'
---

<!-- example-intro:en -->

# Textured Earth (perspective)

Building on [Lesson 39 — 3D mesh rendering](/guide/lesson-039), this page shows how to assign a **base-color map** with `material3d.map` on sphere geometry `geometry: { type: 'sphere' }` to create an Earth. The texture is an equirectangular Earth image; the sphere rotates steadily on the Y axis. A debug cube beside it uses the same linked perspective camera.

See also AntV [G’s sphere demo](https://github.com/antvis/G/blob/master/site/examples/3d/geometry/demo/sphere.js).

## Interactive example

<script setup>
import Earth from '../components/Earth.vue'
</script>

<Earth />

## Notes {#notes}

-   **Geometry**: declarative `type: 'mesh3d'` + `geometry: { type: 'sphere', segments: [48, 32] }`. The unit sphere generates equirectangular UVs for texture sampling.
-   **Textures**: `material3d.map` accepts an image URL (base color). `specularMap` and `bumpMap` modulate specular highlights and surface relief (same public assets as the AntV G demo). Images load asynchronously; a 1×1 white texture is used until ready, then the map appears on the next frame. The sampler uses `REPEAT` along longitude and `CLAMP_TO_EDGE` along latitude for equirectangular maps.
-   **Lighting**: declarative `light3d` nodes (one ambient + one directional) with `baseColor: '#ffffff'` so tints do not wash out the map; higher `ambient` keeps the night side readable.
-   **Camera**: `projection: 'perspective'` for foreshortening (linked to the 2D canvas pan/zoom).
-   **Animation**: in `requestAnimationFrame`, call `api.updateNode(earth, { rotation3d }, false)` to update Y-axis rotation for the spin.

> Maps must be loadable with CORS. This example uses the same public Earth textures as AntV G.
