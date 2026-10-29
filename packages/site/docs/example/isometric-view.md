---
title: 'Isometric 3D view'
description: 'Compare true isometric and 2:1 dimetric orthographic camera presets.'
---

# Isometric 3D view

Compare **true isometric** (45° azimuth, 35.264° elevation) and **2:1 dimetric** (45° azimuth, 30° elevation). View height controls orthographic scale.

Select an object to use its 3D gizmo; use Pan or Orbit to adjust the camera. The wheel zooms, and two fingers pan or pinch to zoom. You can also draw boxes, edit SVG anchors and switch lighting or style effects.

<script setup>
import IsometricView from '../components/IsometricView.vue'
</script>

<IsometricView />

::: details More interaction and style details

Camera distance changes the pose and clipping range without changing orthographic scale. Changing a preset or slider resets the pose. Camera gestures affect only this canvas's 3D view, not the 2D source or undo history.

Pan and Orbit support a mouse, pen or one-finger drag. Shift + drag with Pan also orbits; the wheel zooms around the ground point under the cursor, and Shift + wheel pans.

Click **Auto orbit** to turn the camera slowly from its current pose while preserving its elevation, target and orthographic view height. Click again to hold the current view. Choosing a tool, pressing the canvas or using the wheel stops the preview so you can edit immediately. The animation pauses while the tab is hidden or the example is outside the viewport, and can run alongside the moving spotlight. Both previews share one rate-limited frame loop and do not add document undo entries.

Select multiple 3D objects to get one gizmo at their center. Drag its yellow diamond upward to enlarge the selection or downward to shrink it uniformly. Mesh scale, the SVG Path's 2D scale, and extrusion depth are saved together as one undo step; dragging leaves the SVG hole intact. Escape cancels the preview.

Picking follows the visible 3D depth order, so a cube in front of the ground receives the click. A mesh press takes priority over overlapping 2D source bounds, and selected object names stay screen aligned while the camera moves.

With **Select**, drag from empty space to marquee-select 3D objects. Hold **Shift** to start a marquee over the ground or another mesh. The rectangle uses each mesh's projected screen bounds and updates selection while dragging. Objects must be fully enclosed, so a small marquee does not select the large ground mesh.

Choose **Draw box** and drag on the canvas to place a 3D box. **Edit plane Z** sets the height of its bottom face; **Box depth** sets its extrusion above that plane. The four-corner preview follows the plane under the pointer, even after changing the camera pose. Release to create a selectable mesh. A tap or a very short drag creates nothing.

Choose **Edit SVG anchors** to drag the orange ring's outer vertices or the inner hole's vertices directly on its front face. The source Path and its extruded mesh update together as you drag. Click **Tilt SVG** to rotate the extrusion in 3D, then drag the same anchors on the rotated face. The camera can still pan and orbit from the background. Other imported SVG primitives are not editable as Path anchors in this example.

Turn on **Show callouts** to label the cube and the extruded SVG. Each screen-facing label has a leader anchored to the live 3D mesh or Path vertex. It follows camera movement, mesh transforms, and SVG anchor edits; labels for anchors outside the viewport are hidden. Turn the overlay off when editing without annotations. These are DOM/SVG overlays and do not participate in 3D depth testing.

Turn on **Stepped tones** to quantize lit luminance into four bands on both objects. This is applied in the 3D material shader after lighting and tone mapping, so geometry, shadows, picking, and depth ordering remain the same. Turn it off to restore continuous PBR shading. The unlit material mode ignores this setting. Mesh nodes accept `material3d.toneSteps`, and extruded Path/rect nodes accept `extrude3d: { toneSteps }`; valid values are 2–8, while 0 or an omitted value disables banding.

Turn on **Show outlines** for a dark silhouette around the cube and the orange SVG ring, including its hole. The renderer expands back faces in screen space and tests them against the existing 3D depth buffer, so foreground geometry hides outlines behind it. Mesh nodes accept `material3d: { outlineWidth: 2, outlineColor: '#1e3264' }`; extruded Path/rect nodes accept the same fields in `extrude3d`. Width is in screen pixels, from 0 (off) to 8. This pass supports opaque meshes in a free 3D camera; alpha blended and alpha masked materials are excluded. Standard glTF export uses PBR materials and does not retain the tone or outline settings.

Turn on **Rim light** to tint visible surfaces near their view-facing edges. The material shader derives the tint from the surface normal and view direction, after normal lighting and tone mapping. It follows camera orbit and uses the mesh's existing depth and alpha rules; it is a surface highlight, not a blurred glow outside the silhouette. Mesh nodes accept `material3d: { rimLightStrength: 0.9, rimLightColor: '#9ad9ff' }`, and extruded Path/rect nodes accept the same fields in `extrude3d`. Strength is 0 (off) to 1. Unlit materials ignore it, and standard glTF export does not retain it.

Turn on **Moving spotlight** to sweep a warm light across the cube, SVG ring and ground. The light is an ordinary shadow-casting `light3d` node: each animation frame changes its position and direction, while mesh geometry stays in place. It starts off, pauses when the tab is hidden or the example leaves the viewport, and can be turned off on slower devices. The motion is a preview effect and does not add an undo step for every frame.

:::

## Camera API

```ts
api.setCamera3D({
    preset: 'isometric', // or 'dimetric-2-1'
    center: [245, 180, 15],
    distance: 650,
    orthographicHeight: 380,
    clearColor: false,
});
```

`setCamera3D` sets a canvas-owned view, so another mesh cannot replace it. The same fields can be placed in a `mesh3d` node's `camera3d` object for a simple declarative scene. The canvas-owned view takes priority when both are present. The preset uses a free, Z-up orthographic camera. Without a preset, existing linked camera settings keep their original behavior. `orthographicHeight` is only used by a free orthographic camera.

For a custom toolbar, set `penbarSelected: Pen.ORBIT_3D` to orbit a free orthographic 3D view with a single pointer. `Pen.HAND` still pans, and Shift + drag with Hand still orbits. Orbit mode leaves linked and perspective cameras unchanged.

For custom drawing gestures, `api.viewport2WorldOnPlane({ x, y }, planeZ)` intersects a viewport pointer with a constant-Z plane. `api.world3D2Viewport([x, y, z])` projects a world point back into viewport pixels for overlays. Both use the render camera matrix and return `null` without a free orthographic canvas camera or for invalid input. Convert browser coordinates with `api.client2Viewport` first.

For extruded Path anchors, `api.pathLocal2Viewport3D(node, [x, y])` projects a local Path point on the companion mesh's front face. `api.viewport2PathLocal3D(node, { x, y })` intersects that face using the render camera's ray and solves the source's local coordinates, including parent shear and 3D rotation. These return `null` when the companion mesh is not ready, the source transform is singular, or the view ray is parallel to the face. They work with imported SVG paths and ordinary Path nodes. Use `normalizePathCommands`, `collectPathControlHandles`, `setPathHandlePoint`, and `toPathData` to edit `d`; update the node during the drag and call `api.record()` once on release.
