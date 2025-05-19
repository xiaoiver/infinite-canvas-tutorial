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

Transformer anchors are divided into two categories: Resize and rotation, with two common combinations in terms of numbers.

One is used by Excalidraw and Konva, with 8 anchors for Resize surrounding the shape, plus an independent rotation anchor:

![Source: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

The other is used by tldraw and Figma, using 4 anchors that transform into rotation when approached from the outside, while horizontal and vertical Resize is achieved by dragging the four edges:

![Source: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

We chose this seemingly more concise solution.

### Expanding Hit Area {#hit-area}

How can we trigger selection when approaching the anchor from a distance? This requires the shape to expand or even customize its hit area, for example, Pixi.js provides [hitArea]. We also add this field to the Renderable component:

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

The ComputeBounds System considers this property when calculating the bounding box:

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

After expanding the anchor's hit area, we need to distinguish between rotation and Resize.

### Display CSS Cursor {#display-css-cursor}

When hovering over an anchor, the mouse style needs to intuitively display the corresponding function, implemented by modifying the `<canvas>` style in the web version. The default [CSS cursor] has limited icon support, for example, there is no icon representing rotation semantics, and Excalidraw and Konva can only use `grab` as a substitute. Similarly, while there are indeed 8 icons for Resize, when the shape is rotated at angles not multiples of 45 degrees, even calculating appropriate icons like Konva does cannot precisely represent the action:

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

Therefore, we need to use custom mouse styles and be able to dynamically adjust based on rotation angle. [How can I rotate a css cursor] provides a method using SVG, and tldraw adds dynamic angle calculation logic on this basis, see: [useCursor]. Taking the top-right anchor as an example:

![Rotate anchor](/transformer-anchor-rotate.png)

Apply the rotation transformation to the SVG icon to get the Cursor value:

```ts
`url("data:image/svg+xml,<svg height='32' width='32'>...
    <g fill='none' transform='rotate(${
      r + tr // rotation angle
    } 16 16)>
```

When the mouse gets closer to the anchor, it changes from rotation to Resize interaction:

![Resize anchor](/transformer-anchor-resize.png)

## Resize {#resize}

In Figma / FigJam, in addition to freely changing size by dragging the four corner anchors and four edges, you can also:

-   Press <kbd>Option</kbd> or <kbd>Alt</kbd> while dragging to scale from the geometric center
-   Press <kbd>Shift</kbd> while dragging to fix the opposite corner/edge and scale proportionally along horizontal and vertical directions
-   Combine these keys

The effect is shown below, from: [Resize, rotate, and flip objects in FigJam]

![Resizing in FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

Let's look at how to implement free size changing. Taking the top-left anchor as an example, the bottom-right anchor remains fixed during dragging:

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

Still taking the top-left anchor as an example, when locking the aspect ratio, we can't directly set its position. Instead, we need to recalculate the top-left anchor position based on the shape's aspect ratio at the start of dragging, while keeping the bottom-right anchor position fixed.

First, record the shape's aspect ratio when starting to drag the anchor, equivalent to the diagonal slope:

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

During dragging, you can display the diagonal in real-time to give users a clear hint (usually as a dashed line).

### Centered Scaling {#centered-scaling}

Still taking the top-left anchor as an example, the fixed reference point changes from the bottom-right anchor to the geometric center point, also recorded at the start of the drag behavior:

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

When dragging to the opposite direction.

## Rotation {#rotation}

Figma

> Hover just outside one of the layer's bounds until the icon appears.
> Click and drag to rotate your selection:
> Drag clockwise to create a negative angle (towards -180° ).
> Drag counterclockwise to create a positive angle (towards 180° )
> Hold down Shift to snap rotation values to increments of 15.

### Adjust Rotation Origin {#change-the-rotation-origin}

Below is the effect of Figma's [Change the rotation origin]:

![Change the rotation origin](https://help.figma.com/hc/article_attachments/31937330391447)

## Move Shapes with Arrow Keys {#nudge-the-position}

Figma provides the [Nudge layers] feature, allowing you to move shapes using the arrow keys, and you can also use <kbd>Shift</kbd> for larger movements. In our implementation, we use a fixed distance:

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeTransform(selected, { dy: -10 });
    this.api.record();
}
```

## Extended Reading {#extended-reading}

-   [Graphic Editor Development: Custom Cursor]

[Lesson 14]: /guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[How can I rotate a css cursor]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[Graphic Editor Development: Custom Cursor]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
