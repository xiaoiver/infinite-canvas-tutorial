---
outline: deep
publish: false
head:
    - - meta
      - name: description
        content: draw path & sketchy rendering
    - - meta
      - name: keywords
        content: webgl webgpu infinite-canvas path-rendering
---

# 课程 13 - 绘制 Path & 手绘风格

在上一节课中我们介绍了折线的绘制方法，Path 的描边部分理论上可以通过采样转换成折线的绘制，[p5js - bezierDetail()] 就是这么做的，如果要实现平滑的效果就需要增加采样点。但填充部分仍需要实现。在本节课中我们将介绍：

-   尝试使用 SDF 绘制
-   通过三角化绘制填充部分
-   实现一些手绘风格图形

## 一些基础概念 {#basic-concepts}

### 与 Polyline 的区别 {#diff-with-polyline}

首先来明确一下 SVG 中对于 [Paths] 的定义，尤其是它和 `<polyline>` 的区别，来自 MDN：

> The \<path\> element is the most powerful element in the SVG library of basic shapes. It can be used to create lines, curves, arcs, and more.
>
> While \<polyline\> and \<path\> elements can create similar-looking shapes, \<polyline\> elements require a lot of small straight lines to simulate curves and don't scale well to larger sizes.

因此用 `<polyline>` 表现曲线时会存在不够平滑的现象，下图来自：[Draw arcs, arcs are not smooth ISSUE]

