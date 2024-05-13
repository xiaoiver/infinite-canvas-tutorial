---
outline: deep
---

# Lesson 8 - Optimize performance

In this lesson you will learn the following:

-   What is a draw call
-   Reducing draw calls with culling
-   Reducing draw calls by combining batches
-   Using spatial indexing to improve pickup efficiency

Performance optimization is a complex and long-term task that I tend to focus on early in a project. Earlier we learned how to draw circles using SDF, now let's do a performance test and draw 1000 circles with an FPS of about 35:

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson7');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson7;

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

        for (let i = 0; i < 100; i++) {
            const circle = new Circle({
                cx: Math.random() * 400,
                cy: Math.random() * 200,
                r: Math.random() * 20,
                fill: 'red',
            });
            canvas.appendChild(circle);
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

We're using [stats.js] to measure FPS, creating panels that are placed in the upper left corner of the canvas, which obviously isn't smooth at the moment:

```ts
const stats = new Stats();
stats.showPanel(0); // Only show FPS panel

const animate = () => {
    // Trigger updating
    if (stats) {
        stats.update();
    }
    canvas.render();
    requestAnimationFrame(animate);
};
```

Using [Spector.js], which was introduced in the first lesson, you can see that there are a large number of drawing commands. I've filtered down to the `drawElements` command, and in fact each circle corresponds to a number of WebGL commands (including the creation of buffers, etc.).

![draw calls in spector.js](/draw-calls.png)

## What is a draw call {#draw-call}

These draw commands are called Draw calls, and the following graphic from [Draw calls in a nutshell] explains why an increase in the number of Draw calls affects performance. This is because all draw calls are initiated from the CPU, and as the number of draw calls increases, the CPU takes longer to prepare for them, and the GPU, while rendering faster, still has to wait and has a lot of idle time, so the bottleneck is on the CPU.

![CPU GPU draw calls](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*EEqn28cbO11QXkyqcoaO7g.jpeg)

那么如何减少 Draw call 呢？通常有两种思路：

-   Viewport culling.
-   Draw call batching.

## Viewport culling {#culling}

Graphics outside the viewport do not need to be rendered. The image below from Unreal [How Culling Works] shows the culled red objects outside the camera's view cone from a God's perspective, and you can see that this greatly reduces the number of unnecessary draw calls.

![viewfrustum culled](https://d1iv7db44yhgxn.cloudfront.net/documentation/images/6f2a0e24-c0e0-4fc0-b637-29c792739474/sceneview_viewfrustumculled.png)

In 3D scenes there are many optimizations based on the camera view cone culling algorithm, as described in [Efficient View Frustum Culling], e.g., scene graph information can be used so that if a graph is already completely inside the view cone, its child nodes do not need to be detected.

Rendering engines are provided with corresponding features, for example:

-   Cesium [Fast Hierarchical Culling]
-   Babylon.js [Changing Mesh Culling Strategy]
-   [pixi-cull]

Compared to a 3D scene, our 2D canvas is much simpler to implement. So how do you determine if a shape is in the viewport? This is where the concept of a bounding box comes in. Of course, you don't have to use a bounding box, you can use a bounding sphere instead in a 3D scene.

### Axis-Aligned Bounding Box {#aabb}

An Axis-Aligned Bounding Box, or AABB for short, is a simple bounding box commonly used in 3D graphics that is parallel to the axes of the world coordinate system. In other words, its sides are oriented in the same direction as the coordinate axes. An axis-aligned bounding box is usually rectangular, and its purpose is to represent the area in space occupied by an object or group of objects as a simplified box. In our 2D scene it is a rectangle, and we only need to store its top-left `minX/Y` and bottom-right `maxX/Y` coordinates:

```ts
export class AABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    matrix: Matrix;

    isEmpty() {
        return this.minX > this.maxX || this.minY > this.maxY;
    }
}
```

Next add a way to get the enclosing box for the graph. Take a circle as an example and take the center, radius and line width into account. Also here [Dirty flag] is used so that recalculation is done only when the relevant attributes are changed:

```ts
export class Circle extends Shape {
    getRenderBounds() {
        if (this.renderBoundsDirtyFlag) {
            const halfLineWidth = this.#strokeWidth / 2;
            this.renderBoundsDirtyFlag = false;
            this.renderBounds = new AABB(
                this.#cx - this.#r - halfLineWidth,
                this.#cy - this.#r - halfLineWidth,
                this.#cx + this.#r + halfLineWidth,
                this.#cy + this.#r + halfLineWidth,
            );
        }
        return this.renderBounds;
    }
}
```

### Add a culling plugin {#culling-plugin}

Add a culling plugin that saves the viewport's corresponding enclosing box, and subsequently intersects with each graph's enclosing box. Considering the camera transformation, we get the coordinates of the four vertices of the viewport in the world coordinate system and frame them with a bounding box. The bounding box is updated every time the camera changes.

```ts
export class Culling implements Plugin {
    #viewport: AABB = new AABB();

    private updateViewport() {
        const {
            camera,
            api: { viewport2Canvas },
        } = this.#context;
        const { width, height } = camera;

        // tl, tr, br, bl
        const tl = viewport2Canvas({
            x: 0,
            y: 0,
        });

        this.#viewport.minX = Math.min(tl.x, tr.x, br.x, bl.x);
        this.#viewport.minY = Math.min(tl.y, tr.y, br.y, bl.y);
        this.#viewport.maxX = Math.max(tl.x, tr.x, br.x, bl.x);
        this.#viewport.maxY = Math.max(tl.y, tr.y, br.y, bl.y);
    }
}
```

Iterate through the scene graph at the start of each frame to determine if the graphics enclosing box intersects the viewport, and if it doesn't set `culled` to `true` so that it can be skipped during rendering:

```ts
hooks.beginFrame.tap(() => {
    const { minX, minY, maxX, maxY } = this.#viewport;

    traverse(root, (shape) => {
        if (shape.renderable && shape.cullable) {
            const bounds = shape.getBounds();
            shape.culled =
                bounds.minX >= maxX ||
                bounds.minY >= maxY ||
                bounds.maxX <= minX ||
                bounds.maxY <= minY;
        }

        return shape.culled;
    });
});
```

To see the effect, the number of rejected graphics changes as you zoom in and out, and the more graphics that are rejected, the higher the FPS:

```js eval code=false
$total = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$culled = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 500; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: false,
                // cullable: false,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
        const total = circles.length;
        const culled = circles.filter((circle) => circle.culled).length;

        $total.innerHTML = `total: ${total}`;
        $culled.innerHTML = `culled: ${culled}`;
    });
});
```

When the viewport contains all the shapes, there is no way to eliminate any of the shapes, so we have to use other means to reduce the draw calls.

## Batch rendering {#batch-rendering}

Draw calls that can be merged require certain conditions to be met, such as having similar Geometry, same Shader, etc. [Draw call batching - Unity] provides two ways to do this:

-   [Static batching] For stationary objects, transform them to the world coordinate system, using a shared vertex array. Once done, transformations cannot be applied to individual objects.
-   [Dynamic batching] For moving objects. Transforms vertices to the world coordinate system on the CPU side, but the transformation itself has overhead.

Pixi.js also has a built-in batch rendering system, which has been used until the V8 version currently in development: [Inside PixiJS: Batch Rendering System].

First we separate the rendering logic from the graphics, which makes sense; the graphics shouldn't care about how they are rendered:

```ts
class Circle {
    render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer) {} // [!code --]
}
```

Previously, when traversing the scene graph, we would immediately trigger the rendering logic for the graphs, but now the graphs are added to the pending render queue and wait to be merged and output together:

```ts
hooks.render.tap((shape) => {
    shape.render(); // [!code --]
    if (shape.renderable) {
        this.#batchManager.add(shape); // [!code ++]
    }
});
```

Then we abstract the Drawcall class and let the previously implemented SDF inherit it. It contains the following life cycle:

```ts
export abstract class Drawcall {
    abstract createGeometry(): void;
    abstract createMaterial(uniformBuffer: Buffer): void;
    abstract render(renderPass: RenderPass): void;
    abstract destroy(): void;
}

export class SDF extends Drawcall {}
```

### Instanced

For large numbers of similar shapes, [WebGL2 Optimization - Instanced Drawing] can significantly reduce the number of draw calls. This is called [InstancedMesh] in Three.js. Babylon.js also provides [Instances], where per-instance-specific attributes such as transformation matrices, colors, etc. can be passed in as vertex arrays:

![instances node](https://doc.babylonjs.com/img/how_to/instances-node.png)

```glsl
#ifdef INSTANCES
  attribute vec4 world0;
  attribute vec4 world1;
  attribute vec4 world2;
  attribute vec4 world3;

  finalWorld = mat4(world0, world1, world2, world3);
#endif
```

Since we only consider 2D scenes, the transformation matrix only needs to store 6 components:

```glsl
#ifdef USE_INSTANCES
  layout(location = 14) in vec4 a_Abcd;
  layout(location = 15) in vec2 a_Txty;

  model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
#endif
```

It is worth mentioning that the transformation matrices of individual instances can be stored in the data texture in addition to being stored directly in the vertex data, referenced by indexes in the vertex array:
[Drawing Many different models in a single draw call]

We add a flag `instanced` for Drawcall:

```ts
export abstract class Drawcall {
    constructor(protected device: Device, protected instanced: boolean) {}
}
```

Adds a `define` precompile directive to the shader header based on this flag:

```ts{5}
export class SDF extends Drawcall {
  createMaterial(uniformBuffer: Buffer): void {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }
  }
}
```

This way the model transformation matrix can be computed from the attribute or uniform:

```glsl
void main() {
  mat3 model;
  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
  #else
    model = u_ModelMatrix;
  #endif
}
```

At this point you can use [Spector.js] to see that even if there are 1000 circles in the viewport, it can be done with a single draw call:

![instanced draw calls in spector.js](/instanced-spector.png)

We can also limit the maximum number of instances in a Drawcall by checking it before each creation and recreating it if it is exceeded:

```ts
export abstract class Drawcall {
    protected maxInstances = Infinity;
    validate() {
        return this.count() <= this.maxInstances - 1;
    }
}
```

### Rendering order {#rendering-order}

Since we're drawing multiple shapes with a single draw call, we need to pay attention to the drawing order. The position of each element in the instances array does not necessarily equate to the final draw order, so we need to assign a value to each figure before we actually draw it, and then normalize that value to `[0, 1]` and pass it into the shader as the depth value:

```ts{4}
export class Renderer implements Plugin {
  apply(context: PluginContext) {
    hooks.render.tap((shape) => {
      shape.globalRenderOrder = this.#zIndexCounter++;
    });

    hooks.beginFrame.tap(() => {
      this.#zIndexCounter = 0;
    });
  }
}
```

Then we turn on [Depth testing], and the test method is changed to: Depth values greater than the current Depth buffer storage value (in the range `[0, 1]`) will be written (WebGL defaults to `gl.LESS`). In our scenario the graphics with the larger ZIndex will overwrite the smaller ones.

```ts
export class SDF extends Drawcall {
    createMaterial(uniformBuffer: Buffer): void {
        this.#pipeline = this.device.createRenderPipeline({
            megaStateDescriptor: {
                depthWrite: true, // [!code ++]
                depthCompare: CompareFunction.GREATER, // [!code ++]
            },
        });
    }
}
```

Finally an additional Depth RenderTarget is created when the RenderPass is created:

```ts
this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [this.#renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
    depthStencilAttachment: this.#depthRenderTarget, // [!code ++]
    depthClearValue: 1, // [!code ++]
});
```

See how it works, drawing 5000 circles with culling and batch optimization turned on at the same time:

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 5000; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: true,
                cullable: true,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Optimizing picking performance {#optimizing-picking-perf}

Next, we'll measure the pickup performance by adding a pointerenter/leave event listener to each Circle:

```ts
circle.addEventListener('pointerenter', () => {
    circle.fill = 'red';
});
circle.addEventListener('pointerleave', () => {
    circle.fill = fill;
});
```

20000 Circle pickups took the following time:

![pick perf](/pick-perf.png)

AABB for graphs can be used for viewport-based culling, which allows for quicker approximation judgments compared to mathematical methods.

### Using spatial indexing {#using-spatial-indexing}

A Spatial Index is a data structure used for efficient handling of spatial data and query operations, especially in Geographic Information Systems (GIS), computer graphics, 3D game development and database technology. The main purpose of spatial indexing is to reduce the amount of computation and time required to search for specific spatial objects in large amounts of data. There are various data structures for spatial indexing, such as Quadtree, Octree, R-tree, K-d tree, etc. Each structure has its specific application scenarios and advantages.

In the PIXI.js ecosystem there are libraries like [pixi-spatial-hash] that create new spatial indexes in each frame. However, there seems to be a lack of maintenance at the moment.

We use [rbush], which supports batch insertion, which is usually 2-3 times faster than inserting frame-by-frame, and is also used in mapbox.

```ts
import RBush from 'rbush';
const rBushRoot = new RBush<RBushNodeAABB>();

export interface RBushNodeAABB {
    shape: Shape;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
```

### RBush search {#rbush-search}

RBush provides a region query function [search], which is passed a query box to return a list of hit graphs:

```ts
export class Canvas {
    elementsFromBBox(
        minX: number,
        minY: number,
        maxX: number,
        maxY: number,
    ): Shape[] {
        const { rBushRoot } = this.#pluginContext;
        const rBushNodes = rBushRoot.search({ minX, minY, maxX, maxY });

        const hitTestList: Shape[] = [];
        rBushNodes.forEach(({ shape }) => {
            // Omit the process of handling the visibility and pointerEvents properties of shape.
        });
        // Sort by global render order.
        hitTestList.sort((a, b) => a.globalRenderOrder - b.globalRenderOrder);

        return hitTestList;
    }
}
```

In [picking plugin] we use the above region lookup method, but of course a point is passed in instead of an AABB:

```ts{9}
export class Picker implements Plugin {
  apply(context: PluginContext) {
    hooks.pickSync.tap((result: PickingResult) => {
      const {
        position: { x, y },
      } = result;

      const picked: Shape[] = [root];
      elementsFromBBox(x, y, x, y).forEach((shape) => {
        if (this.hitTest(shape, x, y)) {
          picked.unshift(shape);
        }
      });
      result.picked = picked;
      return result;
    });
  }
}
```

Let's re-measure that, 20,000 Circle picking time becomes 0.088ms, an improvement of about 20 times!

![pick perf with rbush](/pick-rbush-perf.png)

## Extended reading {#extended-reading}

-   [Inside PixiJS: Batch Rendering System]
-   [Depth testing]
-   [The Depth Texture | WebGPU]
-   Three.js [BatchedMesh: Proposal]

[stats.js]: https://github.com/mrdoob/stats.js
[Spector.js]: https://spector.babylonjs.com/
[Draw calls in a nutshell]: https://toncijukic.medium.com/draw-calls-in-a-nutshell-597330a85381
[Draw call batching - Unity]: https://docs.unity3d.com/Manual/DrawCallBatching.html
[Static batching]: https://docs.unity3d.com/Manual/static-batching.html
[Dynamic batching]: https://docs.unity3d.com/Manual/dynamic-batching.html
[pixi-cull]: https://github.com/davidfig/pixi-cull
[pixi-spatial-hash]: https://github.com/ShukantPal/pixi-spatial-hash
[rbush]: https://github.com/mourner/rbush
[How Culling Works]: https://dev.epicgames.com/documentation/en-us/unreal-engine/visibility-and-occlusion-culling-in-unreal-engine#howcullingworks
[Efficient View Frustum Culling]: https://old.cescg.org/CESCG-2002/DSykoraJJelinek/
[Fast Hierarchical Culling]: https://cesium.com/blog/2015/08/04/fast-hierarchical-culling/
[Changing Mesh Culling Strategy]: https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#changing-mesh-culling-strategy
[Inside PixiJS: Batch Rendering System]: https://medium.com/swlh/inside-pixijs-batch-rendering-system-fad1b466c420
[BatchedMesh: Proposal]: https://github.com/mrdoob/three.js/issues/22376
[InstancedMesh]: https://threejs.org/docs/?q=instanced#api/en/objects/InstancedMesh
[WebGL2 Optimization - Instanced Drawing]: https://webgl2fundamentals.org/webgl/lessons/webgl-instanced-drawing.html
[Drawing Many different models in a single draw call]: https://webglfundamentals.org/webgl/lessons/webgl-qna-drawing-many-different-models-in-a-single-draw-call.html
[Instances]: https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
[Dirty flag]: /guide/lesson-002#dirty-flag
[Depth testing]: https://learnopengl.com/Advanced-OpenGL/Depth-testing
[The Depth Texture | WebGPU]: https://carmencincotti.com/2022-06-13/webgpu-the-depth-texture/
[picking plugin]: /guide/lesson-006#picking-plugin
[search]: https://github.com/mourner/rbush?tab=readme-ov-file#search
