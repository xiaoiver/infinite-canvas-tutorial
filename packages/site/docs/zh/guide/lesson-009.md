---
outline: deep
---

# 课程 9 - 绘制椭圆、矩形和折线

## 绘制椭圆和矩形 {#drawing-ellipse-rect}

在 [课程 2] 中我们使用 SDF 绘制了圆形，很容易将它扩展到椭圆和矩形。

```glsl
// @see http://www.iquilezles.org/www/articles/ellipsoids/ellipsoids.htm
float sdEllipsoidApproximated(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

// @see https://www.shadertoy.com/view/4llXD7
float sdRoundedBox(vec2 p, vec2 b, float r) {
  p = abs(p) - b + r;
  return length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - r;
}
```

使用

```glsl

```

## 绘制折线 {#drawing-line}

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
-   支持 instanced 绘制

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

### 任意线宽 {#line-width}

常用的做法是沿线段法线方向进行拉伸后三角化。下图来自 [Drawing Antialiased Lines with OpenGL]，线段两个端点分别沿红色虚线法向向两侧拉伸，形成 4 个顶点，三角化成 2 个三角形。

![extrude line](/extrude-line.png)

### lineJoin {#line-join}

### lineCap {#line-cap}

### 虚线 {#dash}

## 扩展阅读 {#extended-reading}

-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]

[课程 2]: /zh/guide/lesson-002
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
