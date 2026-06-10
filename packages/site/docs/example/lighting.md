---
title: '3D scene lighting (Light3D)'
description: 'Ambient, directional, and spot lights with Blinn-Phong materials and an orbiting spotlight.'
---

<!-- example-intro:en -->

# 3D scene lighting

This page demonstrates **`Light3D`** with **Blinn-Phong** materials: ambient light as a base, a cool directional fill, and a warm **spot light** orbiting the scene center. Three cubes with different specular settings make it easy to compare highlights and shading.

Implementation references `packages/webcomponents/examples/main.ts` and [Lesson 39 — 3D mesh rendering](/guide/lesson-039).

## Interactive example

<script setup>
import Lighting from '../components/Lighting.vue'
</script>

<Lighting />

## Notes {#notes}

-   **Light types**: `ambient` contributes color and intensity only; `directional`, `point`, and `spot` are packed into the scene light array (max 8 lights; see the `mesh3d` shader).
-   **Custom lights**: spawning any `Light3D` **replaces** the default ambient + directional bundle; if no `directional` is provided, the renderer adds a weak directional fill so meshes are not fully black.
-   **Coordinates**: `position` and `direction` use the same **canvas world units** as `Transform3D` (about 1 px in linked mode). `direction` points from the light toward the lit scene; the renderer normalizes it.
-   **Spot lights**: `innerConeAngle` and `outerConeAngle` are in radians; `range <= 0` disables distance attenuation (same as the webcomponents example).
-   **Materials**: `Material3D` `ambient`, `diffuse`, `specular`, and `shininess` drive the Blinn-Phong response; the center cube uses higher `specular` and `shininess` for a brighter highlight.
-   **Animation**: each frame updates the spot via `spotLight.write(Light3D)`; `MeshPipeline3D` repacks lights when the component changes.

## Compared to the cube example {#vs-cube}

| Topic        | [cube-perspective](/example/cube-perspective) | This page                                  |
| ------------ | --------------------------------------------- | ------------------------------------------ |
| Lights       | Renderer default ambient + directional        | Explicit multiple `Light3D` nodes          |
| Objects      | Single white cube                             | Three cubes with different material params |
| Motion       | Mesh rotation only                            | Mesh rotation + spotlight orbit            |
| Default tool | Select                                        | Select (`Pick3D` requires the Select tool) |
