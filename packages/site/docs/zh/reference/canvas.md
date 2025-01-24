---
outline: deep
publish: false
---

## constructor

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement;
    renderer?: 'webgl' | 'webgpu';
    shaderCompilerPath?: string;
    devicePixelRatio?: number;
    backgroundColor?: string;
    gridColor?: string;
}
```

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
