---
outline: deep
description: 'Implement shape transformer with resize and rotation capabilities. Learn about anchor points, coordinate system conversion, CSS cursor customization, and hit area expansion for intuitive shape editing.'
head:
    - ['meta', { property: 'og:title', content: 'Lesson 21 - Transformer' }]
---

# Lesson 21 - Transformer

In [Lesson 14], we briefly introduced the "selection mode" in canvas mode. In this mode, after selecting a shape, an operation layer is overlaid on the shape, allowing it to be moved through drag behavior. In this lesson, we will provide more shape editing capabilities, including resize and rotation.

In Konva, the operation layer on selected shapes is called [Transformer], which provides the following examples:

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

We also chose to use the name Transformer, which looks very similar to the shape's AABB. In fact, it's called OBB (oriented bounding box), which is a rectangle with a rotation angle under the world coordinate.

## Serializing Transform Matrix and Dimension Information {#serialize-transform-dimension}

In Figma, the local transform matrix and dimension information for shapes are as follows. We know that for 2D shapes, the mat3 transform matrix can be decomposed into translation, scale, and rotation parts. Among them, X/Y corresponds to translation, and scale will be introduced in the [flip](#flip) section. [fig-file-parser]

![source: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions](https://help.figma.com/hc/article_attachments/29799649003671)

Therefore, we chose to modify the [SerializedNode] structure to make it describe multiple shapes as much as possible, while removing some shape position attributes, such as `cx/cy` for Circle, since we can calculate `cx/cy` through `x/y` and `width/height`.

```ts
export interface TransformAttributes {
    // Transform
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    // Dimension
    width: number;
    height: number;
}
```

`<circle cx="100" cy="100" r="50" />` is serialized as follows, using `ellipse` to represent it for more flexible resizing in the future:

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $circle = createSVGElement('circle');
    $circle.setAttribute('cx', '100');
    $circle.setAttribute('cy', '100');
    $circle.setAttribute('r', '50');
    const nodes = svgElementsToSerializedNodes([$circle]);
    return nodes[0];
});
```

For shapes like Polyline and Path that are defined through `point` and `d` attributes, we cannot delete these attributes. Instead, we need to calculate their AABB and recalculate these attributes. Taking `<polyline points="50,50 100,100, 100,50" />` as an example:

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $polyline = createSVGElement('polyline');
    $polyline.setAttribute('points', '50,50 100,100, 100,50');
    const nodes = svgElementsToSerializedNodes([$polyline]);
    return nodes[0];
});
```

## Anchors {#anchors}

Transformer's anchors are divided into two categories: Resize and rotation, with two common combinations in terms of number.

One is adopted by Excalidraw and Konva, using 8 anchors around the perimeter for Resize, plus an independent rotation anchor:

![Source: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

The other is adopted by tldraw and Figma, using 4 anchors. When approaching these 4 anchors from the outside, it becomes rotation, while horizontal and vertical Resize is achieved by dragging the four edges:

![Source: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

We chose this seemingly more concise solution: a `Rect` mask as the parent node, and four child nodes `Circle` anchors:

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // Using Rect component
);
const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT); // Using Circle component
const trAnchor = this.createAnchor(width, 0, AnchorName.TOP_RIGHT);
const blAnchor = this.createAnchor(0, height, AnchorName.BOTTOM_LEFT);
const brAnchor = this.createAnchor(width, height, AnchorName.BOTTOM_RIGHT);

this.commands
    .entity(mask)
    .appendChild(this.commands.entity(tlAnchor))
    .appendChild(this.commands.entity(trAnchor))
    .appendChild(this.commands.entity(blAnchor))
    .appendChild(this.commands.entity(brAnchor));
```

### Transformer Coordinate System {#transformer-coordinates}

In [Lesson 6 - Coordinate System Conversion], we implemented the conversion between Viewport, Canvas, and Client coordinate systems. Here we need to introduce a new coordinate system, the local coordinate system of the mask. For example, when the mask has transformations (such as rotation), the anchor points as child nodes need to know their position in the world coordinate system. We add this set of conversion methods:

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

### Display CSS Cursor {#display-css-cursor}

When hovering over an anchor point, the mouse style needs to intuitively show the corresponding function, implemented by modifying the `<canvas>` style in the web end. The default [CSS cursor] has limited supported icons, for example, there is no icon for rotation semantics, and in Excalidraw and Konva, we can only use `grab` instead. Another example is that there are indeed 8 icons for Resize, but because shapes can be rotated, when the rotation angle is not an integer multiple of 45, even if we calculate and choose the appropriate icon like Konva does, we cannot accurately represent it:

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

Therefore, we need to use custom mouse styles and be able to dynamically adjust based on rotation angle. [How can I rotate a css cursor] provides a way using SVG, and tldraw adds logic for dynamic angle calculation on this basis, see: [useCursor]. Taking the top-right anchor point as an example:

![Rotate anchor](/transformer-anchor-rotate.png)

Apply the rotation transformation to the SVG icon to get the Cursor value at this time:

```ts
`url("data:image/svg+xml,<svg height='32' width='32'>...
    <g fill='none' transform='rotate(${
      r + tr // rotation angle
    } 16 16)>
```

