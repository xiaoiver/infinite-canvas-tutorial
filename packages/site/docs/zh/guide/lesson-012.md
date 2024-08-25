---
outline: deep
---

# 课程 12 - 折线

## gl.LINES 的局限性 {#limitation-of-gl-lines}

WebGL 原生提供的 `gl.LINES` 和 `gl.LINE_STRIP` 在实际场景中往往并不好用：

-   不支持宽度。如果我们尝试使用 [lineWidth]，常见浏览器例如 Chrome 会抛出警告：

> [!WARNING]
> As of January 2017 most implementations of WebGL only support a minimum of 1 and a maximum of 1 as the technology they are based on has these same limits.

-   无法定义相邻线段间的连接形状 [lineJoin] 和端点形状 [lineCap]
-   默认实现存在明显的锯齿，需要额外反走样

![aliased lines](/aliased-lines.png)

需要注意的是，在 [课程 5 - 直线网格] 中的方案并不适合绘制任意线段，它甚至无法任意定义线段的两个端点。另外线段和折线的最大区别在于对于接头处的处理，deck.gl 就分别提供了 [LineLayer] 和 [PathLayer]。

现在让我们明确一下希望实现的折线相关特性：

-   支持任意线宽
-   支持定义任意数量的端点。类似 SVG 的 [points] 属性。
-   支持相邻线段间的连接形状 [stroke-linejoin] 和端点形状 [stroke-linecap]
-   支持虚线。[stroke-dashoffset] 和 [stroke-dasharray]
-   良好的反走样效果
-   支持 instanced 绘制，详见之前介绍过的 [instanced drawing]

我们设计的 API 如下：

```ts
const line = new Polyline({
  points: [
    [0, 0],
    [100, 100]
  ],
  strokeWidth: 100,
  strokeLinejoin: 'round'
  strokeLinecap: 'round',
  strokeMiterlimit: 4,
  strokeDasharray: [4, 1],
  strokeDashoffset: 10
});
```

先来看第一个问题：如何实现任意数值的 `strokeWidth`。

## 构建 Mesh {#construct-mesh}

下图来自 Pixi.js 在 WebGL meetup 上的分享：[How 2 draw lines in WebGL]。既然原生方法不可用，还是只能回到构建 Mesh 的传统绘制方案。

![How to draw line in WebGL](/how-to-draw-line-in-webgl.png)

常用的做法是沿线段法线方向进行拉伸后三角化。下图来自 [Drawing Antialiased Lines with OpenGL]，线段两个端点分别沿红色虚线法向向两侧拉伸，形成 4 个顶点，三角化成 2 个三角形，这样 `strokeWidth` 就可以是任意值了。

![extrude line](/extrude-line.png)

### 在 CPU 中构建 {#construct-mesh-on-cpu}

线段的拉伸以及 `strokeLinejoin` 和 `strokeLinecap` 的 Mesh 构建可以在 CPU 或 Shader 中完成。按照前者思路的实现包括：

-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [regl-gpu-lines]

