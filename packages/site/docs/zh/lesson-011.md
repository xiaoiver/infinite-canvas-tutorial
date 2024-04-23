---
outline: deep
---

# 课程 6 - 性能测试

在这节课中你将学习到以下内容：

- 什么是 Draw call
- 使用 GPU Instancing 提升绘制性能

性能优化是一个复杂而长期的任务，我倾向于在项目早期就开始关注。在上一课中我们使用 SDF 绘制了一个圆，现在让我们来做一下性能测试，绘制 1000 个圆 FPS 约为 35：

```js eval code=false
call(async () => {
  const { Canvas, Circle } = Lesson3;

  const stats = new Stats();
  stats.showPanel(0);
  const $stats = stats.dom;
  $stats.style.position = 'absolute';
  $stats.style.left = '0px';
  $stats.style.top = '0px';

  const [$canvas, canvas] = await Utils.createCanvas(Canvas, 200, 200);
  setTimeout(() => {
    $canvas.parentElement.style.position = 'relative';
    $canvas.parentElement.appendChild($stats);
  });

  for (let i = 0; i < 1000; i++) {
    const circle = new Circle({
      cx: Math.random() * 400,
      cy: Math.random() * 400,
      r: Math.random() * 20,
      fill: 'red',
    });
    canvas.appendChild(circle);
  }

  const animate = () => {
    if (stats) {
      stats.update();
    }
    canvas.render();
    requestAnimationFrame(animate);
  };
  animate();
  return $canvas;
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

![draw calls](/draw-calls.png)

## 什么是 Draw call

这些绘制命令称作 Draw call。下面这张图来自 [Draw calls in a nutshell]，解释了为何 Draw call 数量增多时会影响性能。这是由于 Draw call 都是从 CPU 发起调用的，当数量增多时 CPU 准备时间也更长，GPU 虽然渲染快但仍然需要等待，存在大量空闲时间，因此瓶颈在 CPU 上。

![CPU GPU draw calls](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*EEqn28cbO11QXkyqcoaO7g.jpeg)

那么如何减少 Draw call 呢？通常有两种思路：

- Culling 剔除掉视口外的图形，我们放到之后的教程中介绍，感兴趣的话可以参考 [pixi-cull]。
- Draw call batching。将多个 Draw call 进行合并，本文将着重介绍这种方式。

## Draw call batching

可以合并的 Draw call 是需要满足一定条件的。[Draw call batching - Unity] 提供了两种方式：

- [Static batching]
- [Dynamic batching]

## 优化加速

首先想到为图形增加包围盒，相比数学方法可以进行更快速的近似判断。后续在基于视口的剔除时还会使用到。

### 包围盒

轴对齐包围盒（Axis-Aligned Bounding Box，简称 AABB）是一种在三维图形学中常用的简单包围盒，它与世界坐标系的轴平行。换句话说，它的边与坐标轴的方向一致。轴对齐包围盒通常是矩形或长方体，其用途是将一个物体或一组物体在空间中占据的区域用一个简化的盒子来表示。

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

接下来为图形增加获取包围盒的方法。

### 使用空间索引加速

空间索引（Spatial Index）是一种数据结构，用于高效地处理空间数据和查询操作，特别是在地理信息系统（GIS）、计算机图形学、三维游戏开发和数据库技术中。空间索引的主要目的是减少在大量数据中搜索特定空间对象所需的计算量和时间。空间索引有多种数据结构，如四叉树（Quadtree）、八叉树（Octree）、R 树（R-tree）、K-d 树（K-dimensional tree）等，每种结构都有其特定的应用场景和优势。

在 PIXI.js 的生态中有 [pixi-spatial-hash] 这样的库，在每一帧中创建新的空间索引。但目前似乎缺少维护。

我们使用 [rbush]，它支持批量插入，通常比逐个插入要快 2-3 倍，在 mapbox 中也有应用。

[stats.js]: https://github.com/mrdoob/stats.js
[Spector.js]: https://spector.babylonjs.com/
[Draw calls in a nutshell]: https://toncijukic.medium.com/draw-calls-in-a-nutshell-597330a85381
[Draw call batching - Unity]: https://docs.unity3d.com/Manual/DrawCallBatching.html
[Static batching]: https://docs.unity3d.com/Manual/static-batching.html
[Dynamic batching]: https://docs.unity3d.com/Manual/dynamic-batching.html
[pixi-cull]: https://github.com/davidfig/pixi-cull
[pixi-spatial-hash]: https://github.com/ShukantPal/pixi-spatial-hash
[rbush]: https://github.com/mourner/rbush
