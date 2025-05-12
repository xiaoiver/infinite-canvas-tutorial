---
outline: deep
publish: false
---

# Lesson 21 - Transformer

In [Lesson 14], we briefly introduced the "Selection Mode" in canvas mode. In this mode, when a shape is selected, an operation layer overlays the shape, allowing it to be moved through drag behavior. In this lesson, we will provide more shape editing capabilities, including resize and rotation.

In Konva, the operation layer that appears on selected shapes is called [Transformer], which provides the following examples:

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

## Resize {#resize}

In Figma / FigJam, besides freely changing size by dragging the four corner anchors and four edges, you can also:

-   Press <kbd>Option</kbd> or <kbd>Alt</kbd> while dragging to scale from the geometric center
-   Press <kbd>Shift</kbd> while dragging to maintain aspect ratio along horizontal and vertical directions, keeping the opposite corner/edge fixed
-   Combine these key combinations

The effect is shown below, from: [Resize, rotate, and flip objects in FigJam]

![Resizing in FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

Let's first look at how to implement free size changing. Taking the top-left corner anchor as an example, the bottom-right corner anchor remains fixed during dragging:

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
    // Other anchor handling logic omitted
    const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
    // Recalculate selected shape position and size
    this.fitSelected(api, tlCx, tlCy, brCx - tlCx, brCy - tlCy);
}
```

### Lock Aspect Ratio {#lock-aspect-ratio}

First, record the aspect ratio of the shape when starting to drag the anchor:

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

```ts
if (lockAspectRatio) {
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - anchorNodeX, 2) +
            Math.pow(comparePoint.y - anchorNodeY, 2),
    );

    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;

    const x = newHypotenuse * this.#cos * reverseX;
    const y = newHypotenuse * this.#sin * reverseY;

    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - x,
        cy: comparePoint.y - y,
    });
}
```

### Centered Scaling {#centered-scaling}

Still taking the top-left corner anchor as an example, the fixed reference point changes from the bottom-right corner anchor to the geometric center point, also recorded at the start of the drag behavior:

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

Then recalculate the bottom-right corner anchor position, symmetrical to the top-left corner anchor about the center point:

```ts
if (centeredScaling) {
    const { cx, cy } = tlAnchor.read(Circle);
    Object.assign(brAnchor.write(Circle), {
        cx: 2 * this.#center[0] - cx,
        cy: 2 * this.#center[1] - cy,
    });
}
```

Finally, transform the selected shape based on the top-left and bottom-right anchors.

## Rotation {#rotation}

Figma provides the following:

Hover just outside one of the layer's bounds until the icon appears.
Click and drag to rotate your selection:
Drag clockwise to create a negative angle (towards -180° ).
Drag counterclockwise to create a positive angle (towards 180° )
Hold down Shift to snap rotation values to increments of 15.

### Adjust Rotation Center {#change-the-rotation-origin}

The image below shows the effect of Figma's [Change the rotation origin]:

![Change the rotation origin](https://help.figma.com/hc/article_attachments/31937330391447)

## Move Shapes with Arrow Keys {#nudge-the-position}

Figma provides the [Nudge layers] feature, allowing you to move shapes using arrow keys, and you can also use <kbd>Shift</kbd> for larger movements. In our implementation, we use fixed distances:

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeTransform(selected, { dy: -10 });
    this.api.record();
}
```

## Extended reading {#extended-reading}

[Lesson 14]: /guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
