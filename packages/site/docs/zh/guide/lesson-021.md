---
outline: deep
publish: false
---

# 课程 21 - Transformer 和辅助引导线

在 [课程 14] 中我们简单介绍过画布模式中的“选择模式”。在该模式下，选中图形后，在图形上覆盖一个操作层，可以通过拖拽行为移动它。在本节课中，我们将提供更多图形编辑能力，包括 resize 和旋转。

在 Konva 中把选中后图形上的操作层称作 [Transformer]，提供了以下例子：

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

## Resize {#resize}

在 Figma / FigJam 中，除了可以通过拖拽四个角落的锚点以及四条边进行自由改变大小之外，还可以：

-   按 <kbd>Option</kbd> 或者 <kbd>Alt</kbd> 拖拽时，以几何中心缩放
-   按 <kbd>Shift</kbd> 拖拽时，固定对角、对边不动，沿水平垂直方向等比例缩放
-   组合按下

效果如下，来自：[Resize, rotate, and flip objects in FigJam]

![Resizing in FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

先来看自由改变大小如何实现。以左上角锚点为例，拖拽时右下角锚点是固定不动的：

```ts
handleSelectedResizing(
    api: API,
    anchorNodeX: number,
    anchorNodeY: number,
    anchorName: AnchorName,
) {
    if (anchorName === AnchorName.TOP_LEFT) {
        // 设置左上角锚点位置
        Object.assign(tlAnchor.write(Circle), {
            cx: anchorNodeX,
            cy: anchorNodeY,
        });
    }
    // 省略其他锚点处理逻辑
    const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
    // 重新计算被选中图形位置和尺寸
    this.fitSelected(api, tlCx, tlCy, brCx - tlCx, brCy - tlCy);
}
```

### 锁定长宽比 {#lock-aspect-ratio}

首先要记录拖拽锚点开始时图形的长宽比：

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

### 中心缩放 {#centered-scaling}

还是以左上角锚点为例，此时固定参考点从右下角锚点改成几何中心点，同样是在拖拽行为开始时记录：

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

然后重新计算右下角锚点位置，和左上角锚点对称于中心点：

```ts
if (centeredScaling) {
    const { cx, cy } = tlAnchor.read(Circle);
    Object.assign(brAnchor.write(Circle), {
        cx: 2 * this.#center[0] - cx,
        cy: 2 * this.#center[1] - cy,
    });
}
```

最后根据左上和右下两个锚点，对选中图形重新进行变换操作。

## 旋转 {#rotation}

Figma 提供了以下

Hover just outside one of the layer's bounds until the icon appears.
Click and drag to rotate your selection:
Drag clockwise to create a negative angle (towards -180° ).
Drag counterclockwise to create a positive angle (towards 180° )
Hold down Shift to snap rotation values to increments of 15.

### 调整旋转中心 {#change-the-rotation-origin}

下图是 Figma [Change the rotation origin] 的效果：

![Change the rotation origin](https://help.figma.com/hc/article_attachments/31937330391447)

## 使用方向键移动图形 {#nudge-the-position}

Figma 提供了 [Nudge layers] 特性，可以使用上下左右方向键移动图形，还可以配合 <kbd>Shift</kbd> 进行更大距离的移动。在我们的实现中就使用固定距离了：

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeTransform(selected, { dy: -10 });
    this.api.record();
}
```

## 扩展阅读 {#extended-reading}

[课程 14]: /zh/guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
