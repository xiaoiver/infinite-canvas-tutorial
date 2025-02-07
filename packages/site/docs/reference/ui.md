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

## theme

Specify the theme, which can be `light` or `dark`, default to `light`.

```html
<ic-canvas theme="dark"></ic-canvas>
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

## FAQ

### How to specify the canvas size {#how-to-specify-the-canvas-size}

The canvas uses [Resize Observer] by default, so you only need to set the size of the canvas container through CSS, for example:

```html
<div style="height: 400px">
    <ic-canvas></ic-canvas>
</div>
```

### How to get the canvas instance {#how-to-get-the-canvas-instance}

Listen to the `ic-ready` event of the `<ic-canvas>` DOM element, and get the [canvas instance] in the event callback.

```js
$canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;
});
```

### Other canvas events {#other-canvas-events}

In addition to the `ic-ready` event, `<ic-canvas>` also supports the following events:

-   `ic-frame`：Triggered once per frame, with the current timestamp as the parameter.
-   `ic-theme-changed`：Triggered when the theme changes, with the current theme as the parameter.
    [Resize Observer]: https://shoelace.style/components/resize-observer
    [canvas instance]: /reference/canvas
