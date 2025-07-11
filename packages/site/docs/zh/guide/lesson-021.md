---
outline: deep
description: '实现图形变换器，支持调整大小和旋转功能。学习锚点机制、坐标系转换、CSS光标自定义以及扩大拾取区域的直观图形编辑技术。'
---

# 课程 21 - Transformer

在 [课程 14] 中我们简单介绍过画布模式中的“选择模式”。在该模式下，选中图形后，在图形上覆盖一个操作层，可以通过拖拽行为移动它。在本节课中，我们将提供更多图形编辑能力，包括 resize 和旋转。

在 Konva 中把选中后图形上的操作层称作 [Transformer]，提供了以下例子：

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

我们也选择使用 Transformer 这个名字，它看起来和图形的 AABB 非常相似，事实上它被称为 OBB(oriented bounding box)，是一个世界坐标系下带有旋转角度的矩形。

## 序列化变换矩阵和尺寸信息 {#serialize-transform-dimension}

在 Figma 中图形局部坐标系下的变换矩阵和尺寸信息如下。我们知道对于 2D 图形的变换矩阵 mat3 可以分解成 translation, scale 和 rotation 三部分。其中 X/Y 对应 translation，scale 我们放到[翻转](#flip)这一小节介绍。

![source: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions](https://help.figma.com/hc/article_attachments/29799649003671)

因此我们选择修改 [SerializedNode] 结构，让它尽可能描述多种图形，同时移除一些图形表示位置的属性，例如 Circle 的 `cx/cy`，通过 `x/y` 和 `width/height` 我们是可以计算出 `cx/cy` 的。

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

`<circle cx="100" cy="100" r="50" />` 序列化后结构如下，这里使用 `ellipse` 表示是为了后续可以更灵活地 resize：

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

对于 Polyline 和 Path 这种通过 `point` 和 `d` 属性定义的图形，我们无法删除这些属性，而需要计算出它们的 AABB 后，对这些属性进行重新计算。以 `<polyline points="50,50 100,100, 100,50" />` 为例：

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $polyline = createSVGElement('polyline');
    $polyline.setAttribute('points', '50,50 100,100, 100,50');
    const nodes = svgElementsToSerializedNodes([$polyline]);
    return nodes[0];
});
```

## 锚点 {#anchors}

Transformer 的锚点分成 Resize 和旋转两类，在数目上有两种常见的组合。

一是 Excalidraw 和 Konva 采用的，用于 Resize 的 8 个锚点环绕四周，再加上一个独立的旋转锚点：

![Source: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

二是 tldraw 和 Figma 采用的，使用 4 个锚点，从外侧靠近这 4 个锚点时变成旋转，而水平垂直的 Resize 通过拖拽四条边实现：

![Source: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

我们选择这种看起来更为简洁的方案：一个 `Rect` mask 作为父节点，以及四个子节点 `Circle` 锚点：

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // 使用 Rect 组件
);
const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT); // 使用 Circle 组件
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

### Transformer 坐标系 {#transformer-coordinates}

在 [课程 6 - 坐标系转换] 中我们实现了 Viewport、Canvas、Client 这三个坐标系下的互相转换。这里我们需要引入一个新的坐标系，即 mask 的局部坐标系。例如当 mask 存在变换（例如旋转）时，作为子节点的锚点需要知道自身在世界坐标系下的位置。我们新增这一组转换方法：

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

因此我们需要使用自定义鼠标样式，还需要能根据旋转角度动态调整。[How can I rotate a css cursor] 中提供了一种使用 SVG 的方式，而 tldraw 在此基础上增加了动态计算角度的逻辑，详见：[useCursor]。以右上角锚点为例：

![Rotate anchor](/transformer-anchor-rotate.png)

将旋转变换应用在 SVG 图标上，得到此时 Cursor 的值：

```ts
`url("data:image/svg+xml,<svg height='32' width='32'>...
    <g fill='none' transform='rotate(${
      r + tr // 旋转角度
    } 16 16)>
```

而当鼠标进一步靠近锚点时，会从旋转变成 Resize 交互：

![Resize anchor](/transformer-anchor-resize.png)

如何在远远地靠近锚点时就触发拾取呢？

### 扩大拾取面积 {#hit-area}

首先想到的是让图形可以扩大甚至是自定义拾取面积，例如 Pixi.js 就提供了 [hitArea]。我们也可以为 Renderable 组件也增加这个字段：

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

在 ComputeBounds System 计算包围盒时考虑这个属性，这样我们就可以设置一个比锚点大一圈的圆形判定区域：

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

但这种方式存在一个明显的问题：即使我们把拾取面积设置成锚点的 5 倍大，当相机缩放时，仍需要悬停到锚点上才能触发拾取。因此我们需要跳出 Canvas 世界坐标系下考虑拾取问题。

### 在 Viewport 坐标系下拾取 {#picking-in-viewport-coordinates}

我们需要在 Viewport 坐标系下进行拾取判定，这样才可以无视相机缩放。

首先我们需要计算四个锚点在 Canvas 世界坐标系下的位置，而不是直接使用锚点的 `cx/cy`，否则当 Transformer 本身存在旋转时（我们马上就会看到这一点）就会出错。

