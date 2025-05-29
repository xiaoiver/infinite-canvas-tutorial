---
outline: deep
publish: false
---

# Lesson 21 - Transformer

In [Lesson 14], we briefly introduced the "selection mode" in canvas mode. In this mode, after selecting a shape, an operation layer is overlaid on the shape, allowing it to be moved through drag behavior. In this lesson, we will provide more shape editing capabilities, including resize and rotation.

In Konva, the operation layer on selected shapes is called [Transformer], which provides the following examples:

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

## Anchors {#anchors}

Transformer anchors are divided into two categories: Resize and rotation, with two common combinations in terms of number.

One is adopted by Excalidraw and Konva, using 8 anchors around the perimeter for Resize, plus an independent rotation anchor:

![Source: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

The other is used by tldraw and Figma, using 4 anchors that transform into rotation when approached from the outside, while horizontal and vertical Resize is achieved by dragging the four edges:

![Source: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

We choose this seemingly more concise solution: 一个 `Rect` mask 作为父节点，以及四个子节点 `Circle` 锚点：

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // Use Rect component
);
const tlAnchor = this.createAnchor(minX, minY, AnchorName.TOP_LEFT); // Use Circle component
const trAnchor = this.createAnchor(maxX, minY, AnchorName.TOP_RIGHT);
const blAnchor = this.createAnchor(minX, maxY, AnchorName.BOTTOM_LEFT);
const brAnchor = this.createAnchor(maxX, maxY, AnchorName.BOTTOM_RIGHT);

this.commands
    .entity(mask)
    .appendChild(this.commands.entity(tlAnchor))
    .appendChild(this.commands.entity(trAnchor))
    .appendChild(this.commands.entity(blAnchor))
    .appendChild(this.commands.entity(brAnchor));
```

### Transformer coordinates {#transformer-coordinates}

In [Lesson 6 - Coordinates], we implemented the mutual conversion between three coordinate systems: Viewport, Canvas, and Client. Here we need to introduce a new coordinate system, which is the local coordinate system of the mask. For example, when the mask has transformations (such as rotation), the anchor points as child nodes need to know their position in the world coordinate system. We add this new set of conversion methods:

```ts
transformer2Canvas(camera: Entity, point: IPointData) {
    const { mask } = camera.read(Transformable);
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      matrix,
    );
    return {
      x,
      y,
    };
}
canvas2Transformer(camera: Entity, point: IPointData) {}
```

### Display CSS cursor {#display-css-cursor}

When hovering over an anchor point, the mouse style needs to intuitively display the corresponding function, implemented in the web by modifying the `<canvas>` style. The default [CSS cursor] has limited icon support, for example, there is no icon representing rotation semantics, so Excalidraw and Konva can only use `grab` as a substitute. Similarly, while there are indeed 8 icons for Resize, when the shape is rotated and the angle is not a multiple of 45 degrees, even if we calculate and select the appropriate icon like Konva does, we cannot precisely represent it:

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

Therefore, we need to use custom mouse styles and be able to adjust them dynamically based on rotation angle. [How can I rotate a css cursor] provides a method using SVG, and tldraw adds dynamic angle calculation logic on top of this, see: [useCursor]. Taking the top-right anchor as an example:

![Rotate anchor](/transformer-anchor-rotate.png)

Apply the rotation transformation to the SVG icon to get the Cursor value at this time:

```ts
`url("data:image/svg+xml,<svg height='32' width='32'>...
    <g fill='none' transform='rotate(${
      r + tr // rotation angle
    } 16 16)>
```

When the mouse gets closer to the anchor point, it changes from rotation to Resize interaction:

![Resize anchor](/transformer-anchor-resize.png)

How can we trigger picking when the mouse is still far from the anchor point?

### Expand Hit Area {#hit-area}

The first thought is to allow shapes to expand or even customize their hit area, for example, Pixi.js provides [hitArea]. We can also add this field to the Renderable component:

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

Consider this property when computing bounding boxes in the ComputeBounds System, so we can set a circular detection area that's larger than the anchor point:

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

However, this approach has an obvious problem: even if we set the hit area to be 5 times larger than the anchor point, when the camera zooms, we still need to hover over the anchor point to trigger picking. Therefore, we need to consider picking outside the Canvas world coordinate system.

### Picking in Viewport Coordinates {#picking-in-viewport-coordinates}

We need to perform hit testing in the Viewport coordinate system, so we can ignore camera zoom.

First, we need to calculate the positions of the four anchors in the Canvas world coordinate system, rather than directly using the anchor's `cx/cy`, otherwise it will be incorrect when the Transformer itself has rotation (we'll see this soon):

```ts
hitTest(api: API, { x, y }: IPointData) {
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = camera.read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
        // Need to consider Transformer's own transformation, such as rotation
        api.transformer2Canvas(camera, {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
        }),
    );
    // Omit other anchor position calculations

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

Then first determine if the minimum distance to the four anchors meets the threshold for Resize interaction, if it does, return the corresponding mouse style icon name, add the rotation angle to get the rotated SVG:

```ts
if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-resize',
        };
    }
}
```

Next, enter the rotation interaction determination. At this time, the detection point cannot be inside the Transformer, you can use the determination method introduced in [Check if Point Is Inside A Polygon]:

```ts
else if (
    !isInside &&
    minDistanceToAnchors <= TRANSFORMER_ANCHOR_ROTATE_RADIUS
) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-rotate',
        };
    }
}
```

Finally, we come to the Resize determination for the four edges of the Transformer, here we need to calculate the distance from the detection point to the line segment, refer to [Gist - point to line 2d]:

```ts
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';

