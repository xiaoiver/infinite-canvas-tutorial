---
outline: deep
description: 'Snap and align'
head:
    - ['meta', { property: 'og:title', content: 'Lesson 27 - Snap and align' }]
---

<script setup>
import SnapToPixelGrid from '../components/SnapToPixelGrid.vue'
</script>

# Lesson 27 - Snap and align

Snapping is a common feature in graphics editor applications. The core idea is to automatically align element boundaries or anchor points to the nearest pixel grid lines or other graphics when moving, drawing, or scaling elements. In this lesson, we'll introduce their implementation.

## Snap to pixel grid {#snap-to-pixel-grid}

In [Lesson 5 - Drawing Grids], we introduced how to efficiently draw straight-line grids. In some drag interactions such as moving and drawing, snapping to the minimum unit of the grid ensures that the position or geometric information of graphics are integers. This feature is called "Snap to pixel grid" in Figma and can be enabled in "User Preferences".

![source: [Snap to grid in Excalidraw] ](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

To implement this feature, we first need to calculate the coordinates of points in the world coordinate system. When users drag, scale, or draw graphics, we get the current coordinates (such as x, y), then round these coordinates to the nearest integer (pixel point) or the specified grid spacing:

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

Then apply this processing function in all Systems that need to calculate coordinates of points in the world coordinate system (such as Select, DrawRect):

```ts
let { x: sx, y: sy } = api.viewport2Canvas({
    x: prevX,
    y: prevY,
});
let { x: ex, y: ey } = api.viewport2Canvas({
    x,
    y,
});
const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState(); // [!code ++]
// [!code ++]
if (snapToPixelGridEnabled) {
    // [!code ++]
    sx = snapToGrid(sx, snapToPixelGridSize);
    // [!code ++]
    sy = snapToGrid(sy, snapToPixelGridSize);
    // [!code ++]
    ex = snapToGrid(ex, snapToPixelGridSize);
    // [!code ++]
    ey = snapToGrid(ey, snapToPixelGridSize);
    // [!code ++]
}
```

In the example below, we set `snapToPixelGridSize` to 10. You can experience the effect by dragging, moving, and drawing:

<SnapToPixelGrid />

## Object-level snapping {#snap-to-objects}

The implementation of snapping functionality in Excalidraw is divided into the following key steps:

-   Check if the current operation allows snapping (isSnappingEnabled).
-   Calculate all snappable points and gaps (getPointSnaps/getGapSnaps).
-   Real-time calculation of snap offsets and guide lines during drag/scale operations (snapDraggedElements/snapResizingElements).
-   Pass snapLines to the UI layer and render guide lines on the canvas (renderSnaps.ts).

## Extended reading {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[Lesson 5 - Drawing grids]: /guide/lesson-005
[Snap to grid in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
