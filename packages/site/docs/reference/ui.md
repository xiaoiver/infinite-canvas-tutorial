---
outline: deep
publish: false
---

Our canvas includes UI components implemented using Web Components.

```ts
import '@infinite-canvas-tutorial/ui';
```

Use this component in HTML:

```html
<ic-canvas renderer="webgpu"></ic-canvas>
```

`<ic-canvas>` component supports the following properties, all of which are strings.

## renderer

Support `webgpu` and `webgl` renderers, default to `webgl`.

```html
<ic-canvas renderer="webgpu"></ic-canvas>
```

## shaderCompilerPath

Specify the path of the WebGPU shader compiler, which compiles GLSL to WGSL. The default value is `https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm`

## shoelaceBasePath

Our UI components use the Shoelace component library, which specifies the CDN path of Shoelace. The default value is `https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn`

## zoom

The zoom level of the canvas, default to `100`.

## mode

The interaction mode of the canvas, default to `CanvasMode.HAND`.

## modes

The interaction mode of the canvas, default to `[CanvasMode.HAND, CanvasMode.SELECT, CanvasMode.DRAW_RECT]`.
