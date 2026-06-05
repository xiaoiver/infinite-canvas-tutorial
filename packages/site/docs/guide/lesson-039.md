---
outline: deep
description: 'Layer true 3D mesh rendering on the existing 2D infinite canvas: unified 3D space, Camera3D, and MeshPipeline3D.'
---

<script setup>
import Cube from '../components/Cube.vue'
import CubePerspective from '../components/CubePerspective.vue'
import Lighting from '../components/Lighting.vue'
</script>

# Lesson 39 - 3D Mesh Rendering

Before [Lesson 30 - Post-processing and render graph], everything on the canvas went through the 2D pipeline: orthographic camera, SDFs, path triangulation fills, and so on. This lesson adds a 3D mesh branch without replacing that 2D renderer: vertices carry normals, perspective/orthographic projection, depth testing, and compositing with 2D layers on the same canvas.

## Framer, Spline, Rive, and Bevy {#framer-spline-rive-bevy}

The core ideas behind 2D/3D fusion in Framer and Spline can be summarized as two technical paths—each product picks a different architecture based on its positioning.

Framer’s 3D capability is essentially an enhanced wrapper around CSS 3D transforms, not a real 3D rendering pipeline. That means no external 3D model import (GLB/OBJ), no real lighting, shadows, or material system—3D effects are limited to simple cases like card flips and parallax layers. See: [How to Turn 2D Elements into Interactive 3D Objects in Framer]

