---
outline: deep
description: 'Draw rectangle mode. Implementation of brush features, including line drawing algorithms to eliminate jitter and silky smooth drawing experience. Learn the implementation principles and optimization techniques of brush libraries such as p5.brush.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lesson 25 - Drawing mode and brush',
          },
      ]
---

<script setup>
import DrawRect from '../components/DrawRect.vue'
import DrawArrow from '../components/DrawArrow.vue'
import Pencil from '../components/Pencil.vue'
import PencilFreehand from '../components/PencilFreehand.vue'
import Brush from '../components/Brush.vue'
import LaserPointer from '../components/LaserPointer.vue'
import Eraser from '../components/Eraser.vue'
</script>

# Lesson 25 - Drawing mode and brush

In [Lesson 14 - Canvas mode and auxiliary UI] we introduced hand and selection modes, and in this lesson we'll introduce drawing modes: rectangles, ellipses, and arrows, as well as the more free-form brush modes.

## Draw rect mode {#draw-rect-mode}

<DrawRect />

First add the following canvas mode. The implementation of drawing ellipses is almost identical, so I won't repeat the introduction:

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

In [Lesson 18 - Refactor with ECS] we introduced the ECS architecture, where a `DrawRect` System is created, and once in that mode, the cursor style is set to `crosshair`:

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

Then as the mouse is dragged, the rectangle is continually redrawn in the target area, similar to the box selection effect in selection mode. When the mouse is lifted to complete the creation of the rectangle, it switches from draw rectangle mode to selection mode:

```ts
export class DrawRect extends System {
    execute() {
        //...
        // Draw rect brush when dragging
        this.handleBrushing(api, x, y);

        if (input.pointerUpTrigger) {
            // Create rect when pointerup event triggered
            const node: RectSerializedNode = {
                id: uuidv4(),
                type: 'rect', // Change to 'ellipse' in draw-ellipse mode
                x,
                y,
                width,
                height,
            };
            api.setAppState({ penbarSelected: Pen.SELECT }); // Switch canvas mode
            api.updateNode(node);
            api.record(); // Save to history
        }
    }
}
```

Next we look at what happens during the drag and drop process.

### Redraw rect {#redraw-rect}

Similar to box selection, in order to avoid dragging a small distance and starting to draw, we need to set a threshold, calculated in the Viewport coordinate system:

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

The `x/y` coordinates of the auxiliary rectangle are where the `pointerdown` was triggered, and the coordinates of the `pointermove` event object need to be converted to the Canvas coordinate system to compute the width and height:

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

It is worth to consider the scenario of reverse dragging, where the calculated `width/height` may be negative, and the corresponding `x/y` will no longer be at the position of the `pointerdown` and will have to be recalculated. Figma does the same:

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

### Size label {#size-label}

We want to show the dimensions of the rectangle in real time during the drawing process, like Figma does:

![Size label in Figma](/figma-size-label.png)

Similarly, annotations in this type of viewport space are well-suited for placement within SVG containers, as demonstrated by the laser pointer and eraser tools described below. Rectangular labels utilize CSS styles to set background color, padding, centering, and other properties, while text content employs the bounding box's width and height:

```ts
label.style.visibility = 'visible';
label.style.top = `${y + height}px`;
label.style.left = `${x + width / 2}px`;
label.innerText = `${Math.round(width)} × ${Math.round(height)}`;
```

If drawing a straight line, labels can rotate along the line's direction while ensuring text always faces forward. You can experience this in the arrow example in the next section:

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

## Draw arrow {#draw-arrow}

