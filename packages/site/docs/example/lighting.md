---
title: '3D scene lighting (Light3D)'
description: 'Interactive ambient, directional, point, and spot lighting with adjustable material parameters.'
---

<!-- example-intro:en -->

# 3D scene lighting

This page compares all four `Light3D` types: ambient, directional, point, and spot. The cube, sphere, and cylinder stay still so changes in lighting are easy to see. Each direct-light mode keeps a dim explicit ambient light so unlit faces remain visible. You can adjust the sphere's `metallic` and `roughness`, compare HDR and LDR studio panoramas, change the spotlight cone angle, toggle light shadows, sphere casting, and floor reception independently, tune shadow bias, then play or pause the spotlight orbit.

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

-   **Light combinations**: with no explicit lights, the renderer supplies ambient and directional defaults. Once a light is supplied, only the explicit lights contribute. Up to 8 non-ambient lights render; additional lights are ignored.
-   **Coordinates and range**: positions and directions use canvas world units; in this linked-camera example, smaller z values are closer to the viewer. `direction` points from the light toward the scene. By default, positive `range` uses the legacy squared range falloff and `range <= 0` disables attenuation. With `attenuation: 'inverse-square'`, intensity falls with squared distance, is capped inside 10% of `referenceDistance`, and fades smoothly to zero at a positive `range`. `range <= 0` removes only that cutoff. These world units are calibrated by `referenceDistance`, not physical SI light units.
-   **Spot cone**: `innerConeAngle` and `outerConeAngle` are in radians. The outer angle must exceed the inner angle; invalid or equal inputs are sanitized before rendering.
-   **Color and materials**: CSS colors and textures enter as sRGB, lighting runs in linear space, and a filmic tone map precedes sRGB output. `metallic` and `roughness` drive GGX highlights. The material's `ambient` scales both the ambient fill and optional environment reflection; legacy `diffuse`, `specular`, and `shininess` no longer affect shading.
-   **Environment lighting**: `material3d.environmentMap` accepts an equirectangular LDR image or Radiance `.hdr` URL. HDR radiance stays in linear space while the renderer builds second-order spherical harmonics for diffuse light and five importance-sampled GGX roughness levels for reflections. A cached 64 × 64 split-sum BRDF lookup adds view-angle and roughness-dependent GGX visibility to those reflections. The levels are packed into one RGBM atlas for both WebGL and WebGPU. The demo lets you compare a generated HDR studio panorama with an LDR SVG. An omitted or failed image preserves the old ambient appearance.
-   **Cast shadows**: set `castShadow: true` on a directional, point, or spot `light3d` node. Up to two enabled eligible lights among the first eight direct lights cast shadows from meshes onto other meshes, including a plane. Each light gets its own shadow map. Directional shadows fit the meshes. Spot cones below 85° half-angle use one perspective map; wider cones use six 90° views, as point lights do, packed into a 3 × 2 atlas. The cone still limits spotlight illumination. Soft shadows use 3 × 3 PCF. Atlas taps crossing a cube-face edge are reprojected into the neighboring face; single-map taps outside the map count as lit. `shadowStrength` controls darkness from 0 to 1 (default 1); at 0 the light does not allocate a shadow map. `shadowSoftness` controls the PCF sample spacing from 0 to 4 texels (default 1). At 0, one depth sample produces a hard edge; positive values use 3 × 3 samples. Select “Point + ambient” or “Spot + ambient” to inspect one shadow type; “All lights” combines directional and point shadows.
-   **Mesh shadow participation**: set `material3d.castShadow: false` to keep a `mesh3d` out of every shadow map while still rendering it. Set `material3d.receiveShadow: false` to keep direct lighting on that mesh unshadowed; it can still cast shadows. Both default to `true` on `Material3D` and `mesh3d` nodes. The demo keeps the floor from casting and lets you toggle the sphere caster and floor receiver separately. If there are no casting meshes or no receiving meshes, no shadow map is scheduled. Ambient and environment lighting are unaffected by reception.
-   **Shadow bias**: `shadowBiasScale` multiplies the renderer's slope-dependent depth bias (0–4, default 1). Lower values bring shadows closer to their casters but can reveal self-shadow stripes; higher values suppress stripes but can detach shadows. `shadowNormalBias` moves the receiver sample along its world-space normal in canvas units (0–10, default 0). Increase it only when depth bias alone leaves acne on grazing surfaces. Both controls are per light and do not change the shadow-map projection or softness.
-   **Limits**: diffuse light uses a 128 × 64 sample and second-order spherical harmonics, so fine detail is lost. The reflection atlas has 128 × 64 pixels at its sharpest level and RGBM stores radiance up to 16. The BRDF lookup is quantized to RGBA8 and 64 × 64 texels. At most two lights cast shadows: directional and narrow-spot maps are 1024 × 1024; point and wide-spot maps use six 512 × 512 faces. Further shadow-enabled lights still illuminate the scene without casting shadows. For alpha-tested cutouts and transparent materials, see [3D mesh transparency](/example/mesh3d-alpha).
-   **Animation**: the example updates the spotlight via `api.updateNode`. It starts paused and stops requesting frames when offscreen or when the page is hidden.

## Compared to the cube example {#vs-cube}

| Topic        | [cube-perspective](/example/cube-perspective) | This page                                  |
| ------------ | --------------------------------------------- | ------------------------------------------ |
| Lights       | Renderer default ambient + directional        | Explicit multiple `Light3D` nodes          |
| Objects      | Single white cube                             | Cube, sphere, and cylinder                 |
| Motion       | Mesh rotation only                            | Optional spotlight orbit                   |
| Default tool | Select                                        | Select (`Pick3D` requires the Select tool) |
