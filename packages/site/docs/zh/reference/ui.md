---
outline: deep
publish: false
---

我们的画布包含使用 Web Components 实现的 UI 组件。

```ts
import '@infinite-canvas-tutorial/ui';
```

然后在 HTML 中使用这些组件：

```html
<ic-canvas renderer="webgpu"></ic-canvas>
```

`<ic-canvas>` 组件支持以下属性，属性值都为字符串。

## renderer

支持 `webgpu` 和 `webgl` 两种渲染器，默认使用 `webgl`。

```html
<ic-canvas renderer="webgpu"></ic-canvas>
```

## shaderCompilerPath

指定 WebGPU 的着色器编译器路径，将 GLSL 编译为 WGSL。默认值为 `https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm`

## shoelaceBasePath

我们的 UI 组件使用 Shoelace 组件库，用来指定 Shoelace 的 CDN 路径。默认值为 `https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn`

## zoom

画布的缩放比例，默认值为 `100`。

## mode

画布的交互模式，默认值为 `CanvasMode.HAND`。

## modes

画布的交互模式，默认值为 `[CanvasMode.HAND, CanvasMode.SELECT, CanvasMode.DRAW_RECT]`。
