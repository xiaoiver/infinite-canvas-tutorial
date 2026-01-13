---
outline: deep
description: '绘制矩形模式。实现画笔功能，包括画线消抖动算法和丝滑绘制体验。学习p5.brush等画笔库的实现原理和优化技术。'
head:
    - ['meta', { property: 'og:title', content: '课程 25 - 绘制模式与笔刷' }]
---

<script setup>
import DrawRect from '../../components/DrawRect.vue'
import DrawArrow from '../../components/DrawArrow.vue'
import Pencil from '../../components/Pencil.vue'
import PencilFreehand from '../../components/PencilFreehand.vue'
import Brush from '../../components/Brush.vue'
import LaserPointer from '../../components/LaserPointer.vue'
import Eraser from '../../components/Eraser.vue'
</script>

# 课程 25 - 绘制模式与笔刷

在 [课程 14 - 画布模式] 中我们介绍了手型和选择模式，在本节课中我们将介绍绘制模式：包括矩形、椭圆和箭头，以及更加自由的笔刷模式。

## 矩形绘制模式 {#draw-rect-mode}

<DrawRect />

首先增加以下模式，绘制椭圆的实现几乎一致，就不重复介绍了：

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

在 [课程 18 - 使用 ECS 重构] 中我们介绍了 ECS 架构，这里创建一个 `DrawRect` 的 System，一旦进入该模式，就将鼠标样式设置为 `crosshair`：

```ts
import { System } from '@lastolivegames/becsy';

export class DrawRect extends System {
    execute() {
        if (pen !== Pen.DRAW_RECT) {
            return;
        }

        const input = canvas.write(Input);
        const cursor = canvas.write(Cursor);

        cursor.value = 'crosshair';
        //...
    }
}
```

然后随着鼠标拖拽，在目标区域不断重绘矩形，类似选择模式中的框选效果。当鼠标抬起完成矩形的创建，从绘制矩形模式切换到选择模式：

```ts
export class DrawRect extends System {
    execute() {
        //...
        // 拖拽，绘制辅助 UI
        this.handleBrushing(api, x, y);

        if (input.pointerUpTrigger) {
            // 鼠标抬起，创建矩形
            const node: RectSerializedNode = {
                id: uuidv4(),
                type: 'rect', // 椭圆绘制模式下改成 'ellipse' 即可
                x,
                y,
                width,
                height,
            };
            api.setAppState({ penbarSelected: Pen.SELECT }); // 模式切换
            api.updateNode(node);
            api.record(); // 保存历史记录
        }
    }
}
```

接下来我们来看在拖拽过程中发生了什么。

### 重绘辅助矩形 {#redraw-rect}

和框选类似，为了避免拖拽一小段距离就开始绘制，我们需要设置一段阈值，在 Viewport 坐标系下计算：

```ts
handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const {
        pointerDownViewportX,
        pointerDownViewportY,
    } = camera.read(ComputedCameraControl);

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
        distanceBetweenPoints(
            viewportX,
            viewportY,
            pointerDownViewportX,
            pointerDownViewportY,
        ) > 10;
}
```

辅助矩形的位置坐标 `x/y` 就是 `pointerdown` 触发时的位置，接下来也需要将 `pointermove` 事件对象的坐标转换到 Canvas 坐标系下计算此时的宽高：

```ts
const { x: cx, y: cy } = api.viewport2Canvas({
    x: viewportX,
    y: viewportY,
});

let x = pointerDownCanvasX;
let y = pointerDownCanvasY;
let width = cx - x;
let height = cy - y;

api.updateNode(
    selection.brush,
    {
        visibility: 'visible',
        x,
        y,
        width,
        height,
    },
    false,
);
```

值得一提的是需要考虑反向拖拽的场景，此时计算出的 `width/height` 可能为负数，相应的 `x/y` 就不再是 `pointerdown` 时的位置，需要重新计算。Figma 也是这么做的：

