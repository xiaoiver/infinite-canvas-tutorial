---
outline: deep
---

# 课程 12 - 折线

让我们继续添加基础图形：折线。在这节课中你将学习到以下内容：

-   为什么不直接使用 `gl.LINES`?
-   在 CPU 或者 Shader 中构建 Mesh
-   分析 Shader 细节，包括：
    -   拉伸顶点与接头
    -   反走样
    -   绘制虚线

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

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

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            fill: 'none',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'bevel',
            fill: 'none',
        });
        canvas.appendChild(polyline2);

        const polyline3 = new Polyline({
            points: [
                [340, 100],
                [340, 200],
                [440, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            fill: 'none',
        });
        canvas.appendChild(polyline3);

        const polyline4 = new Polyline({
            points: [
                [100, 300],
                [200, 300],
                [300, 210],
                [400, 300],
                [500, 300],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            strokeDasharray: [10, 5],
            fill: 'none',
        });
        canvas.appendChild(polyline4);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

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

下图来自 Pixi.js 在 WebGL meetup 上的分享：[How 2 draw lines in WebGL]，本文会大量引用其中的截图，我会把 PPT 中的页数标注上。既然原生方法不可用，还是只能回到构建 Mesh 的传统绘制方案。

![How to draw line in WebGL - page 5](/how-to-draw-line-in-webgl.png)

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
-   顶点固定为 9 个，其中 1234 号顶点组成的两个三角形用来绘制线段部分，56789 号顶点组成的三个三角形用来绘制接头部分
-   当 `strokeLinecap` `strokeLinejoin` 取值为 `round` 时更平滑，原因是在 Fragment Shader 中使用了类似 SDF 绘制圆的方法
-   良好的反走样效果

![pack joints into instances - page 15](/pack-joints-into-instances.png)

```glsl
layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
```

后续其他特性也会基于这种方案实现。

值得注意的是存在一个问题：[WebGPU instancing problem]

## Shader 实现分析 {#shader-implementation}

首先来看如何在线段主体与接头处对顶点进行拉伸。

### 构建顶点 {#construct-vertex}

我们先关注 1 ～ 4 号顶点，即线段的主体部分。考虑该线段与前、后相邻线段呈现的夹角，有以下四种形态 `/-\` `\-/` `/-/` 和 `\-\`：

![extrude along line segment - page 16](/line-vertex-shader.png)

在计算单位法线向量前，先将各个顶点的位置转换到模型坐标系下：

```glsl
vec2 pointA = (model * vec3(a_PointA, 1.0)).xy;
vec2 pointB = (model * vec3(a_PointB, 1.0)).xy;

vec2 xBasis = pointB - pointA;
float len = length(xBasis);
vec2 forward = xBasis / len;
vec2 norm = vec2(forward.y, -forward.x);

xBasis2 = next - base;
float len2 = length(xBasis2);
vec2 norm2 = vec2(xBasis2.y, -xBasis2.x) / len2;
float D = norm.x * norm2.y - norm.y * norm2.x;
```

```glsl
if (abs(D) < 0.01) {
  pos = dy * norm;
} else {
  if (flag < 0.5 && inner < 0.5) {
    pos = dy * norm;
  } else {
    pos = doBisect(norm, len, norm2, len2, dy, inner);
  }
}
```

接头处的角平分线：

```glsl
vec2 doBisect(
  vec2 norm, float len, vec2 norm2, float len2, float dy, float inner
) {
  vec2 bisect = (norm + norm2) / 2.0;
  bisect /= dot(norm, bisect);
  vec2 shift = dy * bisect;
  if (inner > 0.5) {
    if (len < len2) {
      if (abs(dy * (bisect.x * norm.y - bisect.y * norm.x)) > len) {
        return dy * norm;
      }
    } else {
      if (abs(dy * (bisect.x * norm2.y - bisect.y * norm2.x)) > len2) {
        return dy * norm;
      }
    }
  }
  return dy * bisect;
}
```

接下来关注接头处的 5 ~ 9 号顶点：

![extrude along line segment - page 16](/line-vertex-shader2.png)

### 反走样 {#anti-aliasing}

最后我们来看如何对线段边缘进行反走样。之前我们介绍过 [SDF 中的反走样]，这里使用类似思路：

1. 在 Vertex Shader 中计算顶点到线段的垂直单位向量，通过 `varying` 传递给 Fragment Shader 完成自动插值
2. 插值后的向量不再是单位向量了，计算它的长度就是当前像素点到线段的垂直距离，在 `[0, 1]` 范围内
3. 利用这个值计算像素点最终的透明度，完成反走样。`smoothstep` 发生在线段边缘，即 `[linewidth - feather, linewidth + feather]` 的区间内。下图来自：[Drawing Antialiased Lines with OpenGL]，具体计算逻辑稍后会详细介绍。

![feather](https://miro.medium.com/v2/resize:fit:818/format:webp/0*EV5FGcUOHAbFFPjy.jpg)

这个 "feather" 取多少合适呢？在之前的 [绘制矩形外阴影] 中，我们在矩形原有尺寸上外扩了 `3 * dropShadowBlurRadius`。下图依然来自 [How 2 draw lines in WebGL]，向外扩展一个像素（从 `w` -> `w+1`）即可。在另一侧的两个顶点（#3 和 #4 号顶点）距离为负：

```glsl
const float expand = 1.0;
lineWidth *= 0.5;

float dy = lineWidth + expand; // w + 1
if (vertexNum >= 1.5) { // Vertex #3 & #4
  dy = -dy; // -w - 1
}
```

从下右图还可以看出，当我们放大来看 Fragment Shader 中的每一个像素，利用这个有向距离 `d` 就可以计算出线段和当前像素的覆盖度（下图三角形的面积），实现反走样效果。

![extend 1 pixel outside](/line-segment-antialias.png)

那么如何利用这个距离计算覆盖度呢？这里需要分成线段主体和接头情况。

首先来看线段主体的情况，它还可以进一步简化成垂直线段的情况，原作者也提供了考虑旋转的计算方式，与简化的估算版本相差不大。利用 `clamp` 计算单边的覆盖度，另外考虑非常小的线宽情况，将右侧减去左侧得到最终的覆盖度，当作最终颜色的透明度系数。

![calculate coverage according to signed distance](/line-segment-antialias2.png)

当然计算线段部分和直线的相交区域是最简单的情况。接头和端点处的处理会非常复杂，以 Miter 接头为例，依然先忽略旋转仅考虑相邻线段垂直的情况（注意下图右侧的红色方框区域），不同于上面线段仅存在 `d` 这一个有向距离的情况，这里出现了 `d1` 和 `d2` 两个有向距离分别代表接头前后两段线段。同样考虑到一个像素区域内非常细的线，此时覆盖面积就是大小两个正方形的面积差（`a2 * b2 - a1 * b1`）：

![calculate coverage on miter joint](/line-segment-antialias3.png)

Bevel 接头的计算方式大致和 Miter 相同（下图中间情况）。`d3` 代表像素点中心到 "bevel line" 的距离，使用它可以计算下图右侧情况的覆盖度。可以取这两种情况的最小值得到近似计算结果。

![calculate coverage on bevel joint](/line-segment-antialias5.png)

![calculate coverage on bevel joint](/line-segment-antialias4.png)

最后来到圆角接头的情况。需要额外从 Vertex Shader 传递圆心到像素点的距离（类似 SDF 绘制圆）`d3`。

![calculate coverage on round joint](/line-segment-antialias6.png)

![calculate coverage on round joint](/line-segment-antialias7.png)

原作者还提供了精确版本的 `pixelLine` 实现，限于篇幅就不展开了。

### 支持 stroke-alignment {#stroke-alignment}

之前我们在使用 SDF 绘制的 Circle、Ellipse、Rect 上实现了：[增强 SVG: Stroke alignment]。现在让我们为折线也加上这个属性。下图来自 Pixi.js 中的 `lineStyle.alignment` 效果，红色线条表示折线的几何位置，根据取值不同在它上下浮动：

![stroke-alignment - p27](/line-stroke-alignment.png)

在 Shader 中我们将这个属性反映到沿法线拉伸的偏移量上，如果 `strokeAlignment` 取值为 `center` 时偏移量为 `0`：

```glsl
float shift = strokeWidth * strokeAlignment;
pointA += norm * shift;
pointB += norm * shift;
```

从左往右依次是 `outer` `center` 和 `inner` 的效果：

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

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

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'outer',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);
        const polyline4 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            // strokeAlignment: 'outer',
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            cursor: 'pointer',
            fill: 'none',
        });
        canvas.appendChild(polyline2);
        const polyline5 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline5);

        const polyline3 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'inner',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        const polyline6 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline6);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
        polyline2.addEventListener('pointerenter', () => {
            polyline2.stroke = 'green';
        });
        polyline2.addEventListener('pointerleave', () => {
            polyline2.stroke = 'black';
        });
        polyline3.addEventListener('pointerenter', () => {
            polyline3.stroke = 'green';
        });
        polyline3.addEventListener('pointerleave', () => {
            polyline3.stroke = 'black';
        });
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

最后还有两点需要注意：

1. 由于 `stroke-alignment` 并非 SVG 标准属性，因此在导出成 SVG 时需要重新计算 `points`，和 Shader 中沿法线、角平分线拉伸逻辑一致，限于篇幅就不展开了
2. 拾取判定方法即 `containsPoint` 同样需要依据 `points` 计算偏移后的顶点。可以在上面的例子中尝试将鼠标移入移出改变折线的颜色

### 虚线 {#dash}

首先计算每个顶点从起点处经过的距离，以 `[[0, 0], [100, 0], [200, 0]]` 的折线为例，三个 instance 的 `a_Travel` 的值依次为 `[0, 100, 200]`。在 Vertex Shader 中计算拉伸后顶点经过的距离：

```glsl
layout(location = ${Location.TRAVEL}) in float a_Travel;
out float v_Travel;

v_Travel = a_Travel + dot(pos - pointA, vec2(-norm.y, norm.x));
```

在 Fragment Shader 中，将 `stroke-dasharray` 和 `stroke-dashoffset` 的值传入，和 SVG 标准不同，我们暂时仅支持长度为 2 的 `stroke-dasharray`，即 `[10, 5, 2]` 这样的虚线暂不支持。

```glsl
in float v_Travel;

float u_Dash = u_StrokeDash.x;
float u_Gap = u_StrokeDash.y;
float u_DashOffset = u_StrokeDash.z;
if (u_Dash + u_Gap > 1.0) {
  float travel = mod(v_Travel + u_Gap * 0.5 + u_DashOffset, u_Dash + u_Gap) - (u_Gap * 0.5);
  float left = max(travel - 0.5, -0.5);
  float right = min(travel + 0.5, u_Gap + 0.5);
  alpha *= max(0.0, right - left);
}
```

效果如下：

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeDasharray: [10, 10],
            strokeDashoffset: 0,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [300, 100],
                [300, 200],
                [500, 200],
                [500, 100],
            ],
            stroke: 'black',
            strokeWidth: 10,
            strokeDasharray: [2, 10],
            strokeDashoffset: 0,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

按照 SVG 规范，`stroke-dasharray` 和 `stroke-dashoffset` 这两个属性也可以作用在 Circle / Ellipse / Rect 等其他图形上。因此当这两个属性有合理值时，原本使用 SDF 绘制的描边就得改成使用 Polyline 实现。

#### 笔迹动画效果 {#stroke-animation}

#### 蚂蚁线效果 {#antmarch-animation}

## 计算包围盒 {#geometry-bounds}

先忽略绘制属性，几何包围盒的计算非常简单。只需要找到折线所有顶点中的最小和最大坐标：

```ts
const minX = Math.min(...points.map((point) => point[0]));
const maxX = Math.max(...points.map((point) => point[0]));
const minY = Math.min(...points.map((point) => point[1]));
const maxY = Math.max(...points.map((point) => point[1]));

return new AABB(minX, minY, maxX, maxY);
```

一旦涉及到线宽、端点和接头，计算折线的包围盒就会变的比较复杂。如果不需要太精确的结果，可以简单将上述包围盒向外延拓一半的线宽。[Calculate bounding box of line with thickness] 中使用了 Cairo 提供的 [cairo-stroke-extents] 方法，如果线宽为 `0`，它就会退化成 [cairo-path-extents]：

> Computes a bounding box in user coordinates covering the area that would be affected, (the "inked" area)

## 其他问题 {#followup-issues}

### 退化成直线 {#line}

直线并不需要考虑 `strokeLinejoin`，因此简单很多。

### 绘制 Path {#path}

使用折线绘制会存在这样的问题：[Draw arcs, arcs are not smooth ISSUE]

-   [WebGL 3D Geometry - Lathe]
-   [Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]
-   [p5js - bezier()]

至于其他的方式例如 SDF

![SDF line](/sdf-line.png)

### SizeAttenuation {#size-attenuation}

[sizeAttenuation]

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
[SDF 中的反走样]: /zh/guide/lesson-002#antialiasing
[绘制矩形外阴影]: /zh/guide/lesson-009#drop-shadow
[WebGPU instancing problem]: https://github.com/pixijs/pixijs/issues/7511#issuecomment-2247464973
[Draw arcs, arcs are not smooth ISSUE]: https://github.com/pixijs/graphics-smooth/issues/23
[增强 SVG: Stroke alignment]: /zh/guide/lesson-010#stroke-alignment
[Calculate bounding box of line with thickness]: https://stackoverflow.com/questions/51210467/calculate-bounding-box-of-line-with-thickness
[cairo-stroke-extents]: https://cairographics.org/manual/cairo-cairo-t.html#cairo-stroke-extents
[cairo-path-extents]: https://cairographics.org/manual/cairo-Paths.html#cairo-path-extents