And when the mouse gets closer to the anchor point, it changes from rotation to Resize interaction:

![Resize anchor](/transformer-anchor-resize.png)

How to trigger picking when approaching the anchor point from far away?

### Expand Hit Area {#hit-area}

First, we thought of allowing shapes to expand or even customize the hit area, for example, Pixi.js provides [hitArea]. We can also add this field to the Renderable component:

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

Consider this property when computing bounds in the ComputeBounds System, so we can set a circular detection area that's larger than the anchor point:

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

But this approach has an obvious problem: even if we set the hit area to be 5 times larger than the anchor point, when the camera zooms, we still need to hover over the anchor point to trigger picking. Therefore, we need to consider picking outside the Canvas world coordinate system.

### Picking in Viewport Coordinates {#picking-in-viewport-coordinates}

We need to perform picking detection in the Viewport coordinate system, so we can ignore camera zoom.

First, we need to calculate the positions of the four anchor points in the Canvas world coordinate system, rather than directly using the anchor points' `cx/cy`, otherwise it will go wrong when the Transformer itself has rotation (we'll see this soon):

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
    // Omit calculation of other anchor positions

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

Then first determine if the minimum distance to the four anchor points meets the threshold for Resize interaction, if it does, return the corresponding mouse style icon name, add the rotation angle to get the rotated SVG:

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

Next, enter the rotation interaction detection. At this time, the detection point cannot be inside the Transformer, you can use the detection method introduced in [Check if Point Is Inside A Polygon]:

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

Finally, come to the Resize detection of the four edges of the Transformer, here we need to calculate the distance from the detection point to the line segment, refer to [Gist - point to line 2d]:

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

## Single Shape Resize {#resize-single-shape}

In Figma / FigJam, besides being able to freely change size by dragging the four corner anchor points and four edges, you can also:

-   Press <kbd>Option</kbd> or <kbd>Alt</kbd> while dragging to scale from the geometric center
-   Press <kbd>Shift</kbd> while dragging to fix the opposite corner/edge, scale proportionally along horizontal and vertical directions
-   Combine these keys

The effect is as follows, from: [Resize, rotate, and flip objects in FigJam]

