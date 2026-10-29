---
title: '3D scene lighting (Light3D)'
description: 'Interactive ambient, directional, point, and spot lighting with adjustable material parameters.'
---

<!-- example-intro:en -->

# 3D scene lighting

Compare ambient, directional, point and spot lights on a stationary cube, sphere and cylinder. Each direct-light mode includes a dim ambient light so the unlit faces remain visible.

-   Switch lights and adjust their intensity or range.
-   Change the sphere's metallic and roughness values, or compare HDR and LDR environment maps.
-   Toggle shadows and adjust their bias; play the spotlight animation or increase **Cube emission** to compare a self-lit surface.

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
            castShadow: true,
            receiveShadow: true,
        },
        camera3d: { linked: true, projection: 'perspective' },
    },
]);
```

For inverse-square falloff on a point or spot light, set `attenuation: 'inverse-square'` and choose a positive `referenceDistance` in canvas world units. At that distance the inverse-square factor is 1; the default is 100. The interactive example switches between the two falloff modes.

```ts
const lamp = api.getNodeById('lamp');
if (lamp) {
    api.updateNode(lamp, {
        attenuation: 'inverse-square',
        referenceDistance: 100,
        shadowStrength: 0.6,
        shadowSoftness: 2,
        shadowBiasScale: 0.75,
        shadowNormalBias: 1,
    });
}
```

## Notes {#notes}

-   **Lights:** without explicit lights the renderer uses default ambient and directional lights. Explicit lights replace them; up to eight direct lights are supported.
-   **Materials:** adjust `metallic` and `roughness`, or use an LDR/HDR `environmentMap`. Use `emissiveFactor` / `emissiveStrength` for emission and `unlit` for surfaces unaffected by lighting.
-   **Shadows:** up to two eligible direct lights can cast shadows. Each mesh can independently cast or receive them.
-   **Distance:** point and spot lights support the default range attenuation or `inverse-square` with a `referenceDistance`.

See the [lighting reference](/guide/lighting-reference#parameters-and-limits) for all controls, defaults and limits.

## Compared to the cube example {#vs-cube}

| Topic        | [cube-perspective](/example/cube-perspective) | This page                                  |
| ------------ | --------------------------------------------- | ------------------------------------------ |
| Lights       | Renderer default ambient + directional        | Explicit multiple `Light3D` nodes          |
| Objects      | Single white cube                             | Cube, sphere, and cylinder                 |
| Motion       | Mesh rotation only                            | Optional spotlight orbit                   |
| Default tool | Select                                        | Select (`Pick3D` requires the Select tool) |
