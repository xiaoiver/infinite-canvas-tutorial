---
outline: deep
---
首先在全局创建一个 App 并使用默认的插件集，详见：[课程 18 - 使用 ECS 重构]

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
app.run();
```

然后就可以创建一个或多个画布，这里我们使用基于 WebComponents 实现的 UI 组件。

React 项目可以使用 [React 封装](/zh/reference/react)，自动管理运行时、画布生命周期和事件。

## 使用 WebComponents {#use-webcomponents}

首先引入组件库：

```ts
import '@infinite-canvas-tutorial/webcomponents';
```

在 HTML 中声明组件：

```html
<ic-spectrum-canvas
    id="canvas"
    style="width: 100%; height: 100%;"
    app-state='{"topbarVisible":true, "cameraZoom": 1}'
    renderer="webgl"
></ic-spectrum-canvas>
```

该组件中，可以通过 HTML Attribute 传入的参数如下：

-   `renderer` 渲染器。可选值为 `'webgl' | 'webgpu'`，默认为 `'webgl'`
-   `shader-compiler-path` 覆盖 GLSL 转 WGSL 编译器的 URL。默认空值会加载 `@infinite-canvas-tutorial/device-api` 包内配套的 WASM，详见 [课程 1 - 硬件抽象层]。
-   `theme` 主题。可选值为 `'dark' | 'light'`，默认为 `'light'`
-   `app-state` JSON 字符串形式的应用状态，可以控制例如相机初始化参数
-   `nodes` JSON 字符串形式的图形列表

### 打包 WebGPU Shader 编译器 {#shader-compiler}

`ic-spectrum-canvas` 和 React 封装会在 WebGPU 初始化时加载 `@infinite-canvas-tutorial/device-api` 包内配套的编译器。WebGL 和 SSR 导入不会请求或初始化它。Vite 和 webpack 的生产构建会将 WASM 输出为应用资源，默认不再依赖 UNPKG。

Vite 开发模式需要将 device 包排除在依赖预打包之外，使编译器地址保持相对于模块的位置。React Vite 模板已包含这项配置：

```ts
import { defineConfig } from 'vite';

export default defineConfig({
    optimizeDeps: { exclude: ['@infinite-canvas-tutorial/device-api'] },
});
```

仍可指定自定义编译器 URL，包括通过 `?url` 显式导入的地址。请在将画布加入 DOM 前设置该属性：

```ts
import compilerUrl from '@infinite-canvas-tutorial/device-api/shader-compiler.wasm?url';

const canvas = document.createElement('ic-spectrum-canvas');
canvas.style.height = '400px';
canvas.setAttribute('renderer', 'webgpu');
canvas.setAttribute('shader-compiler-path', compilerUrl);
document.body.append(canvas);
```

较早的教程组件和 `ic-canvas` 仍使用固定为 `1.6.13` 的上游 CDN 地址。经 2026 年 10 月 13 日核对，其 WASM 与包内文件逐字节相同，改用内置资源不会升级编译器。安装上游 npm 包前，请先阅读[第一课的安全说明](/zh/guide/lesson-001)。

## 获取 API {#use-api}

通过监听画布的初始化事件 `Event.READY`，可以从事件对象中获取 API 实例，接下来就可以调用上面的各种方法了：

```ts
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const canvas = document.querySelector<HTMLElement>('#canvas')!;
canvas.addEventListener(Event.READY, async (e) => {
    const api = e.detail;
});
```

## 画布事件 {#canvas-events}

以下是画布 DOM 节点上触发的自定义事件，可以通过 `e.detail` 获取事件对象。

### Event.READY

当画布初始化完成时触发。可以获取 `ExtendedAPI`

### Event.RESIZED

当画布改变尺寸时触发。可以获取此时画布的宽高：`{ width: number; height: number }`

### Event.CAMERA_ZOOM_CHANGED

当画布相机缩放等级改变时触发。可以获取当前的缩放等级：`{ zoom: number }`

### Event.SCREENSHOT_DOWNLOADED

当导出图片请求完成后触发。可以获取导出图片的结果：`{ dataURL: string; svg: string }`

### Event.NODES_UPDATED

### Event.NODE_DELETED

### Event.SELECTED_NODES_CHANGED

### Event.TRANSFORMABLE_STATUS_CHANGED

### Event.COMMENT_ADDED

下面我们来看看内部是如何实现的。

## 内部实现 {#implementation}

在 InitCanvas System 中，我们使用 Lit 的上下文功能：

```ts
const stateManagement = new LitStateManagement(appStateProvider, nodesProvider);
const api = new ExtendedAPI(stateManagement, this.commands, container);
```

[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[课程 1 - 硬件抽象层]: /zh/guide/lesson-001#hardware-abstraction-layers
