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

在上一节课中我们介绍了折线的绘制方法，Path 的描边部分理论上可以通过采样转换成折线的绘制，但填充部分仍需要实现。在本节课中我们将介绍：

-   尝试使用 SDF 绘制
-   通过三角化绘制填充部分
-   实现一些手绘风格图形

首先来明确一下 SVG 中对于 [Paths] 的定义，尤其是它和 `<polyline>` 的区别，来自 MDN：

> The \<path\> element is the most powerful element in the SVG library of basic shapes. It can be used to create lines, curves, arcs, and more.
>
> While \<polyline\> and \<path\> elements can create similar-looking shapes, \<polyline\> elements require a lot of small straight lines to simulate curves and don't scale well to larger sizes.

因此用 `<polyline>` 表现曲线时会存在不够平滑的现象，下图来自：[Draw arcs, arcs are not smooth ISSUE]

![polyline - not smooth arc](https://user-images.githubusercontent.com/89827437/191234694-5d5637f8-c59a-42a7-84ce-c319c470629f.png)

但反过来使用 Path 却可以通过类似 `d="M 100 100 L 200 200 L 200 100"` 实现折线。

## 使用 SDF 绘制 {#sdf-path}

之前我们使用 SDF 绘制了 Circle Ellipse 和 Rect，能否针对 Path 也这么做呢？

对于简单的 Path 似乎可行，例如在上节课中原作者的 PPT 中也提到了 shadertoy 上的 [Quadratic Bezier SDF]。但对于复杂 Path 就无能为力了，而且在 Fragment Shader 中进行过于复杂的数学运算也会影响性能。

![SDF path](/sdf-line.png)

[svg-path-sdf] 给出了另一种思路，它使用 [Path2D] 在 Canvas2D 中生成 SDF，这种思路在后续我们介绍文本绘制时还会使用。OB 上有一个在线示例：[SDF Points with regl]

![svg-path-sdf](https://github.com/dy/svg-path-sdf/raw/master/preview.png?raw=true)

## 三角化 {#triangulation}

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

### 转换成绝对路径 {#convert-to-absolute-commands}

SVG 路径命令包含绝对和相对两种，例如：`M 100 100 L 200 100` 和 `M 100 100 l 100 0` 是等价的。为了便于后续处理，我们先将相对命令都转换成绝对命令。Canvas2D API 也采用这种风格，类似 [lineTo]：

```ts
import { path2Absolute } from '@antv/util';
const commands = path2Absolute(d);

commands.forEach((command) => {
    const type = command[0];
    const data = command.slice(1);
    switch (type) {
        case 'M':
        case 'L':
        //...
    }
});
```

-   [Rendering SVG Paths in WebGL]
-   [Shaping Curves with Parametric Equations]
-   [WebGL 3D Geometry - Lathe]
-   [Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]
-   [p5js - bezier()]
-   [GPU-accelerated Path Rendering]

## 手绘风格 {#sketchy}

[excalidraw] 使用了 [rough] 进行手绘风格的绘制。

![rough.js](https://camo.githubusercontent.com/5d90838c20ae2cab9f295e3dd812800285c42e82d04787883c9d5acecaec85ed/68747470733a2f2f726f7567686a732e636f6d2f696d616765732f6361705f64656d6f2e706e67)

[Paths]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
[Quadratic Bezier SDF]: https://www.shadertoy.com/view/XsX3zf
[Path2D]: https://developer.mozilla.org/en-US/docs/Web/API/Path2D
[svg-path-sdf]: https://github.com/dy/svg-path-sdf/
[SDF Points with regl]: https://observablehq.com/@rreusser/sdf-points-with-regl
[WebGL 3D Geometry - Lathe]: https://webglfundamentals.org/webgl/lessons/webgl-3d-geometry-lathe.html
[Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]: https://www.youtube.com/watch?v=s3k8Od9lZBE
[Shaping Curves with Parametric Equations]: https://mattdesl.svbtle.com/shaping-curves-with-parametric-equations
[Rendering SVG Paths in WebGL]: https://css-tricks.com/rendering-svg-paths-in-webgl/
[GPU-accelerated Path Rendering]: https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf
[p5js - bezier()]: https://p5js.org/reference/p5/bezier/
[rough]: https://github.com/rough-stuff/rough
[excalidraw]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/scene/ShapeCache.ts#L2
[Draw arcs, arcs are not smooth ISSUE]: https://github.com/pixijs/graphics-smooth/issues/23
[SVG loader in three.js]: https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_svg.html#L156
[earcut]: https://github.com/mapbox/earcut
[cdt2d]: https://github.com/mikolalysenko/cdt2d
[libtess.js]: https://github.com/brendankenny/libtess.js
[Ability to substitute earcut for libtess.js for a given Graphics object]: https://github.com/pixijs/pixijs/issues/4151
[lineTo]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineTo
