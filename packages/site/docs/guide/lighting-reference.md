---
title: Lighting reference
outline: deep
---

# Lighting reference

See [lesson 39](/guide/lesson-039#lighting) for the interactive scene.

## Overview and compatibility

Compare ambient, directional, point, and spot lights on a stationary cube, sphere, and cylinder. Switch lights, adjust intensity/range and the sphere's metallic/roughness values, enable studio environment lighting and cast shadows, or play the spotlight orbit. Point and spot lights can use the original smooth range falloff or opt into inverse-square falloff with a configurable reference distance. The renderer uses GGX direct lighting with sRGB-to-linear inputs and filmic tone mapping. An LDR panorama or Radiance HDR image provides spherical-harmonic diffuse lighting and prefiltered reflections with a split-sum BRDF lookup.

Up to two directional, point, or spot lights with `castShadow: true` cast shadows at once, filtered with 3 × 3 PCF. Each light can set `shadowStrength` (0–1), `shadowSoftness` (0–4 texels), `shadowBiasScale` (0–4), and `shadowNormalBias` (0–10 canvas units); defaults preserve the original appearance. Each mesh can independently opt out of casting or receiving via `material3d.castShadow` and `material3d.receiveShadow` (both default to `true`). Directional maps fit the current meshes; spot cones below 85° half-angle use one perspective map, while wider cones and point lights use six atlas faces. PCF taps at atlas-face seams sample the neighboring face rather than repeating the border texel. See the [lighting example](/example/lighting) for controls, map sizes, and API details.

For self-lit surfaces, `material3d.emissiveFactor` and `emissiveStrength` control emission without adding a scene light. glTF `KHR_materials_emissive_strength` imports and exports with the material; try the cube emission slider in the [lighting example](/example/lighting).

For flat colors independent of illumination, `material3d.unlit` bypasses scene lights and tone mapping while retaining base-color texture and alpha. glTF `KHR_materials_unlit` is preserved on import and GLB export; compare it with emission using the cube toggle in the [lighting example](/example/lighting).

For textured cutouts and translucent surfaces, `material3d.alphaMode` offers `mask` and `blend`; see the [3D mesh transparency example](/example/mesh3d-alpha) for their shadow behavior and ordering limits.

WebGL1 fragment shaders require constant indices when reading uniform arrays.
The renderer generates bounded lookups for light data and shadow matrices on
WebGL1; WebGL2 and WebGPU retain native indexing. Material shading returns its
color to `main()` so the WebGL1 output conversion also runs for unlit materials.
Browser regressions force WebGL1 and check vertex colors, tangent-space normal
maps, multiple lights, and directional/point shadows.

## Parameters and limits

### Light combinations

with no explicit lights, the renderer supplies ambient and directional defaults. Once a light is supplied, only the explicit lights contribute. Up to 8 non-ambient lights render; additional lights are ignored.

### Coordinates and range

positions and directions use canvas world units; in this linked-camera example, smaller z values are closer to the viewer. `direction` points from the light toward the scene.

By default, positive `range` uses the legacy squared range falloff and `range <= 0` disables attenuation. With `attenuation: 'inverse-square'`, intensity falls with squared distance, is capped inside 10% of `referenceDistance`, and fades smoothly to zero at a positive `range`.

`range <= 0` removes only that cutoff. These world units are calibrated by `referenceDistance`, not physical SI light units.

### Spot cone

`innerConeAngle` and `outerConeAngle` are in radians. The outer angle must exceed the inner angle; invalid or equal inputs are sanitized before rendering.

### Color and materials

CSS colors and textures enter as sRGB, lighting runs in linear space, and a filmic tone map precedes sRGB output. `metallic` and `roughness` drive GGX highlights. The material's `ambient` scales both the ambient fill and optional environment reflection; legacy `diffuse`, `specular`, and `shininess` no longer affect shading.

### Environment lighting

`material3d.environmentMap` accepts an equirectangular LDR image or Radiance `.hdr` URL. HDR radiance stays in linear space while the renderer builds second-order spherical harmonics for diffuse light and five importance-sampled GGX roughness levels for reflections.

A cached 64 × 64 split-sum BRDF lookup adds view-angle and roughness-dependent GGX visibility to those reflections. The levels are packed into one RGBM atlas for both WebGL and WebGPU.

The demo lets you compare a generated HDR studio panorama with an LDR SVG. An omitted or failed image preserves the old ambient appearance.

### Cast shadows

set `castShadow: true` on a directional, point, or spot `light3d` node. Up to two enabled eligible lights among the first eight direct lights cast shadows from meshes onto other meshes, including a plane.

Each light gets its own shadow map. Directional shadows fit the meshes.

Spot cones below 85° half-angle use one perspective map; wider cones use six 90° views, as point lights do, packed into a 3 × 2 atlas. The cone still limits spotlight illumination.

Soft shadows use 3 × 3 PCF. Atlas taps crossing a cube-face edge are reprojected into the neighboring face; single-map taps outside the map count as lit.

`shadowStrength` controls darkness from 0 to 1 (default 1); at 0 the light does not allocate a shadow map. `shadowSoftness` controls the PCF sample spacing from 0 to 4 texels (default 1).

At 0, one depth sample produces a hard edge; positive values use 3 × 3 samples. Select “Point + ambient” or “Spot + ambient” to inspect one shadow type; “All lights” combines directional and point shadows.

### Mesh shadow participation

set `material3d.castShadow: false` to keep a `mesh3d` out of every shadow map while still rendering it. Set `material3d.receiveShadow: false` to keep direct lighting on that mesh unshadowed; it can still cast shadows.

Both default to `true` on `Material3D` and `mesh3d` nodes. The demo keeps the floor from casting and lets you toggle the sphere caster and floor receiver separately.

If there are no casting meshes or no receiving meshes, no shadow map is scheduled. Ambient and environment lighting are unaffected by reception.

### Shadow bias

`shadowBiasScale` multiplies the renderer's slope-dependent depth bias (0–4, default 1). Lower values bring shadows closer to their casters but can reveal self-shadow stripes; higher values suppress stripes but can detach shadows.

`shadowNormalBias` moves the receiver sample along its world-space normal in canvas units (0–10, default 0). Increase it only when depth bias alone leaves acne on grazing surfaces.

Both controls are per light and do not change the shadow-map projection or softness.

### Limits

diffuse light uses a 128 × 64 sample and second-order spherical harmonics, so fine detail is lost. The reflection atlas has 128 × 64 pixels at its sharpest level and RGBM stores radiance up to 16.

The BRDF lookup is quantized to RGBA8 and 64 × 64 texels. At most two lights cast shadows: directional and narrow-spot maps are 1024 × 1024; point and wide-spot maps use six 512 × 512 faces.

Further shadow-enabled lights still illuminate the scene without casting shadows. For alpha-tested cutouts and transparent materials, see [3D mesh transparency](/example/mesh3d-alpha).

### Emission

`material3d.emissiveFactor` is linear RGB in the range 0–1. `emissiveStrength` multiplies it, defaults to 1, and accepts nonnegative values above 1.

A glTF material with `KHR_materials_emissive_strength` keeps its strength on import and GLB export. Emission brightens that surface; it does not illuminate nearby meshes or produce bloom.

### Unlit

enable **Unlit cube** to display its base color and texture without direct light, environment light, shadows, emission, or filmic tone mapping. `material3d.unlit` defaults to `false`; glTF `KHR_materials_unlit` is preserved by GLB import and export. Alpha cutout and blending still apply.

### Imported material textures

glTF normal maps change the surface lighting normal; occlusion maps attenuate only ambient and environment light. `doubleSided` also renders back faces with reversed lighting normals. Compare these with a real GLB in the [PBR material example](/example/gltf-duck#pbr-material), including the current tangent-space limitation.

### Animation

the example updates the spotlight via `api.updateNode`. It starts paused and stops requesting frames when offscreen or when the page is hidden.
