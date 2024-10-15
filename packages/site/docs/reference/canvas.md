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

```ts
const animate = () => {
    canvas.render();
    requestAnimationFrame(animate);
};
animate();
```

## resize

```ts
canvas.resize(100, 200);
```

## destroy

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