![Resizing in FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

Let's first look at how to implement free size change. Taking the top-left anchor point as an example, when dragging, the bottom-right anchor point is fixed:

```ts
private handleSelectedResizing(
    api: API,
    canvasX: number,
    canvasY: number,
    anchorName: AnchorName,
) {
    const { x, y } = api.canvas2Transformer({
      x: canvasX,
      y: canvasY,
    });
    if (anchorName === AnchorName.TOP_LEFT) {
        // Set top-left anchor point position
        Object.assign(tlAnchor.write(Circle), {
            cx: x,
            cy: y,
        });
    }
    // Omit other anchor point handling logic
    {
        const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
        const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
        const width = brCx - tlCx;
        const height = brCy - tlCy;
        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
        // Recalculate selected shape position and size
        this.fitSelected(api, {
            x,
            y,
            width,
            height,
            rotation: this.#rotation,
        });
    }
}
```

Finally, transform the selected shape based on the top-left and bottom-right anchor points.

### Transform Shape {#transform-shape}

Now that we know the properties before and after resize (transform and dimension information), it's easy to calculate the transition matrix between these two states:

```plaintext
// @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts#L1106

[delta transform] = [new transform] * [old transform inverted]
```

```ts
const baseSize = 10000000;
const oldTr = mat3.create();
mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
mat3.scale(oldTr, oldTr, [
    oldAttrs.width / baseSize,
    oldAttrs.height / baseSize,
]);
const newTr = mat3.create();
mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
mat3.rotate(newTr, newTr, newAttrs.rotation);
mat3.scale(newTr, newTr, [
    newAttrs.width / baseSize,
    newAttrs.height / baseSize,
]);

const delta = mat3.multiply(newTr, newTr, mat3.invert(mat3.create(), oldTr));
```

But we can't apply this matrix directly to the selected shape, we also need to consider the transformation of the parent node in the scene graph in the world coordinate system:

```plaintext
[delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
```

We can get the new transformation of selected shape in local coordinate system after left-multiplying its parent's world transform:

```plaintext
[new local] = [parent inverted] * [delta] * [parent] * [old local]
```

Finally the new matrix under the local coordinate system is applied to the selected shape.

### Lock Aspect Ratio {#lock-aspect-ratio}

Still taking the top-left anchor point as an example, when locking the aspect ratio, we can't directly set its position. We need to recalculate the top-left anchor point's position based on the shape's aspect ratio at the start of dragging, while keeping the bottom-right anchor point position unchanged.

First, record the selected shape's OBB and aspect ratio when starting to drag the anchor point, equivalent to the diagonal slope:

```ts
if (input.pointerDownTrigger) {
    if (type === UIType.TRANSFORMER_ANCHOR) {
        this.#obb = this.getSelectedOBB();
        const { width, height } = this.#obb;
        const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        this.#sin = Math.abs(height / hypotenuse);
        this.#cos = Math.abs(width / hypotenuse);
    }
}
```

During dragging:

1. Keep the bottom-right anchor point position unchanged
2. Calculate the diagonal distance from top-left to bottom-right at this time
3. Recalculate the top-left anchor point position based on the previously saved aspect ratio

```ts
if (lockAspectRatio) {
    // 1.
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    // 2.
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
    );
    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;
    // 3.
    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - newHypotenuse * this.#cos * reverseX,
        cy: comparePoint.y - newHypotenuse * this.#sin * reverseY,
    });
}
```

It's worth noting that Konva.js does not support dragging all four edges while preserving the aspect ratio. In such cases, you need to disable these four anchor points. For details, see: [Is there a way to keep the image aspect ratio on transform?].

However, we can easily achieve this. Taking dragging the right edge anchor point as an example:

1. First, set the X coordinate of the bottom-right anchor point
2. Since the X coordinate of the top-left anchor point remains unchanged, the transformed width can be calculated
3. With the aspect ratio locked, the transformed height is also determined, allowing calculation of the transformed height
4. Based on the height difference before and after transformation, set the Y coordinates of the top-left and bottom-right anchor points

```ts
if (anchorName === AnchorName.MIDDLE_RIGHT) {
    // 1.
    brAnchor.write(Circle).cx = x;

    if (lockAspectRatio) {
        // 2.
        const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
        const tan = sin / cos;
        const newHeight = newWidth * tan; // 3.
        const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
        // 4.
        brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
        tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
    }
}
```

During dragging, we can show the diagonal line in real-time to give users a clear hint (usually a dashed line).

### Centered Scaling {#centered-scaling}

Still taking the top-left anchor point as an example, at this time the fixed reference point changes from the bottom-right anchor point to the geometric center point, also recorded at the start of dragging:

```ts
const comparePoint = centeredScaling
    ? {
          x: this.#obb.width / 2, // [!code ++]
          y: this.#obb.height / 2, // [!code ++]
      }
    : {
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
      };
```

Then recalculate the bottom-right anchor point position, symmetrical to the top-left anchor point about the center point:

```ts
if (centeredScaling) {
    const tlOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
    const tlOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;
    Object.assign(brAnchor.write(Circle), {
        cx: brAnchor.read(Circle).cx - tlOffsetX,
        cy: brAnchor.read(Circle).cy - tlOffsetY,
    });
}
```

### [WIP] Flip {#flip}

When dragging an anchor point or edge to the opposite direction, flipping occurs. The following is the effect in Figma, note the change in Rotation:

![Rotate 180 deg when flipped](/resize-flip.gif)

We use a gradient background to show this flipping effect more clearly:

![Flip a rect with gradient fill](/rotate-when-flipped.png)

## [WIP] Rotation {#rotation}

Figma

> Hover just outside one of the layer's bounds until the icon appears.
> Click and drag to rotate your selection:
> Drag clockwise to create a negative angle (towards -180° ).
> Drag counterclockwise to create a positive angle (towards 180° )
> Hold down Shift to snap rotation values to increments of 15.

### Change the Rotation Origin {#change-the-rotation-origin}

The following is the effect of Figma's [Change the rotation origin]:

![Change the rotation origin](https://help.figma.com/hc/article_attachments/31937330391447)

## Move Shapes with Arrow Keys {#nudge-the-position}

Figma provides the [Nudge layers] feature, allowing you to move shapes using the up, down, left, and right arrow keys, and you can also use <kbd>Shift</kbd> for larger movements. In our implementation, we'll use fixed distances:

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeOBB(selected, { y: selected.y - 10 });
    this.api.record();
}
```

## Transformer for line {#transformer-for-line}

Finally, a straight line requires only two anchor points, allowing the series of operations based on the bounding rectangle we previously introduced to be significantly simplified.

```ts
export class Transformable {
    @field.ref declare lineMask: Entity;
    @field.ref declare x1y1Anchor: Entity;
    @field.ref declare x2y2Anchor: Entity;
}
```

![Transformer for line](/line-transformer.gif)

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
[Lesson 6 - Coordinate System Conversion]: /guide/lesson-006#coordinates
[SerializedNode]: /guide/lesson-010#shape-to-serialized-node
[fig-file-parser]: https://madebyevan.com/figma/fig-file-parser
[Is there a way to keep the image aspect ratio on transform?]: https://github.com/konvajs/react-konva/issues/407
