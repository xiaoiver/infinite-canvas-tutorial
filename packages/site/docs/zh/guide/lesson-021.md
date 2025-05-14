---
outline: deep
publish: false
---

# 课程 21 - Transformer

在 [课程 14] 中我们简单介绍过画布模式中的“选择模式”。在该模式下，选中图形后，在图形上覆盖一个操作层，可以通过拖拽行为移动它。在本节课中，我们将提供更多图形编辑能力，包括 resize 和旋转。

在 Konva 中把选中后图形上的操作层称作 [Transformer]，提供了以下例子：

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

## 锚点 {#anchors}

Transformer 的锚点分成 Resize 和旋转两类，在数目上有两种常见的组合。

一是 Excalidraw 和 Konva 采用的，用于 Resize 的 8 个锚点环绕四周，再加上一个独立的旋转锚点：

![Source: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

二是 tldraw 和 Figma 采用的，使用 4 个锚点，从外侧靠近这 4 个锚点时变成旋转，而水平垂直的 Resize 通过拖拽四条边实现：

![Source: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

我们选择这种看起来更为简洁的方案。

### 扩大拾取面积 {#hit-area}

如何在远远地靠近锚点时就触发拾取呢？这就要求图形可以扩大甚至是自定义拾取面积，例如 Pixi.js 就提供了 [hitArea]。我们为 Renderable 组件也增加这个字段：

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

在 ComputeBounds System 计算包围盒时考虑这个属性：

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

在扩大了锚点的拾取范围后，接下来需要区分旋转和 Resize。

### 展示 CSS cursor {#display-css-cursor}

当鼠标悬停到锚点上时，鼠标样式需要直观地展示对应的功能，在 Web 端通过修改 `<canvas>` 的样式实现。默认的 [CSS cursor] 支持的图标比较有限，例如表示旋转语义的图标是不存在的，在 Excalidraw 和 Konva 中只能使用 `grab` 代替。再比如表示 Resize 的图标确实有 8 个，但由于图形存在旋转情况，当旋转角度不为 45 的整数倍时，即便像 Konva 一样计算选择合适的图标，也无法精确表示：

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

因此我们需要使用自定义鼠标样式，还需要能根据旋转角度动态调整。[How can I rotate a css cursor] 中提供了一种使用 SVG 的方式，而 tldraw 在此基础上增加了动态计算角度的逻辑，详见：[useCursor]。

![Rotate anchor](/transformer-anchor-rotate.png)

![Resize anchor](/transformer-anchor-rotate.png)

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

最后根据左上和右下两个锚点，对选中图形重新进行变换操作。

### 锁定长宽比 {#lock-aspect-ratio}

仍然以拖拽左上角锚点为例，锁定长宽比时就不能直接设置它的位置，需要在固定住右下角锚点位置不变的情况下，根据拖拽开始时图形的长宽比重新计算左上角锚点的位置。

首先记录拖拽锚点开始时图形的长宽比，等价于对角线的斜率：

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

拖拽过程中：

1. 固定右下角锚点位置不变
2. 计算此时从左上到右下的对角线距离
3. 根据之前保存的长宽比，重新计算左上角锚点位置

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

在拖拽过程中可以实时展示出对角线，给用户明显的提示（一般是虚线）。

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

### 翻转 {#flip}

当拖拽到反方向时。

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

-   [图形编辑器开发：自定义光标]

[课程 14]: /zh/guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[How can I rotate a css cursor]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[图形编辑器开发：自定义光标]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
