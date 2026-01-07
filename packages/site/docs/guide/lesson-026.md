---
outline: deep
description: 'Implement selection tools.'
publish: false
---

<script setup>
import MultiSelection from '../components/MultiSelection.vue'
import Lasso from '../components/Lasso.vue'
</script>

# Lesson 26 - Selection tool

In [Lesson 14 - Selection Mode] we only implemented simple click-to-select functionality for individual shapes. In this lesson, we will continue to improve the selection tool by adding multi-selection, marquee selection, and lasso functionality.

## Multi-selection {#multi-selection}

Based on individual click selection, holding <kbd>Shift</kbd> allows adding/removing additional shapes to the current selection.

![Hold <kbd>Shift</kbd> to select multiple layers in Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042572c7d3a0cb93253d5/file-TQrRIcwMNR.gif)

In selection mode, we determine whether to preserve the current selection based on the `input.shiftKey` state (whether <kbd>Shift</kbd> is pressed): if not pressed, switch to single selection; if pressed, add the target shape to the existing selection:

```ts
if (selection.mode === SelectionMode.SELECT) {
    if (layersSelected.length > 1 && layersSelected.includes(selected.id)) {
        // deselect if already selected in a group
        api.deselectNodes([selected]);
    } else {
        api.selectNodes([selected], input.shiftKey); // whether to add to existed selection
    }
}
```

In [Lesson 21 - Transformer] we implemented single shape selection. Next, we need to add a Group display for multiple selected shapes. Unlike the single-selection Transformer, the multi-selection Group doesn't need to consider `rotation` and `scale`.

```ts
export class RenderTransformer extends System {
    getOBB(camera: Entity): OBB {
        const { selecteds } = camera.read(Transformable);

        // Single selected, keep the original OBB include rotation & scale.
        if (selecteds.length === 1 && selecteds[0].has(ComputedBounds)) {
            const { obb } = selecteds[0].read(ComputedBounds);
            return obb;
        }

        // [!code ++]
        if (selecteds.length > 1) {
            // [!code ++]
        }
    }
}
```

The effect is as follows. The logic for transforming all selected shapes during resize was already introduced in [Lesson 21 - Transform Shapes], so we won't repeat it here:

<MultiSelection />

## Marquee selection {#marquee-selection}

The following image is from [Select layers and objects in Figma]

![Selection marquee in Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042ec04286350d088ba04/file-tAFIn9Cimd.gif)

This marquee selection tool is called "marquee", see: [Make selections with the Rectangular Marquee tool]. We call the formed rectangular area a Brush.

