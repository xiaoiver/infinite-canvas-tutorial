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

## theme

指定明暗主题，可选值为 `light` 和 `dark`，默认值为 `light`。

```html
<ic-canvas theme="dark"></ic-canvas>
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

## FAQ

### 如何指定画布大小 {#how-to-specify-the-canvas-size}

画布默认使用了 [Resize Observer]，因此只需要通过 CSS 设置画布容器的大小即可，例如：

```html
<div style="height: 400px">
    <ic-canvas></ic-canvas>
</div>
```

### 如何获取画布实例 {#how-to-get-the-canvas-instance}

监听 `<ic-canvas>` DOM 元素的 `ic-ready` 事件，在事件回调中获取[画布实例]。

```js
$canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;
});
```

### 其他画布事件 {#other-canvas-events}

除了 `ic-ready` 事件，`<ic-canvas>` 还支持以下事件：

-   `ic-frame`：每帧触发一次，参数为当前时间戳。
-   `ic-theme-changed`：主题改变时触发，参数为当前主题，取值为 `light` 或 `dark`。

[Resize Observer]: https://shoelace.style/components/resize-observer
[画布实例]: /zh/reference/canvas
