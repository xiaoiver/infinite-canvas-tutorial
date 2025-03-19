# @infinite-canvas-tutorial/core

This repository contains the core module code for the Infinite Canvas Tutorial project.

It needs to be used in conjunction with `@infinite-canvas-tutorial/ui`.

Since lesson 17, I've used ECS to refactor. So its code won't be updated since then, you can refer to `@infinite-canvas-tutorial/ecs` for latest code.

## Getting Started

```ts
import { Canvas, CanvasMode, Rect } from '@infinite-canvas-tutorial/core';

const canvas = await new Canvas({
    canvas: $canvas,
    mode: CanvasMode.SELECT,
    // renderer: 'webgpu',
    // shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
}).initialized;

const rect = new Rect({
    x: 300,
    y: 100,
    width: 100,
    height: 100,
    fill: '#F67676',
});
canvas.appendChild(rect);

canvas.render();
```
