---
outline: deep
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

Adds a shape to the end of the list of children.

```ts
canvas.appendChild(circle);
```

## removeChild

Removes a child shape from canvas and returns the removed shape.

```ts
canvas.removeChild(circle);
```

## elementsFromPoint

## elementFromPoint

## client2Viewport

## viewport2Client

## zoomIn

## zoomOut

## checkboardStyle

```ts
canvas.checkboardStyle = CheckboardStyle.DOTS;
```