const distanceToTopEdge = distanceBetweenPointAndLineSegment(
    point,
    [tlX, tlY],
    [trX, trY],
);
// Omit calculation of distance to other 3 edges

if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToEdges === distanceToTopEdge) {
        return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
        };
    }
}
```

After expanding the anchor's hit area, we need to distinguish between rotation and Resize.

## Resize {#resize}

In Figma / FigJam, in addition to freely changing size by dragging the four corner anchors and four edges, you can also:

-   Press <kbd>Option</kbd> or <kbd>Alt</kbd> while dragging to scale from the geometric center
-   Press <kbd>Shift</kbd> while dragging to fix the opposite corner/edge and scale proportionally along horizontal and vertical directions
-   Combine these keys

The effect is as follows, from: [Resize, rotate, and flip objects in FigJam]

![Resizing in FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

Let's first look at how to implement free size changing. Taking the top-left anchor as an example, when dragging, the bottom-right anchor remains fixed:

```ts
handleSelectedResizing(
    api: API,
    anchorNodeX: number,
    anchorNodeY: number,
    anchorName: AnchorName,
) {
    if (anchorName === AnchorName.TOP_LEFT) {
        // Set top-left anchor position
        Object.assign(tlAnchor.write(Circle), {
            cx: anchorNodeX,
            cy: anchorNodeY,
        });
    }
    // Omit other anchor handling logic
    const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
    // Recalculate selected shape position and size
    this.fitSelected(api, tlCx, tlCy, brCx - tlCx, brCy - tlCy);
}
```

Finally, transform the selected shape based on the top-left and bottom-right anchors.

### Lock Aspect Ratio {#lock-aspect-ratio}

Still taking the top-left anchor as an example, when locking the aspect ratio, we can't directly set its position. We need to recalculate the top-left anchor's position based on the shape's aspect ratio at the start of dragging, while keeping the bottom-right anchor position fixed.

First, record the shape's aspect ratio when the drag anchor starts, equivalent to the diagonal slope:

```ts
if (input.pointerDownTrigger) {
    if (type === UIType.TRANSFORMER_ANCHOR) {
        const { minX, minY, maxX, maxY } = this.getSelectedAABB();
        const width = maxX - minX;
        const height = maxY - minY;
        const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        this.#sin = Math.abs(height / hypotenuse);
        this.#cos = Math.abs(width / hypotenuse);
    }
}
```

During dragging:

1. Keep the bottom-right anchor position fixed
2. Calculate the current diagonal distance from top-left to bottom-right
3. Recalculate the top-left anchor position based on the previously saved aspect ratio

```ts
if (lockAspectRatio) {
    // 1.
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    // 2.
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - anchorNodeX, 2) +
            Math.pow(comparePoint.y - anchorNodeY, 2),
    );
    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;
    // 3.
    const x = newHypotenuse * this.#cos * reverseX;
    const y = newHypotenuse * this.#sin * reverseY;
    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - x,
        cy: comparePoint.y - y,
    });
}
```

During dragging, we can show the diagonal in real-time to give users a clear hint (usually as a dashed line).

### Centered Scaling {#centered-scaling}

Still taking the top-left anchor as an example, now the fixed reference point changes from the bottom-right anchor to the geometric center point, also recorded at the start of the drag behavior:

```ts
const comparePoint = centeredScaling
    ? {
          x: this.#center[0], // [!code ++]
          y: this.#center[1], // [!code ++]
      }
    : {
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
      };
```

Then recalculate the bottom-right anchor position, symmetrical to the top-left anchor about the center point:

```ts
if (centeredScaling) {
    const { cx, cy } = tlAnchor.read(Circle);
    Object.assign(brAnchor.write(Circle), {
        cx: 2 * this.#center[0] - cx,
        cy: 2 * this.#center[1] - cy,
    });
}
```

### Flip {#flip}

When dragging an anchor or edge in the opposite direction, it will flip, as shown in Figma below, note the change in Rotation:

![Rotate 180 deg when flipped](/resize-flip.gif)

## Rotation {#rotation}

Figma

> Hover just outside one of the layer's bounds until the icon appears.
> Click and drag to rotate your selection:
> Drag clockwise to create a negative angle (towards -180° ).
> Drag counterclockwise to create a positive angle (towards 180° )
> Hold down Shift to snap rotation values to increments of 15.

### Change the Rotation Origin {#change-the-rotation-origin}

Below is the effect of Figma's [Change the rotation origin]:

![Change the rotation origin](https://help.figma.com/hc/article_attachments/31937330391447)

## Nudge the Position Using Arrow Keys {#nudge-the-position}

Figma provides the [Nudge layers] feature, allowing you to move shapes using the arrow keys, and you can also use <kbd>Shift</kbd> for larger movements. In our implementation, we'll use fixed distances:

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeTransform(selected, { dy: -10 });
    this.api.record();
}
```

## Extended Reading {#extended-reading}

-   [Graphics Editor Development: Custom Cursor]

[Lesson 14]: /guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[How can I rotate a css cursor]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[Graphics Editor Development: Custom Cursor]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
[Check if Point Is Inside A Polygon]: https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
[Gist - point to line 2d]: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
[Lesson 6 - Coordinates]: /guide/lesson-006#coordinates