```ts
if (width < 0) {
    x += width;
    width = -width;
}
if (height < 0) {
    y += height;
    height = -height;
}
```

### 绘制尺寸标签 {#size-label}

我们希望在绘制过程中实时展示矩形的尺寸，就像 Figma 这样：

![Size label in Figma](/figma-size-label.png)

同样，这类视口空间的标注图形放在 SVG 容器中很合适，正如下文会介绍的激光笔和橡皮擦。矩形标签使用 CSS 样式设置背景颜色、padding、居中等等，文本内容使用包围盒的宽高：

```ts
label.style.visibility = 'visible';
label.style.top = `${y + height}px`;
label.style.left = `${x + width / 2}px`;
label.innerText = `${Math.round(width)} × ${Math.round(height)}`;
```

如果绘制的是直线，标签可以沿着直线方向旋转，但需要让文本始终正向展示，你可以在下一节的箭头例子中体验：

```ts
label.style.top = `${y + height / 2}px`;
const rad = Math.atan2(height, width);
let deg = rad * (180 / Math.PI);
if (deg >= 90 && deg <= 180) {
    deg = deg - 180;
} else if (deg <= -90 && deg >= -180) {
    deg = deg + 180;
}
label.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
```

### 按住 Shift 绘制正方形 {#draw-square-with-shift}

最后，按住 <kbd>Shift</kbd> 可以以相同的宽高绘制正方形（正圆），此时使用宽高绝对值的最小值作为正方形的边长。

```ts
if (isSquare) {
    if (Math.abs(width) > Math.abs(height)) {
        width = Math.sign(width) * Math.abs(height);
    } else {
        height = Math.sign(height) * Math.abs(width);
    }
}
```

## 绘制箭头 {#draw-arrow}

除了矩形、椭圆、折线等基础图形，箭头这样的复合图形也很常用。我们暂时不涉及箭头的绑定关系（被箭头首尾关联的图形发生移动，箭头的朝向也跟着改变），后面放到单独的一章中介绍，这里仅关注箭头的绘制方式。

在 SVG 中首先使用 `<marker>` 声明箭头，通常是一个 `<path>`，然后通过目标图形的 [marker-start] 和 [marker-end] 属性关联箭头：

```html
<defs>
    <!-- arrowhead marker definition -->
    <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
</defs>
<!-- Coordinate axes with a arrowhead in both direction -->
<polyline
    points="10,10 10,90 90,90"
    fill="none"
    stroke="black"
    marker-start="url(#arrow)"
    marker-end="url(#arrow)"
/>
```

这种将箭头端点与主体分离的方式十分灵活。但在图形编辑器场景下，只需要提供一些预设的常见样式即可。例如 Figma 中的箭头就是通过附加在 Path 的两个端点（`start/end point`）上实现的，包括 `line/triangle/diamond` 等若干种预设样式，详见：[How to Curve an Arrow in Figma]

![Arrow in Figma](/arrow-in-figma.png)

因此在声明式用法中，我们完全可以牺牲自定义箭头样式这一特性，提供一系列内置的箭头样式字面量，在构建 Polyline / Path 时将箭头端点和主体一并生成。这种思路在使用 SVG 渲染的 [plot - arrow] 中也可以看到，它并没有使用 `<marker>`，而是一个完整的 `<path>` 定义。

```ts
export interface MarkerAttributes {
    markerStart: Marker['start'];
    markerEnd: Marker['end'];
}
```

接下来我们来看具体的构建 geometry 过程。

### 起始点和终点 {#start-end-point}

首先需要找到箭头的起始点和终点。但朝向需要手动计算，计算方式并不复杂，沿切线即可。

<DrawArrow />

### 导出 SVG {#export-arrow-to-svg}

SVG 中可以通过 [orient] 属性调整 `<marker>` 的朝向，但需要注意该属性的字面量只有 `'auto'` 和 `'auto-start-reverse'` 两个值

