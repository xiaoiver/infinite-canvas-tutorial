---
outline: deep
publish: false
---

首先在全局创建一个 App 并使用默认的插件集，详见：[课程 18 - 使用 ECS 重构]

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
app.run();
```

然后就可以创建一个或多个画布，这里我们使用基于 WebComponents 实现的 UI 组件。

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
-   `shader-compiler-path` 用于将 GLSL 转译成 WGSL，详见 [课程 1 - 硬件抽象层]。默认值为 `'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm'`
-   `theme` 主题。可选值为 `'dark' | 'light'`，默认为 `'light'`
-   `app-state` JSON 字符串形式的应用状态，可以控制例如相机初始化参数
-   `nodes` JSON 字符串形式的图形列表

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

### Event.ZOOM_CHANGED

当画布相机缩放等级改变时触发。可以获取当前的缩放等级：`{ zoom: number }`

### Event.SCREENSHOT_DOWNLOADED

当导出图片请求完成后触发。可以获取导出图片的结果：`{ dataURL: string; svg: string }`

### Event.NODES_UPDATED

### Event.NODE_UPDATED

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