![segment instance mesh](https://wwwtyro.net/media/instanced-lines/segment-instance.svg)

![segment instance, lineCap and lineJoin meshes](https://rreusser.github.io/regl-gpu-lines/docs/debug.png)

可以看出在 `strokeLinejoin` 和 `strokeLinecap` 取值为 `round` 的情况下，为了让圆角看起来平滑，构建 Mesh 需要最多的顶点数。在 [regl-gpu-lines] 中，每一段至多需要 `32 * 4 + 6 = 134` 个顶点：

```ts
// @see https://github.com/rreusser/regl-gpu-lines/blob/main/src/index.js#L81
cache.indexBuffer = regl.buffer(
    new Uint8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys()]), // MAX_ROUND_JOIN_RESOLUTION = 32
);
```

`strokeLinecap` 和线段需要分成不同 Drawcall 绘制，还是以 [regl-gpu-lines] 的 [instanced example] 为例，需要编译两个 Program 并使用 3 个 Drawcall 绘制，其中：

-   两个端点使用同一个 Program，只是 Uniform `orientation` 不同。顶点数目为 `cap + join`
-   所有中间的线段使用使用一个 Drawcall 绘制，顶点数目为 `join + join`，instance 数目为线段数目

```ts
const computeCount = isEndpoints
    ? // Draw a cap
      (props) => [props.capRes2, props.joinRes2]
    : // Draw two joins
      (props) => [props.joinRes2, props.joinRes2];
```

如果存在多条折线，可以进行合并的条件是 `strokeLinecap` 和 `strokeLinejoin` 的取值以及线段数量相同。下图展示了绘制了 5 条折线的情况，其中每一条折线的中间线段部分包含 8 个 `instance`，因此 `instance` 总数为 40：

![drawcalls for linecap and segments](/regl-gpu-lines.png)

下面让我们仔细分析一下 Vertex Shader 中的处理逻辑。

最后没有进行任何反走样处理。

### 在 Shader 中构建 {#construct-mesh-on-shader}

来自 Pixi.js 在 WebGL meetup 上的分享，在 Shader 中构建 Mesh：

-   [How 2 draw lines in WebGL]
-   [pixijs/graphics-smooth]

相比在 CPU 中构建，它的优点包括：

-   只需要一个 Drawcall 绘制 `strokeLinecap` `strokeLineJoin` 和中间线段
-   顶点固定为 9 个，其中
-   当 `strokeLinecap` `strokeLinejoin` 取值为 `round` 时更平滑，原因是在 Fragment Shader 中使用了类似 SDF 绘制圆的方法
-   良好的反走样效果

![pack joints into instances](/pack-joints-into-instances.png)

```glsl
layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
```

后续其他特性也会基于这种方案实现。

## 虚线 {#dash}

### 其他图形上的实现 {#dash-on-other-shapes}

按照 SVG 规范，`stroke-dasharray` 和 `stroke-dashoffset` 这两个属性也可以作用在 Circle / Ellipse / Rect 等其他图形上。因此当这两个属性有合理值时，原本使用 SDF 绘制的描边就得改成使用 Polyline 实现。

## 绘制 Path {#path}

-   [WebGL 3D Geometry - Lathe]
-   [Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]
-   [p5js - bezier()]

## SizeAttenuation {#size-attenuation}

[sizeAttenuation]

## 退化成直线 {#line}

直线并不需要考虑 `strokeLinejoin`，因此简单很多。

## 其他方式 {#other-solution}

下图来自 Pixi.js 在 WebGL meetup 上的分享：[How 2 draw lines in WebGL]。

![SDF line](/sdf-line.png)

### SDF {#sdf}

## 计算包围盒 {#geometry-bounds}

## 扩展阅读 {#extended-reading}

-   [How 2 draw lines in WebGL]
-   [regl-gpu-lines]
-   [Drawing Instanced Lines with regl]
-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [pixijs/graphics-smooth]

[课程 5 - 直线网格]: /zh/guide/lesson-005#lines-grid
[lineJoin]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineJoin
[lineCap]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineCap
[lineWidth]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/lineWidth
[points]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
[stroke-linejoin]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
[stroke-linecap]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
[stroke-dashoffset]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
[Instanced Line Rendering Part I]: https://wwwtyro.net/2019/11/18/instanced-lines.html
[Instanced Line Rendering Part II]: https://wwwtyro.net/2021/10/01/instanced-lines-part-2.html
[LineLayer]: https://deck.gl/docs/api-reference/layers/line-layer
[PathLayer]: https://deck.gl/docs/api-reference/layers/path-layer
[Drawing Antialiased Lines with OpenGL]: https://blog.mapbox.com/drawing-antialiased-lines-with-opengl-8766f34192dc
[regl-gpu-lines]: https://github.com/rreusser/regl-gpu-lines
[instanced example]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Drawing Instanced Lines with regl]: https://observablehq.com/@rreusser/drawing-instanced-lines-with-regl
[pixijs/graphics-smooth]: https://github.com/pixijs/graphics-smooth
[How 2 draw lines in WebGL]: https://www.khronos.org/assets/uploads/developers/presentations/Crazy_Panda_How_to_draw_lines_in_WebGL.pdf
[instanced drawing]: /zh/guide/lesson-008#instanced
[sizeAttenuation]: https://threejs.org/docs/#api/en/materials/SpriteMaterial.sizeAttenuation
[WebGL 3D Geometry - Lathe]: https://webglfundamentals.org/webgl/lessons/webgl-3d-geometry-lathe.html
[Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]: https://www.youtube.com/watch?v=s3k8Od9lZBE
[p5js - bezier()]: https://p5js.org/reference/p5/bezier/
