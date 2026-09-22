---
title: 'glTF Duck (external model loading)'
description: 'Declarative geometry: { type: "gltf", url } loads the Khronos Duck with Blinn-Phong lighting, base-color texture, and rotation animation.'
---

<!-- example-intro:en -->

# glTF Duck

This page shows how to load an external **glTF/GLB** model through a declarative **`mesh3d`** node. The example uses Khronos’s official **Duck** (`/data/Duck.gltf` + `Duck0.bin`): `LoadMesh3DGeometry` fetches and parses the mesh asynchronously, normalizes it to a unit bounding box, then `scale3d` sizes it on the canvas. Lighting matches [scene lighting](/example/lighting): ambient plus directional.

Implementation references `packages/site/docs/components/GltfDuck.vue` and [Lesson 39 — glTF models](/guide/lesson-039#gltf).

## Interactive example

<script setup>
import GltfDuck from '../components/GltfDuck.vue'
</script>

<GltfDuck />

## Notes {#notes}

-   **Geometry declaration**: `geometry: { type: 'gltf', url: '/data/Duck.gltf' }`; you can also pass a `mesh` index; the first mesh is used by default.
-   **Async loading**: `EnsureMesh3DNodes` creates an empty companion mesh first; `LoadMesh3DGeometry` starts the fetch in PostUpdate and then writes `positions`, `normals`, `indices`, and `uvs`.
-   **Normalization**: baking centers the mesh and scales it to a unit bounding box; on-canvas size comes from `scale3d` (and the `width` / `height` anchor).
-   **Materials**: **Blinn-Phong** via `material3d`; glTF `baseColorTexture` (e.g. `DuckCM.png`) is resolved to `Material3D.map` and sampled in the `mesh3d` shader.
-   **Camera**: `linked: true` + `perspective`, synced with 2D pan/zoom; use the Select or Hand tools to interact.
-   **Asset paths**: VitePress static assets live in `docs/public/data/`; runtime URLs are `/data/…` (`.bin` files referenced inside `.gltf` must sit beside the `.gltf` file).

## Compared to built-in geometry {#vs-primitives}

| Topic           | [lighting](/example/lighting) (cube / sphere / cylinder) | This page                                 |
| --------------- | -------------------------------------------------------- | ----------------------------------------- |
| Geometry source | Built-in primitives, generated immediately               | External glTF, loaded asynchronously      |
| `geometry`      | `'cube'` / `'sphere'` / `'cylinder'`                     | `{ type: 'gltf', url: '…' }`              |
| First frame     | Visible immediately                                      | Empty companion mesh until load completes |
| Textures        | Solid-color Blinn-Phong                                  | glTF base-color texture + Blinn-Phong     |
