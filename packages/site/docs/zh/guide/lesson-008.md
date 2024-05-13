---
outline: deep
---

# 课程 8 - 性能优化

在这节课中你将学习到以下内容：

-   什么是 Draw call
-   使用剔除减少 draw call
-   使用合批减少 draw call
-   使用空间索引提升拾取效率

性能优化是一个复杂而长期的任务，我倾向于在项目早期就开始关注。之前我们学习了如何使用 SDF 绘制圆，现在让我们来做一下性能测试，绘制 1000 个圆 FPS 约为 35：

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

我们使用 [stats.js] 度量 FPS，创建的面板放在画布左上角，显然目前并不流畅：

```ts
const stats = new Stats();
stats.showPanel(0); // 仅展示 FPS 面板

const animate = () => {
    // 触发更新
    if (stats) {
        stats.update();
    }
    canvas.render();
    requestAnimationFrame(animate);
};
```

使用第一节课介绍过的 [Spector.js] 可以看到有大量的绘制命令，我只筛选保留了 `drawElements` 命令，事实上每一个圆都对应着好几条 WebGL 命令（包含创建 Buffer 等等）。

![draw calls in spector.js](/draw-calls.png)

## 什么是 Draw call {#draw-call}

这些绘制命令称作 Draw call。下面这张图来自 [Draw calls in a nutshell]，解释了为何 Draw call 数量增多时会影响性能。这是由于 Draw call 都是从 CPU 发起调用的，当数量增多时 CPU 准备时间也更长，GPU 虽然渲染快但仍然需要等待，存在大量空闲时间，因此瓶颈在 CPU 上。

![CPU GPU draw calls](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*EEqn28cbO11QXkyqcoaO7g.jpeg)

那么如何减少 Draw call 呢？通常有两种思路：

-   Culling 剔除掉视口外的图形
-   Draw call batching。将多个 Draw call 进行合并

## 剔除 {#culling}

视口之外的图形是不需要渲染的，下图来自 Unreal [How Culling Works]，从上帝视角展示了相机视锥之外被剔除的红色对象，可以看出这将大大减少不必要的 draw call。