```ts
if (isEnd) {
    $marker.setAttribute('orient', 'auto');
} else {
    $marker.setAttribute('orient', 'auto-start-reverse');
}
```

然后根据 marker 的类型创建 `<path>`，让它继承目标图形的 `stroke` 等属性。你可以在 [export arrow] 测试用例中查看导出结果：

```ts
if (marker === 'line') {
    const points = lineArrow(0, 0, arrowRadius, Math.PI);
    const $path = createSVGElement('path');
    $path.setAttribute('fill', 'none');
    $path.setAttribute('stroke', stroke);
    $path.setAttribute('stroke-width', `${strokeWidth}`);
    $marker.appendChild($path);
}
```

与之相对的，导出的 SVG 也要支持再导入画布。

## [WIP] 绘制多边形 {#draw-polygon}

[Shape tools - polygons]

## 铅笔工具 {#pencil-tool}

首先我们先来看最简单的一种实现，使用折线展示，在 Figma 中称作 Pencil。

为了尽可能减少拖拽过程中产生的顶点，尤其是大量重复的、或者距离较近的顶点，我们使用 [课程 12 - 简化折线的顶点] 中介绍的方法对折线进行简化，选择[simplify-js] 实现。值得注意的是 `tolerance` 这个参数的定义，它会影响简化程度：

> Affects the amount of simplification (in the same metric as the point coordinates).

我们希望根据当前的相机缩放等级设置不同的 `tolerance`，否则在高缩放等级下过度简化造成的抖动会被很容易看出来：

![Over simplified polyline in 4x zoom level](/over-simplified-polyline.gif)

```ts
import simplify from 'simplify-js';

export class DrawPencil extends System {
    private handleBrushing() {
        // choose tolerance based on the camera zoom level
        const tolerance = 1 / zoom;
        selection.points = simplify(selection.pointsBeforeSimplify, tolerance);
    }
}
```

<Pencil />

### Perfect freehand {#perfect-freehand}

由于线宽是固定的，显得不够“灵动”。为了营造一些手写感，可以让线条跟随压力变化。为此我们可以使用 [perfect-freehand]，值得一提的是在 Excalidraw 中还未接入，详见：[Perfect Freehand Drawing Issue]。

由于线宽可变，最终绘制出来的图形不再是 Polyline 而是 Path：

```ts
import { getStroke } from 'perfect-freehand';

const outlinePoints = getStroke(points);
const d = getSvgPathFromStroke(outlinePoints); // 'M 0 0 L...'
```

<PencilFreehand />

默认情况下 [perfect-freehand] 是通过相邻点的距离计算可变的线宽，来模拟笔触的快慢。在带有压力感应的输入设备(pen or stylus)场景下，可以将事件自带的 [pressure] 映射上去：

```ts
export class Input {
    @field.float32 declare pressure: number; // [!code ++]
}
```

此时就可以关闭默认的模拟行为：

```ts
const outlinePoints = getStroke(inputPoints, {
    simulatePressure: false,
});
```

## 笔刷模式 {#brush-mode}

在 Photoshop Web 中进入 Paint 模式后可以选择这个子工具，通过连续拖拽绘制笔迹：

![Brush mode in Photoshop Web](/photoshopweb-brush-mode.png)

在 Figma 中称作 [Draw with illustration tools]。

如果我们仔细观察这类笔迹，可以看出它是由一组连续的圆点组成，如果这些圆点具有不同的半径，就能呈现粗细可变的效果。在实现时可以将画笔的压力映射到半径上：

