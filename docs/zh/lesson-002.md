# 课程 2

在这节课中你将学习到以下内容：

-   向画布中添加图形
-   使用 SDF 绘制一个圆形
-   相机

## 向画布中添加图形

上一课我们创建了一个空白画布，后续我们会向其中添加各种图形，如何设计这样的 API 呢？作为前端开发者，不妨借鉴熟悉的 [Node API appendChild]：

```ts
canvas.appendChild(shape);
canvas.removeChild(shape);
```

暂时创建一个图形基类，后续 Circle、Ellipse、Rect 等图形都会继承它：

```ts
export abstract class Shape {}
```

在画布中使用数组存储图形列表：

```ts
#shapes: Shape[] = [];

appendChild(shape: Shape) {
  this.#shapes.push(shape);
}

removeChild(shape: Shape) {
  const index = this.#shapes.indexOf(shape);
  if (index !== -1) {
    this.#shapes.splice(index, 1);
  }
}
```

在画布渲染方法中遍历图形列表，调用渲染钩子：

```ts{4}
render() {
  const { hooks } = this.#pluginContext;
  hooks.beginFrame.call();
  this.#shapes.forEach((shape) => {
    hooks.render.call(shape);
  });
  hooks.endFrame.call();
}
```

在渲染插件中每一帧开始前都会创建一个 `RenderPass`，硬件抽象层在这里进行了封装。WebGL 中并没有这个概念，WebGPU 中 [beginRenderPass] 会返回 [GPURenderPassEncoder]，通过它可以记录包括 `draw` 在内的一系列命令，后续在 `render` 钩子中我们会看到：

```ts{4}
hooks.beginFrame.tap(() => {
  this.#device.beginFrame();

  this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
  });
});
```

与创建对应，在每一帧结束后提交 `RenderPass`，同样在 WebGPU 中很容易找到对应的 [submit] 方法，当然原生 API 提交的是一个编码后的命令缓冲，硬件抽象层简化了这些概念。

```ts{2}
hooks.endFrame.tap(() => {
  this.#device.submitPass(this.#renderPass);
  this.#device.endFrame();
});
```

最后来到

```ts
hooks.render.tap((shape) => {
    this.#renderPass.setPipeline(pipeline);
    this.#renderPass.setVertexInput(
        inputLayout,
        [
            {
                buffer: vertexBuffer,
            },
        ],
        null,
    );
    this.#renderPass.draw(3);
});
```

## 绘制圆形 ⭕️

首先我们需要定义圆形的基础属性，熟悉 SVG [circle] 的开发者一定知道，基于圆心 `cx/cy` 和半径 `r` 可以定义圆的几何形状，配合填充色 `fill`、描边色 `stroke` 这些通用绘图属性就能满足基础需求了。

```ts
export class Circle extends Shape {
    constructor(
        config: Partial<{
            cx: number;
            cy: number;
            r: number;
            fill: string;
        }> = {},
    ) {}
}
```

这样我们就可以用如下方式向画布添加 `Circle` 了：

```ts
const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'red',
});
canvas.appendChild(circle);
```

不同于 Canvas 或者 SVG，字符串形式的颜色值是无法直接在 WebGL 或者 WebGPU 中使用的，好在 [d3-color] 可以帮助我们转换成 `{ r, g, b, opacity }` 格式。我们暂时只支持 RGB 空间的颜色值：

```ts
import * as d3 from 'd3-color';

set fill(fill: string) {
  this.#fill = fill;
  this.#fillRGB = d3.rgb(fill); // { r, g, b, opacity }
}
```

解决了样式问题，让我们回到几何部分。你可能听说过程序化生成几何，常用的就是三角形

[CircleGeometry]

[Node API appendChild]: https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
[GPURenderPassEncoder]: https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder
[beginRenderPass]: https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/beginRenderPass
[submit]: https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/submit
[circle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
[d3-color]: https://github.com/d3/d3-color
[CircleGeometry]: https://threejs.org/docs/#api/en/geometries/CircleGeometry