When marquee selection ends (mouse up), we first need to hide the Brush rectangle (we'll see its implementation in the next section), then use the fast picking method introduced in [Lesson 8 - Using Spatial Indexing for Acceleration]. It's worth noting that since the rectangle's width and height might be negative (depending on drag direction), we need to perform some calculations to ensure the BBox is valid:

```ts
if (input.pointerUpTrigger) {
    if (selection.mode === SelectionMode.BRUSH) {
        // Hide Brush...

        if (selection.brush) {
            const { x, y, width, height } = selection.brush.read(Rect);
            // Make a valid BBox
            const minX = Math.min(x, x + width);
            const minY = Math.min(y, y + height);
            const maxX = Math.max(x, x + width);
            const maxY = Math.max(y, y + height);
            const selecteds = api
                .elementsFromBBox(minX, minY, maxX, maxY) // Use space index
                .filter((e) => !e.has(UI))
                .map((e) => api.getNodeByEntity(e));
            api.selectNodes(selecteds); // Finish selection
        }
    }
}
```

During the marquee selection process, we also want to show the selection status in real-time through highlighting and Transformer. Based on the picking and selection logic above, we add highlighting:

![Highlight when brushing](/brush.gif)

```ts
api.selectNodes(selecteds);
// [!code ++]
if (needHighlight) {
    api.highlightNodes(selecteds); // [!code ++]
}
```

Of course, for components within the viewport space, we can also implement them using SVG, as we'll see in the subsequent Lasso tool.

## Deselect with Esc {#deselect-with-esc}

Pressing <kbd>Esc</kbd> in selected state will cancel the selection. Additionally, during marquee selection, we need to hide the Brush:

```ts
if (input.key === 'Escape') {
    api.selectNodes([]);
    if (selection.mode === SelectionMode.BRUSH) {
        this.hideBrush(selection);
    }
}
```

## Lock and unlock layers {#lock-and-unlock-layers}

Locked layers cannot be selected. For details, see: [Lock and unlock layers]

## Lasso selection {#lasso-selection}

Compared to the Rectangular Marquee Tool, the Lasso Tool enables more precise selections by creating irregular polygons.

-   [Feature Request: Lasso Selection (free selection) in Excalidraw]
-   [lasso-tool-figma]

In AI-based image editing, the lasso tool can also create masks with greater precision to perform inpainting. The image below shows the effect in Figma, where selected areas can be erased or separated into layers:

![source: https://help.figma.com/hc/en-us/articles/24004542669463-Make-or-edit-an-image-with-AI#h_01KBJQAF0G6X98H5JJ8GBAPTGP](https://help.figma.com/hc/article_attachments/36912285044247)

### Draw lasso {#draw-lasso}

In [Lesson 25 - Pencil Tool], we covered how to freely draw polyline paths. We continue to draw lasso paths within the SVG container, typically represented by dashed lines with animation effects (ant line).

```html
<path d="...">
    <animate
        attribute-name="stroke-dashoffset"
        stroke-dasharray="7 7"
        stroke-dashoffset="10"
        from="0"
        to="-14"
        dur="0.3s"
    />
</path>
```

First, convert the point coordinates from the viewport coordinate system to the canvas coordinate system. Then simplify the path based on the current camera zoom level—obviously requiring finer selection granularity at high zoom levels and vice versa. Additionally, fewer vertices improve both rendering performance and the efficiency of subsequent intersection detection:

```ts
import simplify from 'simplify-js';

let lassoPath = super
    .getCurrentTrail()
    ?.originalPoints?.map((p) => ({ x: p[0], y: p[1] }));

const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
selectByLassoPath(simplify(lassoPath, simplifyDistance).map((p) => [p.x, p.y]));
```

<Lasso />

### Intersection detection of polygons {#polygon-intersection}

Now that we've created a Path, we need to retrieve the geometry intersecting it in the scene. As before, we'll start by using [Lesson 8 - Using Spatial Indexing for Acceleration].

```ts
function selectByLassoPath(api: API, lassoPath: [number, number][]) {
    const lassoBounds = lassoPath.reduce(
        (acc, item) => {
            return [
                Math.min(acc[0], item[0]),
                Math.min(acc[1], item[1]),
                Math.max(acc[2], item[0]),
                Math.max(acc[3], item[1]),
            ];
        },
        [Infinity, Infinity, -Infinity, -Infinity],
    ) as [number, number, number, number];

    // Hit-test with rbush
    const elements = api.elementsFromBBox(
        lassoBounds[0],
        lassoBounds[1],
        lassoBounds[2],
        lassoBounds[3],
    );

    // TODO: filter locked elements
}
```

After passing the rapid bounding box detection, two scenarios must be handled: the lasso is entirely within the graphic; the lasso intersects with the graphic.

```ts
function isPolygonsIntersect(points1: number[][], points2: number[][]) {
    let isIn = false;
    // Determine whether a point lies inside a polygon. If any point is inside another polygon, return true.
    points2.forEach((point) => {
        if (isPointInPolygon(points1, point[0], point[1])) {
            isIn = true;
            return false;
        }
    });
    if (isIn) {
        return true;
    }
}
```

## Extended reading {#extended-reading}

-   [How do I determine if two convex polygons intersect?]

[Lesson 14 - Selection Mode]: /guide/lesson-014#select-mode
[Lesson 21 - Transformer]: /guide/lesson-021
[Lesson 21 - Transform Shapes]: /guide/lesson-021#transform-shape
[Select layers and objects in Figma]: https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
[Make selections with the Rectangular Marquee tool]: https://helpx.adobe.com/photoshop/using/tool-techniques/rectangular-marquee-tool.html
[Lesson 8 - Using Spatial Indexing for Acceleration]: /guide/lesson-008#using-spatial-indexing
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
[Feature Request: Lasso Selection (free selection) in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/6350
[Lesson 25 - Pencil tool]: /guide/lesson-025#pencil-tool
[How do I determine if two convex polygons intersect?]: https://stackoverflow.com/questions/753140/how-do-i-determine-if-two-convex-polygons-intersect
[Lock and unlock layers]: https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers
