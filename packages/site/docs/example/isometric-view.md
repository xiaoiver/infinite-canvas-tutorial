---
title: 'Isometric 3D view'
description: 'Compare true isometric and 2:1 dimetric orthographic camera presets.'
---

# Isometric 3D view

This scene combines a cube, ground plane, lighting, and an extruded SVG path with a hole. Switch between **true isometric** (45° azimuth, 35.264° elevation) and **2:1 dimetric** (45° azimuth, 30° elevation). View height controls the scale; camera distance changes the pose and clipping range without changing the orthographic scale.

Select a mesh to use its 3D gizmo. Choose **Pan** to move the view or **Orbit** to turn it at a constrained elevation. Both tools work with a mouse, pen, or one-finger touch drag. Shift + drag with Pan also orbits. The wheel zooms around the ground point under the cursor, Shift + wheel pans, and two fingers pan or pinch to zoom. These camera gestures change only this canvas's 3D view, not the 2D source or undo history. Changing a preset or slider resets the camera pose.

Picking follows the visible 3D depth order, so a cube in front of the ground receives the click. A mesh press takes priority over overlapping 2D source bounds, and selected object names stay screen aligned while the camera moves.

With **Select**, drag from empty space to marquee-select 3D objects. Hold **Shift** to start a marquee over the ground or another mesh. The rectangle uses each mesh's projected screen bounds and updates selection while dragging. Objects must be fully enclosed, so a small marquee does not select the large ground mesh.

Choose **Draw box** and drag on the canvas to place a 3D box. **Edit plane Z** sets the height of its bottom face; **Box depth** sets its extrusion above that plane. The four-corner preview follows the plane under the pointer, even after changing the camera pose. Release to create a selectable mesh. A tap or a very short drag creates nothing.

Choose **Edit SVG anchors** to drag the orange ring's outer vertices or the inner hole's vertices directly on its front face. The source Path and its extruded mesh update together as you drag. Click **Tilt SVG** to rotate the extrusion in 3D, then drag the same anchors on the rotated face. The camera can still pan and orbit from the background. Other imported SVG primitives are not editable as Path anchors in this example.

Turn on **Show callouts** to label the cube and the extruded SVG. Each screen-facing label has a leader anchored to the live 3D mesh or Path vertex. It follows camera movement, mesh transforms, and SVG anchor edits; labels for anchors outside the viewport are hidden. Turn the overlay off when editing without annotations. These are DOM/SVG overlays and do not participate in 3D depth testing.

Turn on **Stepped tones** to quantize lit luminance into four bands on both objects. This is applied in the 3D material shader after lighting and tone mapping, so geometry, shadows, picking, and depth ordering remain the same. Turn it off to restore continuous PBR shading. The unlit material mode ignores this setting. Mesh nodes accept `material3d.toneSteps`, and extruded Path/rect nodes accept `extrude3d: { toneSteps }`; valid values are 2–8, while 0 or an omitted value disables banding.

Turn on **Show outlines** for a dark silhouette around the cube and the orange SVG ring, including its hole. The renderer expands back faces in screen space and tests them against the existing 3D depth buffer, so foreground geometry hides outlines behind it. Mesh nodes accept `material3d: { outlineWidth: 2, outlineColor: '#1e3264' }`; extruded Path/rect nodes accept the same fields in `extrude3d`. Width is in screen pixels, from 0 (off) to 8. This pass supports opaque meshes in a free 3D camera; alpha blended and alpha masked materials are excluded. Standard glTF export uses PBR materials and does not retain the tone or outline settings.

Turn on **Rim light** to tint visible surfaces near their view-facing edges. The material shader derives the tint from the surface normal and view direction, after normal lighting and tone mapping. It follows camera orbit and uses the mesh's existing depth and alpha rules; it is a surface highlight, not a blurred glow outside the silhouette. Mesh nodes accept `material3d: { rimLightStrength: 0.9, rimLightColor: '#9ad9ff' }`, and extruded Path/rect nodes accept the same fields in `extrude3d`. Strength is 0 (off) to 1. Unlit materials ignore it, and standard glTF export does not retain it.

<script setup>
import IsometricView from '../components/IsometricView.vue'
</script>

<IsometricView />

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
