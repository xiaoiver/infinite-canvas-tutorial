---
outline: deep
---

# Lesson 12 - Polylines

Let's continue adding basic shapes: polylines. In this lesson, you will learn the following:

-   Why not use `gl.LINES` directly?
-   Building Mesh in CPU or Shader
-   Analyzing Shader details, including:
    -   Stretching vertices and joints
    -   Anti-aliasing
    -   Drawing dashed lines
-   How to calculate the bounding box of a polyline?

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline, Rect } = Lesson12;

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

        const rect2 = new Rect({
            x: 500,
            y: 100,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Limitations of gl.LINES {#limitation-of-gl-lines}

The `gl.LINES` and `gl.LINE_STRIP` provided by WebGL are often not very practical in real scenarios:

-   Do not support width. If we try to use [lineWidth], common browsers such as Chrome will throw a warning:

> [!WARNING]
> As of January 2017 most implementations of WebGL only support a minimum of 1 and a maximum of 1 as the technology they are based on has these same limits.

-   Unable to define the connection shape between adjacent line segments [lineJoin] and the shape of the endpoints [lineCap]
-   The default implementation has noticeable jaggies, requiring additional anti-aliasing

It should be noted that the solution in [Lesson 5 - Line Grid] is not suitable for drawing arbitrary line segments; it can't even define the two endpoints of a line segment arbitrarily. In addition, the biggest difference between line segments and polylines is the treatment at the joints, for which deck.gl provides [LineLayer] and [PathLayer] respectively.

Now let's clarify the features we want to implement for polylines:

-   Support for arbitrary line widths
-   Support for defining an arbitrary number of endpoints. Similar to the SVG [points] attribute.
-   Support for connection shapes between adjacent line segments [stroke-linejoin] and endpoint shapes [stroke-linecap]
-   Support for dashed lines. [stroke-dashoffset] and [stroke-dasharray]
-   Good anti-aliasing effect
-   Support for instanced drawing, see the previously introduced [instanced drawing]

Our designed API is as follows:

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

Let's first look at the first question: how to implement arbitrary values of `strokeWidth`.

## Building Mesh {#construct-mesh}

The following image comes from the WebGL meetup shared by Pixi.js: [How 2 draw lines in WebGL]. This article will heavily reference screenshots from it, and I will label the page numbers in the PPT. Since native methods are not available, we can only return to the traditional drawing scheme of building Mesh.

![How to draw line in WebGL - page 5](/how-to-draw-line-in-webgl.png)

The common practice is to stretch and triangulate in the direction of the normal of the line segment. The following image comes from [Drawing Antialiased Lines with OpenGL]. The two endpoints of the line segment are stretched to both sides along the red dashed line normal, forming 4 vertices, triangulated into 2 triangles, so `strokeWidth` can be any value.

![extrude line](/extrude-line.png)

### Building on CPU {#construct-mesh-on-cpu}

The stretching of the line segment and the Mesh construction of `strokeLinejoin` and `strokeLinecap` can be done in the CPU or Shader. Implementations following the former approach include:

-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [regl-gpu-lines]

![segment instance mesh](https://wwwtyro.net/media/instanced-lines/segment-instance.svg)

![segment instance, lineCap and lineJoin meshes](https://rreusser.github.io/regl-gpu-lines/docs/debug.png)

It can be seen that when `strokeLinejoin` and `strokeLinecap` take the value of `round`, in order to make the rounded corners look smooth, the Mesh construction requires the most vertices. In [regl-gpu-lines], each segment requires up to `32 * 4 + 6 = 134` vertices:

```ts
// @see https://github.com/rreusser/regl-gpu-lines/blob/main/src/index.js#L81
cache.indexBuffer = regl.buffer(
    new Uint8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys()]), // MAX_ROUND_JOIN_RESOLUTION = 32
);
```

`strokeLinecap` and line segments need to be drawn in different Drawcall, still taking the [instanced example] of [regl-gpu-lines] as an example, it requires compiling two Programs and using 3 Drawcall to draw, among which:

-   The two endpoints use the same Program, but the Uniform `orientation` is different. The number of vertices is `cap + join`
-   All middle line segments are drawn using one Drawcall, the number of vertices is `join + join`, and the number of instances is the number of line segments

```ts
const computeCount = isEndpoints
    ? // Draw a cap
      (props) => [props.capRes2, props.joinRes2]
    : // Draw two joins
      (props) => [props.joinRes2, props.joinRes2];
```

If there are multiple polylines, the conditions for merging are the same values of `strokeLinecap` and `strokeLinejoin` and the number of line segments. The following figure shows the situation of drawing 5 polylines, among which each polyline's middle segment part contains 8 `instance`, so the total number of `instance` is 40:

![drawcalls for linecap and segments](/regl-gpu-lines.png)

### Building in Shader {#construct-mesh-on-shader}

From the WebGL meetup shared by Pixi.js, building Mesh in Shader:

-   [How 2 draw lines in WebGL]
-   [pixijs/graphics-smooth]

Compared with building on the CPU, its advantages include:

-   Only one Drawcall is needed to draw `strokeLinecap` `strokeLineJoin` and the middle segment
-   The vertices are fixed at 9, where vertices 1234 form two triangles for drawing the line segment part, and vertices 56789 form three triangles for drawing the joint part
-   When `strokeLinecap` `strokeLinejoin` take the value of `round`, it is smoother because a method similar to SDF drawing circles is used in the Fragment Shader
-   Good anti-aliasing effect

![pack joints into instances - page 15](/pack-joints-into-instances.png)

```glsl
layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
```

The Buffer layout is as follows, with each Stride size being `4 * 3`. In the Buffer, the same continuous data such as `x1 y1 t1` is read as `A_0` in the first instance, and as `Prev_1` in the second instance. This intersecting layout can save the maximum amount of Buffer size:

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 3,
                shaderLocation: Location.POINTA,
            },
            {
                format: Format.F32_R,
                offset: 4 * 5,
                shaderLocation: Location.VERTEX_JOINT,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 6,
                shaderLocation: Location.POINTB,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 9,
                shaderLocation: Location.NEXT,
            },
        ],
    },
];
```

Unfortunately, if we switch to the WebGPU renderer, we will get the following error:

> [!WARNING]
> Attribute offset (12) with format VertexFormat::Float32x2 (size: 8) doesn't fit in the vertex buffer stride (12).

The reason is that WebGPU has the following verification rule for VertexBufferLayout, and our arrayStride is `4 * 3`. [WebGPU instancing problem] and [spec: It is useful to allow GPUVertexBufferLayout.arrayStride to be less than offset + sizeof(attrib.format)] also mention this.

> attrib.offset + byteSize(attrib.format) ≤ descriptor.arrayStride.
>
> 4 _3 + 4_ 2 ≤ 4 \* 3 // Oops!

Therefore, we have to change the layout of the Buffer. First, in the Layout, we split the layout from one Buffer containing multiple Attributes to multiple Buffers, each containing only one Attribute:

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
        ],
    },
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.POINTA,
            },
        ],
    },
    // Omit VERTEX_JOINT
    // Omit POINTB
    // Omit NEXT
];
```

Although split into multiple BufferLayout declarations, the actual reference is to the same Buffer, only the corresponding Attribute is read via `offset`, see details: [Offset in bytes into buffer where the vertex data begins]。

```ts
const buffers = [
    {
        buffer: this.#segmentsBuffer, // PREV
    },
    {
        buffer: this.#segmentsBuffer, // POINTA
        offset: 4 * 3,
    },
    {
        buffer: this.#segmentsBuffer, // VERTEX_JOINT
        offset: 4 * 5,
    },
    {
        buffer: this.#segmentsBuffer, // POINTB
        offset: 4 * 6,
    },
    {
        buffer: this.#segmentsBuffer, // NEXT
        offset: 4 * 9,
    },
];
renderPass.setVertexInput(this.#inputLayout, buffers, {
    buffer: this.#indexBuffer,
});
```

Other features will also be implemented based on this scheme later.

## Shader Implementation Analysis {#shader-implementation}

First, let's see how to stretch vertices at the main body and joints of the line segment.

### Extrude segment {#extrude-segment}

Let's focus on vertices 1 to 4, that is, the main part of the line segment. Considering the angle at which the line segment and its adjacent line segments present, there are the following four forms `/-\` `\-/` `/-/` and `\-\`:

![extrude along line segment - page 16](/line-vertex-shader.png)

Before calculating the unit normal vector, convert the position of each vertex to the model coordinate system:

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

In the first form, for example, vertices 1 and 2 are stretched outward along the normal, and vertices 3 and 4 are stretched inward along the angle bisectors (`doBisect()`) of the joints:

```glsl
if (vertexNum < 3.5) { // Vertex #1 ~ 4
    if (abs(D) < 0.01) {
        pos = dy * norm;
    } else {
        if (flag < 0.5 && inner < 0.5) { // Vertex #1, 2
            pos = dy * norm;
        } else { // Vertex #3, 4
            pos = doBisect(norm, len, norm2, len2, dy, inner);
        }
    }
}
```

### Extrude linejoin {#extrude-linejoin}

Next, we focus on vertices 5~9 at the joint, the stretching direction and distance varies according to the shape of the joint, the original author's implementation is very complex, in which `bevel` and `round` share the same stretching method, and the latter in the Fragment Shader and then through the SDF to complete the rounded corners of the drawing.

![extrude along line segment - page 16](/line-vertex-shader2.png)

Let's start our analysis with the simplest `miter`, which by definition converts to `bevel` if `strokeMiterlimit` is exceeded.

```glsl
if (length(pos) > abs(dy) * strokeMiterlimit) {
    type = BEVEL;
} else {
    if (vertexNum < 4.5) {
        dy = -dy;
        pos = doBisect(norm, len, norm2, len2, dy, 1.0);
    } else if (vertexNum < 5.5) {
        pos = dy * norm;
    } else if (vertexNum > 6.5) {
        pos = dy * norm2;
    }
    v_Type = 1.0;
    dy = -sign * dot(pos, norm);
    dy2 = -sign * dot(pos, norm2);
    hit = 1.0;
}
```

It is worth mentioning that in Cairo, whether to use round or bevel joints needs to be determined based on `arc height`. The following figure comes from: [Cairo - Fix for round joins]

![Cairo - Fix for round joins](https://gitlab.freedesktop.org/-/project/956/uploads/b53d20cf0156e48b4a9766f6c5ff5cff/round_join.png)

### Anti-aliasing {#anti-aliasing}

Finally, let's see how to anti-alias the edges of the line segment. We have introduced [anti-aliasing in SDF] before, and here we use a similar approach:

1. Calculate the vertical unit vector from the vertex to the line segment in the Vertex Shader and pass it to the Fragment Shader through `varying` for automatic interpolation
2. The interpolated vector is no longer a unit vector. Calculate its length, which is the perpendicular distance from the current pixel point to the line segment, within the range `[0, 1]`
3. Use this value to calculate the final transparency of the pixel point, completing anti-aliasing. `smoothstep` occurs at the edge of the line segment, that is, within the interval `[linewidth - feather, linewidth + feather]`. The following figure comes from: [Drawing Antialiased Lines with OpenGL], and the specific calculation logic will be introduced later.

![feather](https://miro.medium.com/v2/resize:fit:818/format:webp/0*EV5FGcUOHAbFFPjy.jpg)

How much should this "feather" be? In the previous [drawing rectangle outer shadow], we expanded the original size of the rectangle by `3 * dropShadowBlurRadius`. The following figure still comes from [How 2 draw lines in WebGL], expanding one pixel outward (from `w` -> `w+1`) is enough. At the other side, the distance of the two vertices (#3 and #4 vertices) is negative:

```glsl
const float expand = 1.0;
lineWidth *= 0.5;

float dy = lineWidth + expand; // w + 1
if (vertexNum >= 1.5) { // Vertex #3 & #4
  dy = -dy; // -w - 1
}
```

From the bottom right figure, it can also be seen that when we zoom in to look at every pixel in the Fragment Shader, using this directed distance `d`, we can calculate the coverage of the line segment and the current pixel (the area of the triangle in the following figure), achieving an anti-aliasing effect.

![extend 1 pixel outside](/line-segment-antialias.png)

So how to use this distance to calculate coverage? This needs to be divided into the main body of the line segment and the joint situation.

First, let's look at the situation of the main body of the line segment, which can be further simplified into the case of a vertical line segment. The original author also provided a calculation method considering rotation, which is not much different from the simplified estimation version. Use `clamp` to calculate the coverage on one side, and also consider the case of a very thin line width, subtract the left side from the right side to get the final coverage, as the transparency coefficient of the final color.

![calculate coverage according to signed distance](/line-segment-antialias2.png)

Of course, calculating the intersection area between the line segment part and the straight line is the simplest case. The treatment at the joints and endpoints will be very complex. Taking the Miter joint as an example, still ignore the rotation and only consider the case where the adjacent line segments are perpendicular (note the red box area on the right side of the following figure). Unlike the line segment above, which only has one directed distance `d`, here there are two directed distances `d1` and `d2` representing the front and back two line segments at the joint. Similarly, considering a very thin line within a pixel area, the coverage area is the area difference between the two squares (`a2 * b2 - a1 * b1`):

![calculate coverage on miter joint](/line-segment-antialias3.png)

The calculation method for the Bevel joint is roughly the same as the Miter (the middle situation in the following figure). `d3` represents the distance from the center of the pixel to the "bevel line", and it can be used to calculate the coverage on the right side of the following figure. You can take the minimum value of these two situations to get an approximate calculation result.

![calculate coverage on bevel joint](/line-segment-antialias5.png)

![calculate coverage on bevel joint](/line-segment-antialias4.png)

Finally, let's come to the case of rounded joints. It requires an additional distance `d3` from the center of the circle to the pixel point (similar to SDF drawing circles) passed from the Vertex Shader.

![calculate coverage on round joint](/line-segment-antialias6.png)

![calculate coverage on round joint](/line-segment-antialias7.png)

The original author also provided an exact version of `pixelLine` implementation, which will not be expanded due to space limitations.

### Support for stroke-alignment {#stroke-alignment}

We previously implemented [Enhanced SVG: Stroke alignment] on Circle, Ellipse, and Rect drawn with SDF. Now let's add this attribute to polylines. The following figure comes from the `lineStyle.alignment` effect in Pixi.js, where the red line represents the geometric position of the polyline, and it floats up and down according to different values:

![stroke-alignment - p27](/line-stroke-alignment.png)

In the Shader, we reflect this attribute in the offset along the normal stretch. If the `strokeAlignment` takes the value of `center`, the offset is `0`:

```glsl
float shift = strokeWidth * strokeAlignment;
pointA += norm * shift;
pointB += norm * shift;
```

From left to right are the effects of `outer`, `center`, and `inner`:

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

Finally, there are two points to note:

1. Since `stroke-alignment` is not a standard SVG attribute, it is necessary to recalculate `points` when exporting to SVG, which is consistent with the logic of stretching along the normal and angle bisector in the Shader, which will not be expanded due to space limitations
2. The picking determination method, that is, `containsPoint`, also needs to be calculated based on the offset vertices of `points`. You can try to change the color of the polyline by moving the mouse in and out of the above example

### Dashed Lines {#dash}

First, calculate the distance each vertex has traveled from the starting point. Taking the polyline of `[[0, 0], [100, 0], [200, 0]]` as an example, the `a_Travel` values of the three instances are `[0, 100, 200]`. Calculate the stretched vertex distance in the Vertex Shader:

```glsl
layout(location = ${Location.TRAVEL}) in float a_Travel;
out float v_Travel;

v_Travel = a_Travel + dot(pos - pointA, vec2(-norm.y, norm.x));
```

In the Fragment Shader, pass in the values of `stroke-dasharray` and `stroke-dashoffset`. Different from the SVG standard, we only support `stroke-dasharray` of length 2 for the time being, that is, dashed lines like `[10, 5, 2]` are not supported.

```glsl
in float v_Travel;

float u_Dash = u_StrokeDash.x;
float u_Gap = u_StrokeDash.y;
float u_DashOffset = u_StrokeDash.z;
if (u_Dash + u_Gap > 1.0) {
  float travel = mod(v_Travel + u_Gap * v_ScalingFactor * 0.5 + u_DashOffset, u_Dash * v_ScalingFactor + u_Gap * v_ScalingFactor) - (u_Gap * v_ScalingFactor * 0.5);
  float left = max(travel - 0.5, -0.5);
  float right = min(travel + 0.5, u_Gap * v_ScalingFactor + 0.5);
  alpha *= antialias(max(0.0, right - left));
}
```

We can also change (increment) `stroke-dashoffset` in real-time to achieve an ant line effect. Such animation effects are usually implemented through the SVG attribute of the same name, see: [How to animate along an SVG path at the same time the path animates?]

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

    let polyline1;
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        polyline1 = new Polyline({
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
        polyline1.strokeDashoffset += 0.1;
    });
});
```

Another implementation method uses `fract()`, see: [Pure WebGL Dashed Line].

According to the SVG specification, the attributes `stroke-dasharray` and `stroke-dashoffset` can also be applied to other shapes such as Circle / Ellipse / Rect. Therefore, when these two attributes have reasonable values, the outline drawn with SDF originally needs to be changed to Polyline implementation. Taking Rect as an example, up to 3 drawcalls may be needed to draw the outer shadow, the main body of the rectangle, and the dashed outline:

```ts
SHAPE_DRAWCALL_CTORS.set(Rect, [ShadowRect, SDF, SmoothPolyline]);
```

Taking Rect as an example, we need to artificially construct a polyline based on the `x / y / width / height` attributes, which includes 6 vertices. It is worth noting that the first 5 can actually complete the closure, but we add an extra `[x + epsilon, y]` to complete the final `strokeLinejoin`. Circle and Ellipse are similar, only adding more sampling points to ensure smoothness (here we use `64`):

```ts
if (object instanceof Polyline) {
    points = object.points.reduce((prev, cur) => {
        prev.push(cur[0], cur[1]);
        return prev;
    }, [] as number[]);
} else if (object instanceof Rect) {
    const { x, y, width, height } = object;
    points = [
        x,
        y,
        x + width,
        y,
        x + width,
        y + height,
        x,
        y + height,
        x,
        y,
        x + epsilon,
        y,
    ];
}
```

```js eval code=false
$icCanvas5 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect, Circle, Ellipse } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas5.parentElement.style.position = 'relative';
    $icCanvas5.parentElement.appendChild($stats);

    $icCanvas5.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            stroke: 'red',
            strokeWidth: 10,
        });
        rect.width = 100;
        rect.height = 100;
        canvas.appendChild(rect);

        const rect2 = new Rect({
            x: 200,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);

        const circle = new Circle({
            cx: 400,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(circle);

        const circle2 = new Circle({
            cx: 550,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 20],
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle2);

        const ellipse = new Ellipse({
            cx: 150,
            cy: 250,
            rx: 100,
            ry: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(ellipse);
    });

    $icCanvas5.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Calculating the Bounding Box {#geometry-bounds}

Let's temporarily step out of rendering and do some geometric calculations. As introduced in previous lessons, bounding boxes need to be calculated in both picking and culling.

Ignoring drawing attributes such as line width, the calculation of the geometric bounding box is very simple. Just find the minimum and maximum coordinates of all vertices of the polyline:

```ts
const minX = Math.min(...points.map((point) => point[0]));
const maxX = Math.max(...points.map((point) => point[0]));
const minY = Math.min(...points.map((point) => point[1]));
const maxY = Math.max(...points.map((point) => point[1]));

return new AABB(minX, minY, maxX, maxY);
```

Once line width, endpoints, and joints are involved, calculating the bounding box of a polyline becomes more complex. If a precise result is not required, you can simply extend the aforementioned bounding box outward by half the line width. [Calculate bounding box of line with thickness] uses the [cairo-stroke-extents] method provided by Cairo. If the line width is `0`, it will degrade into [cairo-path-extents]:

> Computes a bounding box in user coordinates covering the area that would be affected, (the "inked" area)

Continuing to delve into the Cairo source code, it can be found that for stroke bounding boxes, it also provides two methods (omitting a large number of parameters here), the former uses an estimation method and is therefore faster, while the latter will consider the specific shapes of endpoints and joints for precise calculation:

```c
cairo_private void
_cairo_path_fixed_approximate_stroke_extents ();

cairo_private cairo_status_t
_cairo_path_fixed_stroke_extents ();
```

### Quick Estimation {#approximate-stroke-extents}

This estimation refers to expanding a certain distance outward along the horizontal and vertical directions on the basis of the geometric bounding box: `style_expansion * strokeWidth`.

```c
/*
 * For a stroke in the given style, compute the maximum distance
 * from the path that vertices could be generated.  In the case
 * of rotation in the ctm, the distance will not be exact.
 */
void
_cairo_stroke_style_max_distance_from_path (const cairo_stroke_style_t *style,
         const cairo_path_fixed_t *path,
                                            const cairo_matrix_t *ctm,
                                            double *dx, double *dy)
{
    double style_expansion = 0.5;

    if (style->line_cap == CAIRO_LINE_CAP_SQUARE)
 style_expansion = M_SQRT1_2;

    if (style->line_join == CAIRO_LINE_JOIN_MITER &&
 ! path->stroke_is_rectilinear &&
 style_expansion < M_SQRT2 * style->miter_limit)
    {
 style_expansion = M_SQRT2 * style->miter_limit;
    }

    style_expansion *= style->line_width;
}
```

Considering the case of `stroke-linecap="square"`, the following figure shows that in the most ideal situation, `style_expansion` equals `0.5`, that is, extending `0.5 * strokeWidth` from the red body, and the black area is the bounding box of the `<polyline>`.

<svg xmlns="http://www.w3.org/2000/svg" width="400" height="30">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="10,10 300,10"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="10,10 300,10"
    />
  </g>
</svg>

But if the polyline is slightly tilted at 45 degrees, the distance extended outward at this time is `sqrt(2) / 2 * strokeWidth`:

<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="30,30 200,200"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="30,30 200,200"
    />
    <polygon
      fill="none"
      stroke="red"
      stroke-width="2"
      points="15,15 215,15 215,215 15,215"
    />
  </g>
</svg>

Similarly, the case of `stroke-linejoin="miter"` also needs to be considered. It can be seen that this estimation method will not precisely consider every vertex and joint, but only make the most optimistic estimate to ensure that the bounding box can accommodate the polyline.

### Precise Calculation {#stroke-extents}

If you really want to calculate precisely? Cairo's idea is to first convert it into a Polygon, and then calculate its bounding box:

![stroke extents](/polyline-extents.png)

```c
cairo_status_t
_cairo_path_fixed_stroke_extents (const cairo_path_fixed_t *path,
      const cairo_stroke_style_t *stroke_style,
      const cairo_matrix_t  *ctm,
      const cairo_matrix_t  *ctm_inverse,
      double    tolerance,
      cairo_rectangle_int_t  *extents)
{
    cairo_polygon_t polygon;
    cairo_status_t status;
    cairo_stroke_style_t style;

    _cairo_polygon_init (&polygon, NULL, 0);
    status = _cairo_path_fixed_stroke_to_polygon (path,
        stroke_style,
        ctm, ctm_inverse,
        tolerance,
        &polygon);
    _cairo_box_round_to_rectangle (&polygon.extents, extents);
    _cairo_polygon_fini (&polygon);

    return status;
}
```

## Performance Testing {#perf}

Let's test the performance, showing several polylines each containing 20,000 points:

```js eval code=false
$icCanvas4 = call(() => {
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

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    let polyline1;
    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const data = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50]);
        polyline1 = new Polyline({
            points: data,
            stroke: 'black',
            strokeWidth: 2,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const data2 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 100]);
        polyline2 = new Polyline({
            points: data2,
            stroke: 'black',
            strokeWidth: 2,
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        const data3 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 200]);
        polyline3 = new Polyline({
            points: data3,
            stroke: 'black',
            strokeWidth: 2,
            strokeDasharray: [4, 4],
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

It seems not bad, but after careful consideration, there are still the following issues, which can be considered as future improvement directions:

-   Due to the fact that each Instance uses 15 vertices, and the Buffer has a size limit, the actual number of vertices contained in a single polyline is limited
-   Currently, one polyline corresponds to one Drawcall. What if there are a large number of similar repeated polylines? [regl-gpu-lines] provides two ideas:
    -   One Drawcall can also draw multiple polylines, using `[NaN, NaN]` to indicate breakpoints, example: [Multiple lines]
    -   If the vertex data of multiple polylines is the same, and only the offset is different, then each polyline can be regarded as an Instance. Of course, the vertices inside each polyline need to be expanded, example: [Fake instancing]

## Other Issues {#followup-issues}

So far, we have completed the basic drawing work of polylines. Finally, let's take a look at other related issues. Due to space limitations, some issues will be detailed in future lessons.

### SizeAttenuation {#size-attenuation}

In some scenarios, we do not want the graphics to change size with the camera zoom, such as the bounding box wireframe and the size labels below it when selecting a shape in Figma:

![size attenuation in Figma](/size-attenuation.gif)

This is called `sizeAttenuation` in Three.js. In Perspective projection mode, Sprites become smaller as the camera depth increases. We will implement this later when we implement the selected UI.

### Line Path and Polygon {#line-path-polygon}

In SVG, there are still three elements: `<line>` `<path>` and `<polygon>`, among which:

-   `<line>` does not need to consider `strokeLinejoin`, so the number of vertices used can be simplified
-   The filling part of `<polygon>` can be drawn after triangulation using some algorithms such as earcut, and the outline part is exactly the same as the polyline
-   `<path>` can also be sampled on the path in a similar way to `<rect>` `<circle>`, and finally drawn with polylines, but there will be such a problem: [Draw arcs, arcs are not smooth ISSUE]

If SDF drawing is used, more mathematical calculations are required in the Fragment Shader, which has some performance issues:

![SDF path](/sdf-line.png)

Therefore, the conventional way for Path is still triangulation, whether it is 2D or 3D:

-   [Rendering SVG Paths in WebGL]
-   [Shaping Curves with Parametric Equations]
-   [WebGL 3D Geometry - Lathe]
-   [Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]
-   [p5js - bezier()]
-   [GPU-accelerated Path Rendering]

We will introduce in detail how to draw them in the next lesson.

## Extended Reading {#extended-reading}

-   [How 2 draw lines in WebGL]
-   [regl-gpu-lines]
-   [Drawing Instanced Lines with regl]
-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [pixijs/graphics-smooth]

[Lesson 5 - Line Grid]: /guide/lesson-005#lines-grid
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
[instanced drawing]: /guide/lesson-008#instanced
[WebGL 3D Geometry - Lathe]: https://webglfundamentals.org/webgl/lessons/webgl-3d-geometry-lathe.html
[Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]: https://www.youtube.com/watch?v=s3k8Od9lZBE
[p5js - bezier()]: https://p5js.org/reference/p5/bezier/
[Anti-aliasing in SDF]: /guide/lesson-002#antialiasing
[Drawing rectangle outer shadow]: /guide/lesson-009#drop-shadow
[WebGPU instancing problem]: https://github.com/pixijs/pixijs/issues/7511#issuecomment-2247464973
[spec: It is useful to allow GPUVertexBufferLayout.arrayStride to be less than offset + sizeof(attrib.format)]: https://github.com/gpuweb/gpuweb/issues/2349
[Draw arcs, arcs are not smooth ISSUE]: https://github.com/pixijs/graphics-smooth/issues/23
[Enhanced SVG: Stroke alignment]: /guide/lesson-010#stroke-alignment
[Calculate bounding box of line with thickness]: https://stackoverflow.com/questions/51210467/calculate-bounding-box-of-line-with-thickness
[cairo-stroke-extents]: https://cairographics.org/manual/cairo-cairo-t.html#cairo-stroke-extents
[cairo-path-extents]: https://cairographics.org/manual/cairo-Paths.html#cairo-path-extents
[Shaping Curves with Parametric Equations]: https://mattdesl.svbtle.com/shaping-curves-with-parametric-equations
[Rendering SVG Paths in WebGL]: https://css-tricks.com/rendering-svg-paths-in-webgl/
[GPU-accelerated Path Rendering]: https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf
[Cairo - Fix for round joins]: https://gitlab.freedesktop.org/cairo/cairo/-/merge_requests/372#note_1698225
[Pure WebGL Dashed Line]: https://webgl2fundamentals.org/webgl/lessons/webgl-qna-pure-webgl-dashed-line.html
[How to animate along an SVG path at the same time the path animates?]: https://benfrain.com/how-to-animate-along-an-svg-path-at-the-same-time-the-path-animates/
[Fake instancing]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Multiple lines]: https://rreusser.github.io/regl-gpu-lines/docs/multiple.html
[Offset in bytes into buffer where the vertex data begins]: https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-setvertexbuffer-slot-buffer-offset-size-offset
