---
title: 'glTF Duck (external model loading)'
description: 'Load glTF and GLB models with PBR lighting, normal and occlusion textures, and two-sided materials.'
---

<!-- example-intro:en -->

# glTF Duck

This page shows how to load an external **glTF/GLB** model through a declarative **`mesh3d`** node. The example uses Khronos’s official **Duck** (`/data/Duck.gltf` + `Duck0.bin`): `LoadMesh3DGeometry` fetches and parses the mesh asynchronously, normalizes it to a unit bounding box, then `scale3d` sizes it on the canvas. Lighting matches [scene lighting](/example/lighting): ambient plus directional.

Implementation references `packages/site/docs/components/GltfDuck.vue` and [Lesson 39 — glTF models](/guide/lesson-039#gltf).

## Interactive example

<script setup>
import GltfDuck from '../components/GltfDuck.vue'
import GltfMaterial from '../components/GltfMaterial.vue'
import GltfVertexColors from '../components/GltfVertexColors.vue'
</script>

<GltfDuck />

## PBR material comparison {#pbr-material}

The Khronos **NormalTangentTest** GLB combines a base-color image, metallic-roughness texture, tangent-space normal map, occlusion map, and a double-sided material. Toggle each feature to see its contribution. The normal map changes direct lighting; occlusion darkens indirect ambient and environment light without changing direct lights. `doubleSided` controls back-face culling and reverses back-face lighting normals.

<GltfMaterial />

The imported `normalTexture.scale` and `occlusionTexture.strength`, UV set selection, `KHR_texture_transform`, and authored glTF `TANGENT` attributes survive GLB export and reimport. When tangents are present, normal mapping uses their handedness to shade mirrored UV islands and sharp seams. This sample does not contain authored tangents, so it uses screen-space derivatives. Derivatives are also used for a second normal-map UV set or a UV scale/rotation, whose basis may differ from the authored tangents. The [model and textures](https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/NormalTangentTest) are by Ed Mackey, copyright 2017 Analytical Graphics, Inc., [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Vertex colors {#vertex-colors}

This small glTF uses normalized 8-bit `COLOR_0` at each corner of a plane. The colors blend across its surface. Toggle lighting to compare the unlit color with a lit material, and use the canvas tools to move or rotate it.

<GltfVertexColors />

`COLOR_0` can be RGB or RGBA. RGB defaults to alpha 1. Vertex RGB is linear and multiplies the material's base-color factor and texture in linear space; vertex alpha multiplies their alpha. Mixed scenes keep uncolored primitives white. GLB export writes the imported colors as floating-point RGBA so they survive another import.

## Notes {#notes}

-   **Geometry declaration**: `geometry: { type: 'gltf', url: '/data/Duck.gltf' }`; you can also pass a `mesh` index; the first mesh is used by default.
-   **Async loading**: `EnsureMesh3DNodes` creates an empty companion mesh first; `LoadMesh3DGeometry` starts the fetch in PostUpdate and then writes `positions`, `normals`, `indices`, and `uvs`.
-   **Normalization**: baking centers the mesh and scales it to a unit bounding box; on-canvas size comes from `scale3d` (and the `width` / `height` anchor).
-   **Materials**: GGX metallic-roughness lighting via `material3d`; glTF `baseColorTexture` (e.g. `DuckCM.png`) is resolved to `Material3D.map` and sampled in the `mesh3d` shader.
-   **Color space**: glTF `baseColorFactor` stores linear RGB; the importer converts it to ECS sRGB `Material3D.baseColor` before the shader decodes it. Alpha stays unchanged. GLB export converts it back to linear RGB, preserving material color through a round-trip.
-   **Camera**: `linked: true` + `perspective`, synced with 2D pan/zoom; use the Select or Hand tools to interact.
-   **Asset paths**: VitePress static assets live in `docs/public/data/`; runtime URLs are `/data/…` (`.bin` files referenced inside `.gltf` must sit beside the `.gltf` file).

## Compared to built-in geometry {#vs-primitives}

| Topic           | [lighting](/example/lighting) (cube / sphere / cylinder) | This page                                       |
| --------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Geometry source | Built-in primitives, generated immediately               | External glTF, loaded asynchronously            |
| `geometry`      | `'cube'` / `'sphere'` / `'cylinder'`                     | `{ type: 'gltf', url: '…' }`                    |
| First frame     | Visible immediately                                      | Empty companion mesh until load completes       |
| Textures        | Solid-color PBR                                          | glTF base color, PBR, normal and occlusion maps |