```ts
hitTest(api: API, { x, y }: IPointData) {
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = camera.read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
        // 需要考虑 Transformer 本身的变换，例如旋转
        api.transformer2Canvas(camera, {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
        }),
    );
    // 省略其余锚点位置计算

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

然后优先判定离四个锚点的最小距离是否满足 Resize 交互的阈值，如果满足就返回对应的鼠标样式图标名称，加上旋转角度得到旋转后的 SVG：

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

接下来进入旋转交互的判定。此时检测点不能在 Transformer 内，可以使用 [Check if Point Is Inside A Polygon] 中介绍的判定方法：

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

最后来到 Transformer 四条边的 Resize 判定，这里需要计算检测点到线段的距离，可参考 [Gist - point to line 2d]：

```ts
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';

const distanceToTopEdge = distanceBetweenPointAndLineSegment(
    point,
    [tlX, tlY],
    [trX, trY],
);
// 省略计算到其余3条边的距离

if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToEdges === distanceToTopEdge) {
        return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
        };
    }
}
```

## 单个图形 Resize {#resize-single-shape}

在 Figma / FigJam 中，除了可以通过拖拽四个角落的锚点以及四条边进行自由改变大小之外，还可以：

-   按 <kbd>Option</kbd> 或者 <kbd>Alt</kbd> 拖拽时，以几何中心缩放
-   按 <kbd>Shift</kbd> 拖拽时，固定对角、对边不动，沿水平垂直方向等比例缩放
-   组合按下

效果如下，来自：[Resize, rotate, and flip objects in FigJam]

![Resizing in FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

先来看自由改变大小如何实现。以左上角锚点为例，拖拽时右下角锚点是固定不动的：

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
        // 设置左上角锚点位置
        Object.assign(tlAnchor.write(Circle), {
            cx: x,
            cy: y,
        });
    }
    // 省略其他锚点处理逻辑
    {
        const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
        const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
        const width = brCx - tlCx;
        const height = brCy - tlCy;
        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
        // 重新计算被选中图形位置和尺寸
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

最后根据左上和右下两个锚点，对选中图形重新进行变换操作。

### 变换图形 {#transform-shape}

现在我们知道了发生 resize 前后的属性（变换和尺寸信息），很容易计算出两个状态间的过渡矩阵：

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

但是我们并不能直接将这个矩阵应用到目标图形上，还需要考虑场景图中父节点在世界坐标系下的变换：

```plaintext
[delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
```

左乘父节点在世界坐标系下的变换的逆变换，可以得到目标图形局部坐标系下的变换：

```plaintext
[new local] = [parent inverted] * [delta] * [parent] * [old local]
```

最后将新的局部坐标系下矩阵应用到目标图形上，不同类型的图形会作用于不同的属性。例如我们不希望对 Text 进行拉伸导致形变，而是通过修改 `fontSize` 实现缩放效果；如果是 Polyline / Path 则需要对每个控制点应用变换得到新的 `points` 或者 `d` 属性值。另外这样也可以确保描边不会被变换影响，毕竟每次都视作产生一个新的图形。

### 锁定长宽比 {#lock-aspect-ratio}

仍然以拖拽左上角锚点为例，锁定长宽比时就不能直接设置它的位置，需要在固定住右下角锚点位置不变的情况下，根据拖拽开始时图形的长宽比重新计算左上角锚点的位置。

首先记录拖拽锚点开始时选中图形的 OBB 和长宽比，等价于对角线的斜率：

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

在拖拽过程中可以实时展示出对角线，给用户明显的提示（一般是虚线）。

### 中心缩放 {#centered-scaling}

还是以左上角锚点为例，此时固定参考点从右下角锚点改成几何中心点，同样是在拖拽行为开始时记录：

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

然后重新计算右下角锚点位置，和左上角锚点对称于中心点：

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

### 翻转 {#flip}

当拖拽锚点或者边到反方向时，会出现翻转现象，下图为 Figma 中的效果，注意 Rotation 的变化：

![Rotate 180 deg when flipped](/resize-flip.gif)

我们用渐变背景来更清晰地展示这种翻转效果：

![Flip a rect with gradient fill](/rotate-when-flipped.png)

## 旋转 {#rotation}

Figma

> Hover just outside one of the layer's bounds until the icon appears.
> Click and drag to rotate your selection:
> Drag clockwise to create a negative angle (towards -180° ).
> Drag counterclockwise to create a positive angle (towards 180° )
> Hold down Shift to snap rotation values to increments of 15.

### 调整旋转中心 {#change-the-rotation-origin}

下图是 Figma [Change the rotation origin] 的效果：

![Change the rotation origin](https://help.figma.com/hc/article_attachments/31937330391447)

## 使用方向键移动图形 {#nudge-the-position}

Figma 提供了 [Nudge layers] 特性，可以使用上下左右方向键移动图形，还可以配合 <kbd>Shift</kbd> 进行更大距离的移动。在我们的实现中就使用固定距离了：

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeOBB(selected, { y: selected.y - 10 });
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
[Check if Point Is Inside A Polygon]: https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
[Gist - point to line 2d]: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
[课程 6 - 坐标系转换]: /zh/guide/lesson-006#coordinates
[SerializedNode]: /zh/guide/lesson-010#shape-to-serialized-node
