---
outline: deep
publish: false
---

从 `@infinite-canvas-tutorial/core` 中导入 `Canvas` 类。

```ts
import { Canvas } from '@infinite-canvas-tutorial/core';
const canvas = new Canvas({});
```

## constructor

Canvas 的构造函数参数：

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    renderer?: 'webgl' | 'webgpu';
    shaderCompilerPath?: string;
    devicePixelRatio?: number;
    theme?: Theme;
    themeColors?: {
        [Theme.LIGHT]: {
            background: string;
            grid: string;
        };
        [Theme.DARK]: {
            background: string;
            grid: string;
        };
    };
    checkboardStyle?: CheckboardStyle;
    mode?: CanvasMode;
    plugins?: Partial<{
        selector: Partial<SelectorPluginOptions>;
        dragndrop: Partial<DragndropPluginOptions>;
    }>;
}
```

### canvas

在浏览器环境传入 `HTMLCanvasElement`，在 WebWorker 环境传入 `OffscreenCanvas`，在 Node.js 环境可以使用 `node-canvas`。

### renderer

指定渲染器，可选值为 `webgl` 和 `webgpu`，默认值为 `webgl`。

### shaderCompilerPath

指定 WebGPU 着色器编译器路径，默认值为 `https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm`。

### devicePixelRatio

指定设备像素比，默认值为 `window.devicePixelRatio`。

### theme

指定明暗主题，可选值为 `Theme.LIGHT` 和 `Theme.DARK`，默认值为 `Theme.LIGHT`。

### themeColors

指定主题颜色，默认值为

```js
{
    [Theme.LIGHT]: {
        background: '#fbfbfb',
        grid: '#dedede',
    },
    [Theme.DARK]: {
        background: '#121212',
        grid: '#242424',
    },
}
```

### checkboardStyle

指定网格样式，可选值为 `CheckboardStyle.NONE`、`CheckboardStyle.GRID` 和 `CheckboardStyle.DOTS`，默认值为 `CheckboardStyle.GRID`。

### mode

指定画布模式，可选值为 `CanvasMode.HAND` 和 `CanvasMode.SELECT`，默认值为 `CanvasMode.HAND`。

### plugins

内置插件的配置。

#### dragndrop

-   `overlap` 如何判定拖拽元素是否在目标元素上，取值包括：
    -   `pointer` – 拖拽元素的指针必须位于目标元素上 (默认)
    -   `center` – 拖拽元素的中心必须位于目标元素上
-   `dragstartTimeThreshold` 触发 `dragstart` 事件的阈值，单位为毫秒。
-   `dragstartDistanceThreshold` 触发 `dragstart` 事件的阈值，单位为像素。

#### selector

-   `selectionBrushSortMode` 框选元素的排序方式，取值包括：
    -   `directional` – 按照框选方向排序
    -   `behavior` – 按照框选行为排序
-   `selectionBrushStyle` 框选元素的样式，由于使用 [Path] 绘制，因此支持所有 [Path] 的样式，除了 [d]。

## render

手动创建一个动画循环不断调用 `render` 方法。

```ts
const animate = () => {
    canvas.render();
    requestAnimationFrame(animate);
};
animate();
```

## resize

重新设置画布的大小。

```ts
canvas.resize(100, 200);
```

## destroy

销毁画布。

```ts
canvas.destroy();
```

## appendChild

向画布中添加元素。类似 [Node.appendChild]

```ts
canvas.appendChild(circle);
```

## removeChild

从画布中移除一个元素。类似 [Node.removeChild]

```ts
canvas.removeChild(circle);
```

## elementsFromPoint

获取世界坐标系下，处于指定点的所有图形。方法签名如下，参考：[Document.elementsFromPoint]

```ts
elementsFromPoint(x: number, y: number): Shape[]
```

## elementFromPoint

获取世界坐标系下，处于指定点最上方的一个图形。方法签名如下，参考：[Document.elementFromPoint]

```ts
elementFromPoint(x: number, y: number): Shape
```

## client2Viewport

将客户端坐标系下的点转换为视口坐标系下的点。

```ts
client2Viewport({ x, y }: IPointData): IPointData
```

## viewport2Client

将视口坐标系下的点转换为客户端坐标系下的点。

```ts
viewport2Client({ x, y }: IPointData): IPointData
```

## zoomIn

通过相机放大画布。

```ts
canvas.zoomIn();
```

## zoomOut

通过相机缩小画布。

```ts
canvas.zoomOut();
```

## checkboardStyle

获取或者设置画布网格样式，默认值为 `CheckboardStyle.GRID`。

```ts
export enum CheckboardStyle {
    NONE,
    GRID,
    DOTS,
}

canvas.checkboardStyle = CheckboardStyle.DOTS;
```

## theme

获取或者设置画布主题，默认值为 `Theme.LIGHT`。

```ts
canvas.theme = Theme.DARK;
```

## getDOM

获取创建的 Canvas DOM 元素。在不同环境下，返回的 DOM 元素不同。

```ts
const canvas = new Canvas({
    canvas: document.createElement('canvas'),
});
const dom = canvas.getDOM(); // 返回 HTMLCanvasElement
```

## getDPR

获取画布的设备像素比。

```ts
const dpr = canvas.getDPR(); // 2
```

## getDevice

获取画布设备，随后使用它的 API 创建各种底层 GPU 对象，参考：[Device]。

```ts
const device = canvas.getDevice();
```

## toDataURL

返回画布导出图片的 DataURL，参考：[HTMLCanvasElement.toDataURL]。

```ts
const dataURL = await canvas.toDataURL();
```

参数为：

```ts
export interface DataURLOptions {
    /**
     * The default type is image/png.
     */
    type: DataURLType;
    /**
     * The image quality between 0 and 1 for image/jpeg and image/webp.
     */
    encoderOptions: number;
    /**
     * Whether to draw grid on the image.
     */
    grid: boolean;
}
```

[Node.appendChild]: https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
[Node.removeChild]: https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild
[HTMLCanvasElement.toDataURL]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[Document.elementsFromPoint]: https://developer.mozilla.org/zh-CN/docs/Web/API/Document/elementsFromPoint
[Document.elementFromPoint]: https://developer.mozilla.org/zh-CN/docs/Web/API/Document/elementFromPoint
[Path]: /zh/reference/path
[d]: /zh/reference/path#d
[Device]: https://github.com/antvis/g-device-api
