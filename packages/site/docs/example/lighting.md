---
title: '3D scene lighting (Light3D)'
description: 'Interactive ambient, directional, point, and spot lighting with adjustable material parameters.'
---

<!-- example-intro:en -->

# 3D scene lighting

This page compares all four `Light3D` types: ambient, directional, point, and spot. The cube, sphere, and cylinder stay still so changes in lighting are easy to see. Each direct-light mode keeps a dim explicit ambient light so unlit faces remain visible. You can adjust the sphere's `metallic` and `roughness`, compare HDR and LDR studio panoramas, toggle shadows, then play or pause the spotlight orbit.

The implementation is in [`Lighting.vue`](https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/packages/site/docs/components/Lighting.vue); see also [Lesson 39 — 3D mesh rendering](/guide/lesson-039).

## Interactive example

<script setup>
import Lighting from '../components/Lighting.vue'
</script>

<Lighting />

## Add lights to a scene {#api}

`api.updateNodes` accepts lights beside mesh nodes. The spotlight's `direction` points from its position toward the objects; cone angles are in radians. Update its position or direction with `api.updateNode` to animate it.

```ts
api.updateNodes([
    { id: 'ambient', type: 'light3d', lightType: 'ambient', intensity: 0.4 },
    {
        id: 'sun',
        type: 'light3d',
        lightType: 'directional',
        direction: [0.45, 0.65, 0.55],
        intensity: 1.8,
        castShadow: true,
    },
    {
        id: 'lamp',
        type: 'light3d',
        lightType: 'point',
        x: 165,
        y: 105,
        z: -160,
        intensity: 18,
        range: 500,
        castShadow: true,
    },
    {
        id: 'spot',
        type: 'light3d',
        lightType: 'spot',
        x: 200,
        y: 40,
        z: -180,
        direction: [0, 1, 1],
        color: '#ffe6b3',
        intensity: 6,
        range: 500,
        innerConeAngle: Math.PI / 8,
        outerConeAngle: Math.PI / 4,
        castShadow: true,
    },
    {
        id: 'sphere',
        type: 'mesh3d',
        geometry: { type: 'sphere' },
        x: 200,
        y: 160,
        z: 40,
        width: 80,
        height: 80,
        scale3d: 70,
        material3d: {
            baseColor: '#ebeff2',
            metallic: 1,
            roughness: 0.25,
            environmentMap: '/lighting-studio.hdr',
        },
        camera3d: { linked: true, projection: 'perspective' },
    },
]);
```

## Notes {#notes}

-   **Light combinations**: with no explicit lights, the renderer supplies ambient and directional defaults. Once a light is supplied, only the explicit lights contribute. Up to 8 non-ambient lights render; additional lights are ignored.
-   **Coordinates and range**: positions and directions use canvas world units; in this linked-camera example, smaller z values are closer to the viewer. `direction` points from the light toward the scene. Positive `range` uses a squared range falloff; `range <= 0` disables attenuation. This is not physical inverse-square falloff.
-   **Spot cone**: `innerConeAngle` and `outerConeAngle` are in radians. The outer angle must exceed the inner angle; invalid or equal inputs are sanitized before rendering.
-   **Color and materials**: CSS colors and textures enter as sRGB, lighting runs in linear space, and a filmic tone map precedes sRGB output. `metallic` and `roughness` drive GGX highlights. The material's `ambient` scales both the ambient fill and optional environment reflection; legacy `diffuse`, `specular`, and `shininess` no longer affect shading.
-   **Environment lighting**: `material3d.environmentMap` accepts an equirectangular LDR image or Radiance `.hdr` URL. HDR radiance stays in linear space while the renderer builds second-order spherical harmonics for diffuse light and five importance-sampled GGX roughness levels for reflections. The levels are packed into one RGBM atlas for both WebGL and WebGPU. The demo lets you compare a generated HDR studio panorama with an LDR SVG. An omitted or failed image preserves the old ambient appearance.
-   **Cast shadows**: set `castShadow: true` on a directional, point, or spot `light3d` node. The first enabled eligible light among the first eight direct lights casts shadows from meshes onto other meshes, including a plane. Directional shadows fit the meshes, spot shadows use their cone and range, and point shadows use six 90° views packed into a 3 × 2 atlas. All use 3 × 3 PCF. Select “Point + ambient” or “Spot + ambient” to inspect those shadows; “All lights” uses the earlier directional light.
-   **Limits**: diffuse light uses a 128 × 64 sample and second-order spherical harmonics, so fine detail is lost. The reflection atlas has 128 × 64 pixels at its sharpest level and RGBM stores radiance up to 16. One light can cast shadows at a time: 1024 × 1024 for directional/spot, or six 512 × 512 faces for point. Spot shadow cones of 85° or wider are unsupported; translucent objects cast opaque shadows. The IBL specular term uses a Schlick Fresnel approximation without a split-sum BRDF LUT.
-   **Animation**: the example updates the spotlight via `api.updateNode`. It starts paused and stops requesting frames when offscreen or when the page is hidden.

## Compared to the cube example {#vs-cube}

| Topic        | [cube-perspective](/example/cube-perspective) | This page                                  |
| ------------ | --------------------------------------------- | ------------------------------------------ |
| Lights       | Renderer default ambient + directional        | Explicit multiple `Light3D` nodes          |
| Objects      | Single white cube                             | Cube, sphere, and cylinder                 |
| Motion       | Mesh rotation only                            | Optional spotlight orbit                   |
| Default tool | Select                                        | Select (`Pick3D` requires the Select tool) |