Beyond basic shapes like rectangles, ellipses, and polylines, composite shapes such as arrows are also commonly used. We will not cover arrow binding relationships (where the arrow's direction changes when the shapes connected by its head and tail move) at this time; this topic will be addressed in a separate chapter. Here, we focus solely on how arrows are drawn.

Arrows are first declared in SVG using a `<marker>`, usually a `<path>`, and then associated with arrows via the [marker-start] and [marker-end] attributes of the target graphic:

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

This way of separating the arrow endpoints from the body is very flexible. However, in a graphical editor scenario, it is sufficient to provide some preset common styles. For example, the arrow in Figma is realized by attaching it to the two endpoints of the Path (`start/end point`), with several preset styles such as `line/triangle/diamond`, see [How to Curve an Arrow in Figma].

![Arrow in Figma](/arrow-in-figma.png)

So in declarative usage, it's perfectly acceptable to sacrifice the feature of custom arrow styles and provide a set of built-in arrow style literals that generate the arrow endpoints along with the body when constructing the Polyline / Path. This idea can also be seen in [plot - arrow] rendered using SVG, which doesn't use `<marker>`, but a full `<path>` definition.

```ts
export interface MarkerAttributes {
    markerStart: Marker['start'];
    markerEnd: Marker['end'];
}
```

Next, let's look at the geometry construction process.

### Start and end point {#start-end-point}

First you need to find the start and end points of the arrows.

However, the orientation needs to be calculated manually, which is not complicated, along the tangent line.

<DrawArrow />

### Export arrow to SVG {#export-arrow-to-svg}

In SVG, you can adjust the orientation of `<marker>` using the [orient] attribute, but note that this attribute only has two literal values: `‘auto’` and `‘auto-start-reverse’`.

```ts
if (isEnd) {
    $marker.setAttribute('orient', 'auto');
} else {
    $marker.setAttribute('orient', 'auto-start-reverse');
}
```

Then create a `<path>` based on the marker type, allowing it to inherit properties such as `stroke` from the target graphic. You can find the whole SVG in [export arrow] test case:

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

In contrast, exported SVG files must also support re-importing into the canvas.

## [WIP] Draw polygon {#draw-polygon}

[Shape tools - polygons]

## Pencil tool {#pencil-tool}

Let's start by looking at the simplest implementation, using a folded line display, called a Pencil in Figma.

In order to minimize the number of vertices generated by dragging and dropping, and especially the number of duplicated vertices or vertices in close proximity to each other, we will simplify the polyline using the method described in [Lesson 12 - Simplify polyline], by choosing the [simplify-js] implementation. It is worth noting the definition of the `tolerance` parameter, which affects the degree of simplification:

> Affects the amount of simplification (in the same metric as the point coordinates).

We want to set the `tolerance` differently depending on the current camera zoom level, otherwise the jitter caused by oversimplification at high zoom levels will be easily visible:

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

Since the line width is fixed, it lacks a sense of “flexibility.” To create a hand-drawn feel, lines can be made to vary with pressure. For this purpose, we can use [perfect-freehand]. It's worth noting that this feature is not yet integrated into Excalidraw; see: [Perfect Freehand Drawing Issue].
Because the line width is variable, the final drawn shape is no longer a Polyline but a Path:

```ts
import { getStroke } from 'perfect-freehand';

const outlinePoints = getStroke(points);
const d = getSvgPathFromStroke(outlinePoints); // 'M 0 0 L...'
```

<PencilFreehand />

By default, [perfect-freehand] simulates the speed of brushstrokes by calculating variable line widths based on the distance between adjacent points. To use real [pressure], such as that from a pen or stylus, provide the pressure as the third number for each input point:

```ts
export class Input {
    @field.float32 declare pressure: number; // [!code ++]
}
```

And set the simulatePressure option to false.

```ts
const outlinePoints = getStroke(inputPoints, {
    simulatePressure: false,
});
```

## Brush mode {#brush-mode}

You can select this sub-tool when you enter Paint mode in Photoshop Web and draw strokes by dragging and dropping continuously:

![Brush mode in Photoshop Web](/photoshopweb-brush-mode.png)

In Figma it is called [Draw with illustration tools].

If we look closely at this type of stroke, we can see that it consists of a set of consecutive dots, which, if they have different radii, can give the effect of variable thickness. This can be realized by mapping the pressure of the brush to the radius:

![source: https://shenciao.github.io/brush-rendering-tutorial/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/brushes-9e58d24a7f40847be1ad6c1cb9f1b9dc.jpg)

Here we refer to [Brush Rendering Tutorial] to realize this effect.

### Basic implementation {#basic-implementation}

The underlying data structure is as follows:

```ts
interface BrushPoint {
    x: number;
    y: number;
    radius: number;
}
```

The $N$ vertices of a polyline form $N-1$ segments, each consisting of two triangles and four vertices. In [Lesson 12 - Extrude segment], we introduced the use of 9 vertices. Here we use the exact same method, but we don't need to take into account the joints of the segments, so we only need to use 4 vertices and draw them using instanced:

```ts
renderPass.drawIndexed(6, points.length - 1); // indices: [0, 1, 2, 0, 2, 3]
```

As we saw in [Lesson 12 - Extrude segment], you can pass `a_VertexNum` into the Vertex Shader, or you can use `gl_VertexID` directly as in [Brush Rendering Tutorial] if you don't want to take into account WebGL 1 compatibility:

```glsl
layout(location = ${Location.POINTA}) in vec3 a_PointA;
layout(location = ${Location.POINTB}) in vec3 a_PointB;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum; // [0, 1, 2, 3]
```

By the way the other `attributes`, `a_PointA` and `a_PointB` store variable radii in addition to vertex position coordinates. Again we use `vertexBufferOffsets` to multiplex the same Buffer, and `a_PointB` reads from an offset of `4 * 3`. This way we have the vertex numbers to stretch in the Vertex Shader:

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

In order to support variable widths, the stretched distance is not always equal to the radius of the current point, but needs to be calculated based on the slope of the line segment:

![source: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/var-parameters-9d4c6d7aa31d0f61fd39ba9f69eaae6d.png)

The effect is as follows:

<Brush />

### Stamp {#stamp}

This doesn't quite work like a real brushstroke.

![source: https://shenciao.github.io/brush-rendering-tutorial/Basics/Stamp/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/stamp-to-stroke-082a5ddd80c45086b810ed8b9ebcea79.gif)

### Export SVG {#export-brush-to-svg}

Figma is able to export Brush to SVG.

## Laser pointer {#laser-pointer}

When implementing presentation features on the canvas, a laser pointer is an essential function. Excalidraw supports this capability, as detailed in: [laser pointer]. We can directly utilize its encapsulated [@excalidraw/laser-pointer] module, which generates a trajectory path based on a set of input point coordinates. This functionality also leverages [perfect-freehand] at its core.

This feature differs from previously drawn shapes on the canvas in the following ways:

1. Laser pointer trajectory rendering occurs within the viewport coordinate system, independent of the current canvas zoom level. This allows implementation within a standalone HTML container. See: [Lesson 29 - HTML container]
2. Traces automatically fade after a set duration
3. Designed for multi-user collaboration scenarios. See: [Lesson 20 - Awareness and Presence]

<LaserPointer />

## Eraser {#eraser}

Excalidraw supports the [freedraw eraser]. After selecting the eraser tool, shapes traced by the mouse cursor will appear “faded,” indicating they are about to be erased. Lifting the mouse completes the erasure.

In the implementation, we use the Perfect freehand technique introduced in the previous section to draw the drag path, but only store the most recent 4 points. Simultaneously, we detect the shapes passed over in real time, setting their opacity (but remember to save the original opacity for restoration upon cancellation), and remove the selected shapes when the mouse is lifted:

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

### [WIP] Non-atomic {#non-atomic}

Erasing entire shapes is sufficient for most scenarios, but non-atomic erasing proves more practical in freehand drawing contexts—such as breaking a straight line midway. Excalidraw currently lacks this feature; see: [non-atomic erasing for linear & freedraw shapes]. FigJam shares this limitation. If the canvas is rendered using Canvas or SVG, achieving this pixel-level erasure effect is indeed impossible.

Since our canvas is implemented using WebGL/WebGPU, the most suitable technique is the stencil buffer. First, draw the eraser's path onto the stencil buffer, then use it as a mask to redraw the scene. Taking OpenGL as an example (WebGL is entirely analogous):

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

## Extended reading {#extended-reading}

-   [Draw with illustration tools]
-   [Brush Rendering Tutorial]
-   [p5.brush]
-   [Real-Time Paint System with WebGL]
-   [简简单单实现画笔工具，轻松绘制丝滑曲线]

[Lesson 14 - Canvas mode and auxiliary UI]: /guide/lesson-014
[Lesson 18 - Refactor with ECS]: /guide/lesson-018
[Draw with illustration tools]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
[Real-Time Paint System with WebGL]: https://chrisarasin.com/paint-system-webgl
[简简单单实现画笔工具，轻松绘制丝滑曲线]: https://zhuanlan.zhihu.com/p/701668081
[Lesson 12 - Simplify polyline]: /guide/lesson-012#simplify-polyline
[simplify-js]: https://github.com/mourner/simplify-js
[Brush Rendering Tutorial]: https://shenciao.github.io/brush-rendering-tutorial/
[Lesson 12 - Extrude segment]: /zh/guide/lesson-012#extrude-segment
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
[Lesson 29 - HTML container]: /guide/lesson-029#create-html-container
[Lesson 20 - Awareness and Presence]: /guide/lesson-020#awareness-presence
