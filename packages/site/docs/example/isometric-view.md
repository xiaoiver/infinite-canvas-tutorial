---
title: 'Isometric 3D view'
description: 'Compare true isometric and 2:1 dimetric orthographic camera presets.'
---

# Isometric 3D view

This scene combines a cube, ground plane, lighting, and an extruded SVG path with a hole. Switch between **true isometric** (45° azimuth, 35.264° elevation) and **2:1 dimetric** (45° azimuth, 30° elevation). View height controls the scale; camera distance changes the pose and clipping range without changing the orthographic scale.

Select a mesh to use its 3D gizmo. Choose **Pan / orbit** to drag the view; hold Shift while dragging to orbit at a constrained elevation. The wheel zooms around the ground point under the cursor, Shift + wheel pans, and two fingers pan or pinch to zoom. These camera gestures change only this canvas's 3D view, not the 2D source or undo history. Changing a preset or slider resets the camera pose.

Picking follows the visible 3D depth order, so a cube in front of the ground receives the click. A mesh press takes priority over overlapping 2D source bounds, and selected object names stay screen aligned while the camera moves.

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

The SVG source remains editable in the 2D canvas. The tilted 3D view previews its extruded mesh; direct editing of the source's 2D anchors in this view is still planned.