![source: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

Spline is a true 3D editor whose architecture is closer to a game engine. Spline lets you create standalone [UI Scenes] (2D canvases) and use them as textures on UI Frame objects in a 3D scene. [Working with 2D and 3D objects]

![source: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

Rive is still fundamentally a 2D tool today. Its “3D feel” comes from 2.5D transforms, mesh deformation, and similar tricks—not a full 3D pipeline.

Our approach is closer to [2D Rendering in Bevy]: 2D shapes live on the **z = 0** plane and 3D models share the same world; when you pan/zoom the 2D camera, the 3D camera can optionally follow. See the implementation in [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271).

## Architecture overview {#architecture}

```plaintext
Same WebGL/WebGPU context
  └─ MeshPipeline render graph
       ├─ Pass: 3D (MeshPipeline3D.drawMeshes)
       ├─ Pass: 3D Gizmo (RenderGizmo3D.drawGizmos, on top of meshes)
       ├─ Pass: grid / 2D vector (existing BatchManager)
       └─ Pass: post-processing → present
```

-   **`Renderer3DPlugin`**: registers 3D components and schedules `MeshPipeline3D` (GPU cache), **`CameraSync`** (2D camera coupling), **`Pick3D`** (selection/drag), and **`RenderGizmo3D`** (transform gizmo drawing).
-   **`MeshPipeline3D`**: does not present its own swapchain; inside `MeshPipeline`’s main pass it **draws 3D first, then 2D**, sharing color and depth attachments.
-   The existing **`Mesh.ts`** is still **2D vector fill**—do not confuse it with 3D `Mesh3D`.

Plugin setup:

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

## Core components {#components}

| Component         | Role                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`; when `linked`, `CameraSync` follows 2D pan/zoom                   |
| **`Mesh3D`**      | `positions`, `normals`, optional `indices` (triangle mesh)                                                       |
| **`Material3D`**  | Blinn-Phong: `baseColor`, `ambient`, `diffuse`, `specular`, `shininess`                                          |
| **`Light3D`**     | `ambient` / `directional` / `point` / `spot`; see [Scene lighting example](/example/lighting)                    |
| **`Transform3D`** | translation, Euler rotation, scale                                                                               |
| **`Selected3D`**  | 3D selection state: gizmo mode, active axis/plane, drag reference point, etc. (see [3D transform Gizmo](#gizmo)) |
| **`Mat4`**        | 4×4 matrix helpers (`perspective` / `ortho` / `lookAt`)                                                          |

Spawn entities via ECS `commands.spawn`, for example:

```ts
import {
    Camera3D,
    Mesh3D,
    Material3D,
    Transform3D,
} from '@infinite-canvas-tutorial/ecs';

commands.spawn(
    new Camera3D({
        eye: [3, 3, 5],
        center: [0, 0, 0],
        clearColor: true,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        baseColor: [0.25, 0.55, 0.95, 1],
        ambient: 0.15,
        diffuse: 0.75,
        specular: 0.4,
        shininess: 48,
    }),
    new Transform3D({
        translation: [0, 0, 0],
        rotation: [0.3, 0.6, 0],
        scale: [1, 1, 1],
    }),
);
```

## Unified 3D space (linked camera) {#unified-space}

To **pan/zoom the canvas and move 2D and 3D together**, set `linked: true` on `Camera3D`.

Each frame, `CameraSync` reads 2D `ComputedCamera` `(x, y, zoom)` and writes the 3D camera’s `eye` / `center` / `baseDistance`:

-   Zoom: `baseDistance = canvas.height / 2`, `eye.z = baseDistance / zoom`, matching the visible height of 2D `mat3.projection` at z = 0
-   **Linked orthographic** (`projection: 'orthographic'`): `eye = [x, -y, distance]`, `center = [x, -y, 0]` (2D canvas Y is down, 3D world Y is up—flipped via `canvasWorldToWorld3D`)
-   **Linked perspective** (`projection: 'perspective'`): `eye = [x, y, distance]`, `center = [x, y, 0]` (same as 2D nodes—**canvas coordinates, Y down**)

### Linked + orthographic {#linked-orthographic}

`MeshPipeline3D` uses the 2D `viewProjectionMatrix` directly (including Y flip, pan, and zoom), which keeps `extrude3d` and 2D rects strictly aligned.

The [Cube (orthographic)](/example/cube) example uses **linked + orthographic** (`translation: [200, 100, 40]`).

<Cube />

### Linked + perspective {#linked-perspective}

In perspective mode, screen position comes from the **full 2D VP** (pan, zoom, and Y flip match 2D); depth uses a perspective matrix on `Transform3D.translation.z` for foreshortening. The anchor is `(x, y, z)` from `translation`, so the object lands at the same `(x, y)` as in 2D.

[Cube (perspective)](/example/cube-perspective) uses the **linked + perspective** setup above; when you drag the canvas, the cube should pan and zoom with the 2D layers.

<CubePerspective />

## Raycast picking {#raycast-picking}

3D selection and gizmo interaction are handled by the **`Pick3D`** system (also used from **`Select`** when the Select tool is active). On pointer down, the viewport pixel under the cursor is tested against gizmo handles and `Mesh3D` triangles. No GPU picking pass is used—everything runs on the CPU in `ray-casting.ts` and `pick3d-probe.ts`.

### Pipeline

```plaintext
viewport (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene (same matrices as rendering)
       └─ probePick3DAtViewport(…)
            ├─ 1. gizmo parts on Selected3D entities (screen-space / ray, per part)
            └─ 2. all Mesh3D on this canvas → keep closest hit (smallest t)
```

**Priority**: already-selected entities are probed for **gizmo handles first**; only if none hit does the probe test scene meshes. Among meshes, the hit with the **smallest distance** along the ray (or largest depth in linked perspective) wins.

### Standard raycast (orthographic / free camera)

For non–linked-perspective modes, picking mirrors classic 3D editors:

1. **`screenToRay`**: viewport pixels → NDC → unproject near/far with **`inv(view × projection)`** to get a world-space ray.
2. **`rayMeshIntersection`**: transform mesh vertices with the entity’s model matrix, then:
    - **Broad phase**: ray vs transformed **AABB** (slab method).
    - **Narrow phase**: **Möller–Trumbore** ray–triangle test on each triangle; keep the closest `t`.

```ts
// packages/ecs/src/utils/ray-casting.ts (simplified)
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

**Linked orthographic** (`linked + orthographic`) reuses the same path: `MeshPipeline3D` feeds the 2D `viewProjectionMatrix` into the pick scene, so clicks stay aligned with 2D rects and `extrude3d`.

### Linked perspective: screen-space triangles

**Linked perspective** does **not** use a world ray for mesh hits. Screen position is driven by the full 2D VP; depth comes from a separate perspective matrix on `translation.z`. To match the vertex shader, **`pickMeshLinkedPerspective`** projects each triangle to viewport space with the same uniforms, then tests whether the cursor lies inside the **2D projected triangle** (`pointInTriangle2D`) and picks the **front-most depth** at that pixel. Gizmo parts in this mode reuse the same helper (with optional Z screen bias for handles).

This keeps “what you see is what you pick” when panning/zooming the infinite canvas with a perspective cube.

### Drag constraints

After a gizmo hit, **`Pick3D.handleDrag`** keeps casting a ray each frame and intersects it with a **constraint plane** (`intersectRayWithPlane`):

-   **Translate** (arrow / plane): plane normal follows the active axis or plane widget.
-   **Rotate** (ring): plane normal is the ring’s rotation axis; angle delta comes from `angleOnRotationPlane`.

The delta from the initial hit point (`dragHitStart`) is written back to **`Transform3D`**.

See [3D transform Gizmo](#gizmo) for handle colors, axes, and the full pointer flow.

## 3D transform Gizmo {#gizmo}

With the **Select tool** (`penbarSelected === Pen.SELECT`), clicking a 3D mesh adds **`Selected3D`** to the entity and draws **translate** handles at its center: red/green/blue arrows plus semi-transparent plane widgets. Dragging a handle writes back to **`Transform3D.translation`**. Similar to 2D `Selected` + `RenderTransformer`, but through a separate 3D pick and draw path.

### Interaction flow {#gizmo-flow}

```plaintext
pointer down (Select tool)
  └─ Pick3D.handlePointerDown
       ├─ probePick3DAtViewport: gizmo first, then Mesh3D
       ├─ hit gizmo → record activeAxis, dragHitStart, dragging = true
       └─ hit mesh → add Selected3D; miss → remove existing Selected3D

pointer move (held)
  └─ Pick3D.handleDrag: ray vs constraint plane, delta = current hit − dragHitStart

pointer up
  └─ end drag, clear activeAxis / dragHitStart
```

### Coordinates and handle meaning {#gizmo-axes}

Consistent with [Unified 3D space](#unified-space), the gizmo uses **canvas coordinates (Y down)**, not Blender-style Y-up:

| Color | Axis | Direction (typical linked canvas view) | Drag updates    |
| ----- | ---- | -------------------------------------- | --------------- |
| Red   | +X   | right                                  | `translation.x` |
| Green | +Y   | down                                   | `translation.y` |
| Blue  | +Z   | **depth** (`z+` into the screen)       | `translation.z` |

-   **Arrows**: translate along a single axis.
-   **Planes** (`xy` / `xz` / `yz` semi-transparent squares): move two components at once (e.g. `xy` = X and Y only, not Z).

-   **Combined mode `transform` (default, Spline-like)**: show translate arrows/planes **and** rotation rings at the same time; whichever handle you grab runs that operation (`activePartKind`: `translate` | `rotate`)—no `W` / `E` mode switch.
-   Drag **arrow / plane** → updates `Transform3D.translation`; drag **ring** → updates `Transform3D.rotation` (local Euler angles, same as the mesh).
-   Rings follow the object’s current orientation; arrows stay in canvas world axes (X right, Y down, Z depth).
-   Picking uses screen-space **nearest** hit; when overlapping, arrows are on top so translate wins. `scale` is reserved for later.

## Lighting {#lighting}

Demonstrates `Light3D` with Blinn-Phong materials: ambient fill, a cool directional light, a warm spotlight orbiting the scene center, and three cubes with different specular settings to compare highlights and shading.

<Lighting />

## Further reading {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html) (plugin layering reference)

[Lesson 30 - Post-processing and render graph]: /guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
