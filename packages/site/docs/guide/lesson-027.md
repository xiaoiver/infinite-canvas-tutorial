---
outline: deep
description: 'Snap and align'
head:
    - ['meta', { property: 'og:title', content: 'Lesson 27 - Snap and align' }]
---

<script setup>
import SnapToPixelGrid from '../components/SnapToPixelGrid.vue'
import SnapToObjects from '../components/SnapToObjects.vue'
</script>

# Lesson 27 - Snap and align

Snapping is a common feature in graphics editor applications. The core idea is to automatically align element boundaries or anchor points to the nearest pixel grid lines or other graphics when moving, drawing, or scaling elements. In this lesson, we'll introduce their implementation.

## Snap to pixel grid {#snap-to-pixel-grid}

In [Lesson 5 - Drawing grids], we introduced how to efficiently draw straight-line grids. In some drag interactions such as moving and drawing, snapping to the minimum unit of the grid ensures that the position or geometric information of graphics are integers. This feature is called "Snap to pixel grid" in Figma and can be enabled in "User Preferences".

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

-   Check if the current operation allows snapping ([isSnappingEnabled]).
-   Calculate all snappable points and gaps ([getPointSnaps]).
-   Real-time calculation of snap offsets and guide lines during drag/scale operations ([snapDraggedElements] / [snapResizingElements]).
-   Pass snapLines to the UI layer and render guide lines on the canvas ([renderSnaps]).

Below, we will implement this by following the steps outlined above.

### Is snapping enabled {#is-snapping-enabled}

We have added the following configuration options to the application settings, which can also be enabled in the “Preferences Menu”:

```ts
export interface AppState {
    snapToObjectsEnabled: boolean; // [!code ++]
}
```

Triggered when dragging and moving or drawing shapes:

![source: https://github.com/excalidraw/excalidraw/issues/263#issuecomment-577605528](https://user-images.githubusercontent.com/5153846/72973602-d804ba80-3dcd-11ea-9717-05448160044c.gif)

### Get point snaps {#get-point-snaps}

Snap points are divided into two categories: selected shapes and other shapes. For one or more selected shapes, common snap points include the four corners and the center of the bounding box:

```ts
const { minX, minY, maxX, maxY } = api.getBounds(
    selected.map((id) => api.getNodeById(id)),
);
const boundsWidth = maxX - minX;
const boundsHeight = maxY - minY;
const selectionSnapPoints = [
    new Point(minX, minY), // 4 corners
    new Point(maxX, minY),
    new Point(minX, maxY),
    new Point(maxX, maxY),
    new Point(minX + boundsWidth / 2, minY + boundsHeight / 2), // center
];
```

Considering performance, we should minimize the number of times we detect the attachment points of the selected shape relative to all other shapes. We've already covered similar issues in [Lesson 8 - Using spatial indexing], where we only retrieve shapes within the viewport.

```ts
const unculledAndUnselected = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected));
```

Similarly, calculate the reference points for these shapes:

```ts
const referenceSnapPoints: [number, number][] = unculledAndUnselected
    .map((entity) => getElementsCorners(api, [api.getNodeByEntity(entity).id]))
    .flat();
```

### Get gap snaps {#get-gap-snaps}

Beyond the currently selected shape on the canvas, other shapes may form pairs with gaps between them. The diagram in the Excalidraw code illustrates this well—take `horizontalGap` as an example:

```ts
// https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts#L65C1-L81C3
export type Gap = {
    //  start side ↓     length
    // ┌───────────┐◄───────────────►
    // │           │-----------------┌───────────┐
    // │  start    │       ↑         │           │
    // │  element  │    overlap      │  end      │
    // │           │       ↓         │  element  │
    // └───────────┘-----------------│           │
    //                               └───────────┘
    //                               ↑ end side
    startBounds: Bounds;
    endBounds: Bounds;
    startSide: [GlobalPoint, GlobalPoint];
    endSide: [GlobalPoint, GlobalPoint];
    overlap: InclusiveRange;
    length: number;
};
```

If the bounding box of the selected shape does not overlap with the gap, skip the detection.

```ts
for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.overlap)) {
        continue;
    }
}
```

Detect the center point, right edge, and left edge in sequence:

```ts
// center
if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[0]) {
}
// side right
if (Math.abs(sideOffsetRight) <= minOffset[0]) {
}
// side left
if (Math.abs(sideOffsetLeft) <= minOffset[0]) {
}
```

### Render snap lines {#render-snap-lines}

Render snap lines in SVG container, see: [Lesson 26 - Lasso selection].

```ts
renderSnapLines(
    api: API,
    snapLines: { type: string; points: [number, number][] }[],
) {
    const { svgSVGElement } = this.selections.get(api.getCamera().__id);
    this.clearSnapLines(api);

    snapLines.forEach(({ type, points }) => {
        if (type === 'points') {
            const pointsInViewport = points.map((p) =>
                api.canvas2Viewport({ x: p[0], y: p[1] }),
            );
            const line = createSVGElement('polyline') as SVGPolylineElement;
            svgSVGElement.appendChild(line);
        }
    });
}
```

<SnapToObjects />

## Extended reading {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[Lesson 5 - Draw grids]: /guide/lesson-005
[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Snap to grid in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
[isSnappingEnabled]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L162C14-L162C31
[getPointSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L636
[snapDraggedElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L692
[snapResizingElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L1108C14-L1108C34
[renderSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts
[Lesson 8 - Using spatial indexing]: /guide/lesson-008#using-spatial-indexing
[Lesson 26 - Lasso selection]: /guide/lesson-026#lasso-selection