![source: https://shenciao.github.io/brush-rendering-tutorial/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/brushes-9e58d24a7f40847be1ad6c1cb9f1b9dc.jpg)

下面我们参考 [Brush Rendering Tutorial] 来实现这一效果。

### 基础实现 {#basic-implementation}

基础数据结构如下：

```ts
interface BrushPoint {
    x: number;
    y: number;
    radius: number;
}
```

折线的 $N$ 个顶点组成了 $N-1$ 条线段，每条线段由两个三角形、4 个顶点组成。在 [课程 12 - 线段主体拉伸] 中，我们介绍过使用 9 个顶点。这里使用完全相同的方法，但无需考虑线段的接头，因此只需要使用 4 个顶点，使用 instanced 绘制：

```ts
renderPass.drawIndexed(6, points.length - 1); // indices: [0, 1, 2, 0, 2, 3]
```

我们在 [课程 12 - 线段主体拉伸] 中介绍过，可以将 `a_VertexNum` 传入 Vertex Shader。如果不考虑 WebGL 1 的兼容性，也可以像 [Brush Rendering Tutorial] 这样，直接使用 `gl_VertexID`：

```glsl
layout(location = ${Location.POINTA}) in vec3 a_PointA;
layout(location = ${Location.POINTB}) in vec3 a_PointB;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum; // [0, 1, 2, 3]
```

顺便介绍下其他 `attributes`，`a_PointA` 和 `a_PointB` 除了存储顶点位置坐标，还存储了可变半径。同样我们使用了 `vertexBufferOffsets` 复用同一块 Buffer，`a_PointB` 从 `4 * 3` 的偏移量后开始读取。这样有了顶点序号就可以在 Vertex Shader 中进行拉伸了：

![source: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/coordinate-68714349e3013c769921a0eb25796188.png)

```glsl
vec2 position;
vec2 offsetSign;
float r;
if (vertexNum < 0.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, -1.0);
} else if (vertexNum < 1.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, 1.0);
}
```

为了支持可变宽度，拉伸的距离并不总是等于当前点的半径，而是需要根据线段的斜率计算：

![source: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/var-parameters-9d4c6d7aa31d0f61fd39ba9f69eaae6d.png)

效果如下：

<Brush />

### 贴图 {#stamp}

这样的效果还不太像真实的笔触。

![source: https://shenciao.github.io/brush-rendering-tutorial/Basics/Stamp/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/stamp-to-stroke-082a5ddd80c45086b810ed8b9ebcea79.gif)

### 导出 SVG {#export-brush-to-svg}

Figma 是可以将 Brush 导出 SVG 的。

## 激光笔 {#laser-pointer}

在画布中进行演示功能时，激光笔是一个必备的功能。Excalidraw 支持这一功能，详见：[laser pointer]，我们可以直接使用它封装好的 [@excalidraw/laser-pointer]，根据传入的一组点坐标生成轨迹路径，底层使用的也是 [perfect-freehand]。

这一特性与之前在画布上绘制的图形不同：

1. 绘制激光笔的轨迹发生在视口坐标系下，和当前画布缩放等级无关，因此可以在一个独立的 HTML 容器中完成，详见：[课程 29 - HTML 容器]
2. 轨迹在一定时间后自动消失
3. 考虑多人协同场景，详见：[课程 20 - Awareness 和 Presence]

<LaserPointer />

## 橡皮擦 {#eraser}

Excalidraw 支持 [freedraw eraser]，选中橡皮擦工具后，按下鼠标后经过的图形会“虚化”，表示即将被删除，抬起鼠标完成擦除。

在实现中，我们使用上一节介绍过的 Perfect freehand 绘制拖动的轨迹，但仅保存最近的 4 个点。同时实时检测经过的图形，设置它们的透明度（但记得保存原有的透明度，以备取消时回复），在鼠标抬起时删除选中的图形：

```ts
export class DrawEraser extends System {
    execute() {
        if (input.pointerUpTrigger) {
            api.runAtNextTick(() => {
                api.updateNode(brush, { visibility: 'hidden' }, false);
                api.setAppState({
                    penbarSelected: Pen.SELECT,
                });
                api.deleteNodesById(
                    Array.from(selected).map((e) => api.getNodeByEntity(e)?.id),
                );
                api.record();
            });
        }
    }
}
```

<Eraser />

### [WIP] 非原子化 {#non-atomic}

以整个图形为单位擦除在大多数场景下都足够使用了，但在手绘类场景中非原子化的擦除更实用，例如将一条直线从中间断开。Excalidraw 暂时没有支持这一特性，详见：[non-atomic erasing for linear & freedraw shapes]，FigJam 也是这样。如果画布是基于 Canvas 或者 SVG 渲染的，确实无法实现这种像素级擦除效果。

由于我们的画布是基于 WebGL / WebGPU 实现的，最适合的技术就是 stencil buffer。首先将橡皮擦的路径绘制在 stencil buffer 中，然后以它作为 mask 重绘场景。以 OpenGL 为例（WebGL 完全类似）：

```c++
// 1. Disable color/depth writes, enable stencil, and draw the eraser shape:
//    This writes “1” into the stencil where the eraser stamp is drawn.
glColorMask(false,false,false,false);
glDepthMask(false);
glEnable(GL_STENCIL_TEST);
glStencilFunc(GL_ALWAYS, 1, 0xFF);
glStencilOp(GL_REPLACE, GL_REPLACE, GL_REPLACE);
// draw eraser brush geometry here (e.g. a textured quad or circle)

glColorMask(true,true,true,true);
glDepthMask(true);
// 2. Now render the shapes with stencil test=EQUAL, so only pixels where stencil==1 pass:
glStencilFunc(GL_EQUAL, 1, 0xFF);
glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
// draw all scene objects (they will only appear where eraser just wrote 1)
```

## 扩展阅读 {#extended-reading}

-   [Draw with illustration tools]
-   [Brush Rendering Tutorial]
-   [p5.brush]
-   [Real-Time Paint System with WebGL]
-   [简简单单实现画笔工具，轻松绘制丝滑曲线]

[课程 14 - 画布模式]: /zh/guide/lesson-014
[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[Draw with illustration tools]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
[Real-Time Paint System with WebGL]: https://chrisarasin.com/paint-system-webgl
[简简单单实现画笔工具，轻松绘制丝滑曲线]: https://zhuanlan.zhihu.com/p/701668081
[课程 12 - 简化折线的顶点]: /zh/guide/lesson-012#simplify-polyline
[simplify-js]: https://github.com/mourner/simplify-js
[Brush Rendering Tutorial]: https://shenciao.github.io/brush-rendering-tutorial/
[课程 12 - 线段主体拉伸]: /zh/guide/lesson-012#extrude-segment
[How to Curve an Arrow in Figma]: https://imagy.app/how-to-curve-an-arrow-in-figma/
[marker-start]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-start
[marker-end]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end
[Shape tools - polygons]: https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools#polygons
[plot - arrow]: https://github.com/observablehq/plot/blob/main/src/marks/arrow.js
[orient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/orient
[export arrow]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/ecs/snapshots/export-arrow.svg
[perfect-freehand]: https://github.com/steveruizok/perfect-freehand
[Perfect Freehand Drawing Issue]: https://github.com/excalidraw/excalidraw/issues/4802
[pressure]: https://developer.mozilla.org/docs/Web/API/PointerEvent/pressure
[freedraw eraser]: https://github.com/excalidraw/excalidraw/issues/3682
[non-atomic erasing for linear & freedraw shapes]: https://github.com/excalidraw/excalidraw/issues/4904
[laser pointer]: https://github.com/excalidraw/excalidraw/issues/5351
[@excalidraw/laser-pointer]: https://www.npmjs.com/package/@excalidraw/laser-pointer
[课程 29 - HTML 容器]: /zh/guide/lesson-029#create-html-container
[课程 20 - Awareness 和 Presence]: /zh/guide/lesson-020#awareness-presence