![viewfrustum culled](https://d1iv7db44yhgxn.cloudfront.net/documentation/images/6f2a0e24-c0e0-4fc0-b637-29c792739474/sceneview_viewfrustumculled.png)

在 3D 场景中有很多基于相机视锥剔除算法的优化手段，[Efficient View Frustum Culling] 中就介绍了多种方法，例如可以利用场景图信息，如果一个图形已经完全处于视锥体内部，其子节点也就不需要检测了。

渲染引擎都会提供相应的功能，例如：

-   Cesium [Fast Hierarchical Culling]
-   Babylon.js [Changing Mesh Culling Strategy]
-   [pixi-cull]

相比 3D 场景，我们的 2D 画布实现起来会简单很多。那么如何判断一个图形是否在视口内呢？这就需要引入包围盒的概念。当然不一定非要使用包围盒，3D 场景中也可以用包围球代替。

### 包围盒 {#aabb}

轴对齐包围盒（Axis-Aligned Bounding Box，简称 AABB）是一种在三维图形学中常用的简单包围盒，它与世界坐标系的轴平行。换句话说，它的边与坐标轴的方向一致。轴对齐包围盒通常是长方体，其用途是将一个物体或一组物体在空间中占据的区域用一个简化的盒子来表示。在我们的 2D 场景中它是一个矩形，我们只需要存储它的左上角 `minX/Y` 和右下角 `maxX/Y` 坐标：

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

接下来为图形增加获取包围盒的方法。以圆为例，将圆心、半径和线宽都考虑进来。另外这里使用了[脏检查模式]，只有当相关属性发生变化时才会进行重新计算：

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

### 增加剔除插件 {#culling-plugin}

增加一个剔除插件，保存视口对应的包围盒，后续和每个图形的包围盒进行求交。考虑到相机变换，我们获取视口四个顶点在世界坐标系下的坐标，用一个包围盒框住它们。每次相机发生变化时更新这个包围盒。

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

在每一帧开始时遍历场景图，判断图形包围盒是否和视口相交，如果不相交设置 `culled` 为 `true`，这样在渲染时就可以跳过：

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

来看下效果，缩放时被剔除图形数量也会随之变化，被剔除的图形数目越多，FPS 就越高：

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

当视口包含所有图形时，任何图形都没法剔除，此时我们得使用其他手段减少 draw call。

## 合批渲染 {#batch-rendering}

可以合并的 Draw call 是需要满足一定条件的，例如拥有相似的 Geometry，相同的 Shader 等。[Draw call batching - Unity] 提供了两种方式：

-   [Static batching] 适用于静止不动的物体，将它们转换到世界坐标系下，使用共享的顶点数组。完成后就不能对单个物体应用变换了。
-   [Dynamic batching] 适用于运动的物体。在 CPU 侧将顶点转换到世界坐标系下，但转换本身也有开销。

Pixi.js 也内置了一个合批渲染系统，一直沿用到目前开发中的 V8 版本：[Inside PixiJS: Batch Rendering System]

首先我们将渲染逻辑从图形中分离出来，这也是合理的，图形不应该关心自身如何被渲染：

```ts
class Circle {
    render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer) {} // [!code --]
}
```

之前在遍历场景图时，我们会立刻触发图形的渲染逻辑，但现在将图形加入待渲染队列，等待合并后一起输出：

```ts
hooks.render.tap((shape) => {
    shape.render(); // [!code --]
    if (shape.renderable) {
        this.#batchManager.add(shape); // [!code ++]
    }
});
```

然后我们抽象出 Drawcall 这个抽象类，让之前实现的 SDF 继承它。包含以下生命周期：

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

对于大量同类图形，[WebGL2 Optimization - Instanced Drawing] 可以显著减少 draw call 的数量。在 Three.js 中称作 [InstancedMesh]。Babylon.js 中也提供了 [Instances]，每个实例特有的属性例如变换矩阵、颜色等可以通过顶点数组传入：

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

由于我们只考虑 2D 场景，变换矩阵只需要存储 6 个分量：

```glsl
#ifdef USE_INSTANCES
  layout(location = 14) in vec4 a_Abcd;
  layout(location = 15) in vec2 a_Txty;

  model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
#endif
```

值得一提的是，各个实例的变换矩阵除了直接存储在顶点数据中，也可以存储在数据纹理中，在顶点数组通过索引引用：
[Drawing Many different models in a single draw call]

我们为 Drawcall 增加一个标志位 `instanced`：

```ts
export abstract class Drawcall {
    constructor(protected device: Device, protected instanced: boolean) {}
}
```

依据这个标志位在 Shader 头部添加 `define` 预编译指令：

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

这样模型变换矩阵就可以从顶点数组或 Uniform 中计算得到：

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

此时使用 [Spector.js] 可以看到当视口中存在 1000 个圆时，也能用一条 draw call 完成：

![instanced draw calls in spector.js](/instanced-spector.png)

我们也可以限制一个 Drawcall 中实例的最大数目，在每次创建前进行检查，如果超出就重新创建：

```ts
export abstract class Drawcall {
    protected maxInstances = Infinity;
    validate() {
        return this.count() <= this.maxInstances - 1;
    }
}
```

### 绘制顺序 {#rendering-order}

既然我们使用一条 draw call 绘制多个图形，那就需要注意绘制顺序问题。每个元素在实例数组中的位置并不一定等同于最后的绘制顺序，因此需要在实际绘制前为每一个图形分配一个值，稍后将这个值归一化到 `[0, 1]` 后传入 Shader 中作为深度值：

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

然后开启深度测试 [Depth testing]，测试方法改为：深度值大于当前 Depth buffer 存储的值（范围为 `[0, 1]`）就会写入（WebGL 默认为 `gl.LESS`）。在我们的场景中 ZIndex 大的图形会覆盖小的。

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

最后在创建 RenderPass 时额外创建一个 Depth RenderTarget：

```ts
this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [this.#renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
    depthStencilAttachment: this.#depthRenderTarget, // [!code ++]
    depthClearValue: 1, // [!code ++]
});
```

看看效果，绘制 5000 个 Circle 同时开启剔除和合批优化：

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

## 优化拾取性能 {#optimizing-picking-perf}

接下来我们来度量下拾取性能，首先为每个 Circle 添加鼠标移入移出的事件监听器：

```ts
circle.addEventListener('pointerenter', () => {
    circle.fill = 'red';
});
circle.addEventListener('pointerleave', () => {
    circle.fill = fill;
});
```

20000 个 Circle 拾取耗时如下：

![pick perf](/pick-perf.png)

之前在基于视口的剔除时用到了图形的包围盒，相比数学方法可以进行更快速的近似判断。

### 使用空间索引加速 {#using-spatial-indexing}

空间索引（Spatial Index）是一种数据结构，用于高效地处理空间数据和查询操作，特别是在地理信息系统（GIS）、计算机图形学、三维游戏开发和数据库技术中。空间索引的主要目的是减少在大量数据中搜索特定空间对象所需的计算量和时间。空间索引有多种数据结构，如四叉树（Quadtree）、八叉树（Octree）、R 树（R-tree）、K-d 树（K-dimensional tree）等，每种结构都有其特定的应用场景和优势。

在 PIXI.js 的生态中有 [pixi-spatial-hash] 这样的库，在每一帧中创建新的空间索引。但目前似乎缺少维护。

我们使用 [rbush]，它支持批量插入，通常比逐个插入要快 2-3 倍，在 mapbox 中也有应用。

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

### 区域查询 {#rbush-search}

RBush 提供了区域查询功能 [search]，传入一个查询包围盒返回命中的图形列表：

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
            // 省略考虑 shape 的 visibility 和 pointerEvents 属性
        });
        // 按渲染次序排序
        hitTestList.sort((a, b) => a.globalRenderOrder - b.globalRenderOrder);

        return hitTestList;
    }
}
```

在[拾取插件]中我们使用上述区域查询方法，当然传入的是一个点而非包围盒：

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

让我们重新度量一下，20000 个 Circle 拾取时间变成了 0.088ms，提升了大约 20 倍！

![pick perf with rbush](/pick-rbush-perf.png)

## 扩展阅读 {#extended-reading}

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
[脏检查模式]: /zh/guide/lesson-002#dirty-flag
[Depth testing]: https://learnopengl.com/Advanced-OpenGL/Depth-testing
[The Depth Texture | WebGPU]: https://carmencincotti.com/2022-06-13/webgpu-the-depth-texture/
[拾取插件]: /zh/guide/lesson-006#picking-plugin
[search]: https://github.com/mourner/rbush?tab=readme-ov-file#search