![polyline - not smooth arc](https://user-images.githubusercontent.com/89827437/191234694-5d5637f8-c59a-42a7-84ce-c319c470629f.png)

但反过来使用 Path 却可以通过类似 `d="M 100 100 L 200 200 L 200 100"` 实现折线。

### 子路径 {#subpath}

除了简单的路径例如一条线、一段曲线，单个 `<path>` 也可以包含一系列的线或者曲线，也可以称作子路径（subpath）。

每个子路径都以一个移动到（moveto）命令开始，通常是 M 或 m，这告诉绘图工具移动到坐标系中的一个新位置，而不会画线。随后可以跟随一系列的绘制命令，比如线段（L 或 l）、水平线段（H 或 h）、垂直线段（V 或 v）、曲线（C、S、Q、T 等）和弧线（A 或 a）。

## 使用 SDF 绘制 {#sdf-path}

之前我们使用 SDF 绘制了 Circle Ellipse 和 Rect，能否针对 Path 也这么做呢？

对于简单的 Path 似乎可行，例如在上节课中原作者的 PPT 中也提到了 shadertoy 上的 [Quadratic Bezier - distance 2D]，对一段单独的贝塞尔曲线确实可行，但对于复杂 Path 就无能为力了，而且在 Fragment Shader 中进行过于复杂的数学运算也会影响性能。

![SDF path](/sdf-line.png)

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/MlKcDD?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### Path2D {#path2d}

[svg-path-sdf] 给出了另一种思路，有趣的是它和后续我们将要介绍的文本绘制思路几乎完全相同。OB 上有一个在线示例：[SDF Points with regl]

![svg-path-sdf](https://github.com/dy/svg-path-sdf/raw/master/preview.png?raw=true)

Canvas2D API 中的 `fill()` 和 `stroke()` 可以接受 [Path2D] 作为参数，后者可以通过 SVG 路径定义直接创建。随后使用 Canvas2D API 生成 SDF 作为纹理传入，具体生成方式可以参考 [tiny-sdf]，我们会在后续介绍文本绘制时详细介绍它。

```ts
// @see https://github.com/dy/svg-path-sdf/blob/master/index.js#L61C3-L63C31
var path2d = new Path2D(path);
ctx.fill(path2d);
ctx.stroke(path2d);

var data = bitmapSdf(ctx);
```

当然 Path2D 是浏览器环境才原生支持的 API，如果想在服务端渲染中使用，需要使用 polyfill，详见：[Support Path2D API]。

## 使用网格绘制 {#use-mesh}

因此对于 Path 常规的方式还是三角化，无论是 2D 还是 3D。下面的示例来自：[SVG loader in three.js]。首先将 SVG 文本转换成一组 `ShapePath`，然后创建一组 `ShapeGeometry` 并渲染：

```ts
const shapes = SVGLoader.createShapes(path);
for (const shape of shapes) {
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder++;

    group.add(mesh);
}
```

Pixi.js 使用了 [earcut] 进行多边形的三角化。其他三角化库还有 [cdt2d] 和 [libtess.js]，后者虽然性能不佳，但胜在精确性，尤其是针对包含大量 `holes` 以及自我交叠的路径。正如 [earcut] 在其文档中提到的，详见 [Ability to substitute earcut for libtess.js for a given Graphics object]：

> If you want to get correct triangulation even on very bad data with lots of self-intersections and earcut is not precise enough, take a look at libtess.js.

下面让我们来实现自己的版本：

-   将路径定义规范到绝对命令
-   在曲线上采样
-   使用 Polyline 绘制描边
-   使用 earcut 三角化，绘制填充

### 转换成绝对路径 {#convert-to-absolute-commands}

SVG 路径命令包含绝对和相对两种，例如：`M 100 100 L 200 100` 和 `M 100 100 l 100 0` 是等价的。为了便于后续处理，我们先将相对命令都转换成绝对命令。Canvas2D API 也采用这种风格，类似 [lineTo]，我们参考 Three.js 的 [ShapePath] 实现，它实现了一系列 [CanvasRenderingContext2D] 的方法例如 `moveTo / lineTo / bezierCurveTo` 等等：

```ts
import { path2Absolute } from '@antv/util';

const path = new ShapePath();
const commands = path2Absolute(d);
commands.forEach((command) => {
    const type = command[0];
    const data = command.slice(1);
    switch (type) {
        case 'M':
            path.moveTo();
        case 'L':
            path.lineTo();
        //...
    }
});
```

下面我们简单介绍下 [ShapePath] 提供的方法，它包含一组 subPath 对应路径定义中的多条命令。以 `moveTo` 和 `lineTo` 为例，前者会创建一条新的 subPath 并设置起点，后者完成到下一个点的连线。

```ts
export class ShapePath {
    currentPath: Path | null;
    subPaths: Path[];

    moveTo(x: number, y: number) {
        this.currentPath = new Path();
        this.subPaths.push(this.currentPath);
        this.currentPath.moveTo(x, y);
        return this;
    }

    lineTo(x: number, y: number) {
        this.currentPath.lineTo(x, y);
        return this;
    }
}
```

下面来看每一个 subPath 的结构。

```ts
export class Path extends CurvePath {}
```

### 在曲线上采样 {#sample-along-path}

针对直线、贝塞尔曲线进行不同精度的采样。这也很好理解：对于贝塞尔曲线，只有增加更多的采样点才能让折线看起来更平滑；对于直线没必要额外增加任何采样点。

```ts
export class CurvePath extends Curve {
    getPoints(divisions = 12) {
        const resolution =
            curve instanceof EllipseCurve
                ? divisions * 2
                : curve instanceof LineCurve
                ? 1
                : divisions;
        const pts = curve.getPoints(resolution);
    }
}
```

以三阶贝塞尔曲线为例，给定归一化后的 `t`，采样点就可以通过其定义得到 [Bézier_curve]：

```ts
export class CubicBezierCurve extends Curve {
    getPoint(t: number) {
        const point = vec2.create();
        const { v0, v1, v2, v3 } = this;

        vec2.set(
            point,
            CubicBezier(t, v0[0], v1[0], v2[0], v3[0]),
            CubicBezier(t, v0[1], v1[1], v2[1], v3[1]),
        );

        return point;
    }
}
```

这里有一个圆形 Path 的例子，采样后的顶点列表如下：

```js eval
points = call(() => {
    const { Path } = Lesson13;
    return new Path({
        d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
        fill: 'black',
        opacity: 0.5,
    }).points;
});
```

### 使用 Polyline 绘制描边 {#use-polyline-to-draw-stroke}

现在我们已经有了所有 subPath 上的采样点，可以分别绘制描边和填充，前者可以使用上一节课实现的 Polyline，每一个 subPath 对应一个 drawcall。

### 使用 earcut 三角化 {#triangulation}

使用 [earcut] 完成三角化，输入采样点坐标得到索引数组：

```ts
const { d } = path;
const { subPaths } = parsePath(d);
const points = subPaths
    .map((subPath) => subPath.getPoints().map((point) => [point[0], point[1]]))
    .flat(2); // [100, 100, 200, 200, 300, 100, 100, 100]
const triangles = earcut(points); // [1, 3, 2]
```

这样我们就可以使用 `gl.drawElements()` 或者 `passEncoder.drawIndexed()` 完成绘制了。下图中左侧 Path 定义如下，和右侧使用 SDF 绘制的 Circle 对比后可以看出边缘其实并不平滑，在相机放大后更为明显：

```ts
const path = new Path({
    d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
    fill: 'black',
    opacity: 0.5,
});
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Path, Circle } = Lesson13;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.camera.zoom = 2;

        const path = new Path({
            d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
            fill: 'black',
            opacity: 0.5,
        });
        path.position.x = 100;
        path.position.y = 100;
        canvas.appendChild(path);

        const circle = new Circle({
            cx: 0,
            cy: 0,
            r: 40,
            fill: 'black',
            opacity: 0.5,
        });
        circle.position.x = 200;
        circle.position.y = 100;
        canvas.appendChild(circle);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### holes {#holes}

值得注意的是

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Path, Circle } = Lesson13;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const ring = new Path({
            d: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z M 50 30 A 20 20 0 1 1 50 70 A 20 20 0 1 1 50 30 Z',
            fill: 'black',
            opacity: 0.5,
        });
        ring.position.x = 100;
        ring.position.y = 100;
        canvas.appendChild(ring);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## 手绘风格 {#sketchy}

[excalidraw] 使用了 [rough] 进行手绘风格的绘制。

![rough.js](https://camo.githubusercontent.com/5d90838c20ae2cab9f295e3dd812800285c42e82d04787883c9d5acecaec85ed/68747470733a2f2f726f7567686a732e636f6d2f696d616765732f6361705f64656d6f2e706e67)

## 扩展阅读 {#extended-reading}

-   [Rendering SVG Paths in WebGL]
-   [Shaping Curves with Parametric Equations]
-   [WebGL 3D Geometry - Lathe]
-   [Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]
-   [GPU-accelerated Path Rendering]

[Paths]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
[Quadratic Bezier - distance 2D]: https://www.shadertoy.com/view/MlKcDD
[Path2D]: https://developer.mozilla.org/en-US/docs/Web/API/Path2D
[svg-path-sdf]: https://github.com/dy/svg-path-sdf/
[SDF Points with regl]: https://observablehq.com/@rreusser/sdf-points-with-regl
[WebGL 3D Geometry - Lathe]: https://webglfundamentals.org/webgl/lessons/webgl-3d-geometry-lathe.html
[Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]: https://www.youtube.com/watch?v=s3k8Od9lZBE
[Shaping Curves with Parametric Equations]: https://mattdesl.svbtle.com/shaping-curves-with-parametric-equations
[Rendering SVG Paths in WebGL]: https://css-tricks.com/rendering-svg-paths-in-webgl/
[GPU-accelerated Path Rendering]: https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf
[p5js - bezierDetail()]: https://p5js.org/reference/p5/bezierDetail/
[rough]: https://github.com/rough-stuff/rough
[excalidraw]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/scene/ShapeCache.ts#L2
[Draw arcs, arcs are not smooth ISSUE]: https://github.com/pixijs/graphics-smooth/issues/23
[SVG loader in three.js]: https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_svg.html#L156
[earcut]: https://github.com/mapbox/earcut
[cdt2d]: https://github.com/mikolalysenko/cdt2d
[libtess.js]: https://github.com/brendankenny/libtess.js
[Ability to substitute earcut for libtess.js for a given Graphics object]: https://github.com/pixijs/pixijs/issues/4151
[lineTo]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineTo
[Support Path2D API]: https://github.com/Automattic/node-canvas/issues/1116
[tiny-sdf]: https://github.com/mapbox/tiny-sdf
[ShapePath]: https://github.com/mrdoob/three.js/blob/dev/src/extras/core/ShapePath.js
[CanvasRenderingContext2D]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
[Bézier_curve]: https://en.wikipedia.org/wiki/B%C3%A9zier_curve
