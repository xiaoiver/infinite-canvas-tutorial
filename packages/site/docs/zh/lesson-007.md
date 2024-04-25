---
outline: deep
---

# 课程 7 - Web UI

在这节课中你将学习到以下内容：

- 使用 Lit 和 Shoelace 开发 Web UI
- 实现画布组件，监听页面宽高变换
- 实现缩放组件

<div style="width: 100%; height: 200px;">
  <ic-canvas />
</div>

## 使用 Lit 和 Shoelace 开发 Web UI

在选择组件库时，我不希望它绑定在某个具体的框架实现上。Web components 是不错的选择，[Lit] 为它添加了响应式状态、声明式模版、模块化样式等特性，让开发过程变得更便捷。[Shoelace] 是一个基于 [Lit] 开发的组件库。使用它们可以让我们的画布组件同时支持 React、Vue 和 Angular，做到真正的框架无关。

由于本教程静态站点使用 [VitePress] 编写，因此在示例页面中使用了 [Vue 的接入方式]，但组件中不会使用到 Vue 的语法。

接下来我们将目前已有的简单功能封装成 UI 组件。

## 画布组件

使用 [Lit] 声明一个画布组件，为了避免潜在的命名冲突，我们使用了 `ic` 作为组件前缀：

```ts
import { LitElement } from 'lit';

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {}
```

首先通过装饰器定义画布组件的属性，这样可以通过 `<ic-canvas renderer="webgl" />` 使用它：

```ts
import { property } from 'lit/decorators.js';

export class InfiniteCanvas extends LitElement {
  @property()
  renderer = 'webgl';
}
```

我们希望画布跟随页面宽高变化，Shoelace 提供了开箱即用的 [Resize Observer]，当元素宽高改变时会抛出自定义事件 `sl-resize`。我们在 [Lit] 提供的 `render` 生命周期中声明 HTML，通过 [query] 可以快捷地查询到实际的 HTMLCanvasElement：

```ts
export class InfiniteCanvas extends LitElement {
  @query('canvas', true)
  $canvas: HTMLCanvasElement;

  render() {
    return html`
      <sl-resize-observer>
        <canvas></canvas>
      </sl-resize-observer>
    `;
  }
}
```

在 [connectedCallback] 生命周期中，监听尺寸变化，在 [disconnectedCallback] 生命周期中解除监听：

```ts
export class InfiniteCanvas extends LitElement {
  connectedCallback() {
    this.addEventListener('sl-resize', this.resize);
  }
  disconnectedCallback() {
    this.removeEventListener('sl-resize', this.resize);
  }
}
```

何时创建画布这个问题困扰了我一阵，在 [connectedCallback] 生命周期中尝试获取 `<canvas>` 将返回 `undefined`，因为此时 CustomElement 还没有加入到文档中，自然也没法通过 DOM API 查询到。最后我发现 [firstUpdated] 是个不错的时机，创建画布后触发自定义事件 `ic-ready` 并在事件对象中带上画布实例，同时在每个 tick 中触发自定义事件 `ic-frame`：

```ts
export class InfiniteCanvas extends LitElement {
  async firstUpdated() {
    this.#canvas = await new Canvas({
      canvas: this.$canvas,
      renderer: this.renderer as 'webgl' | 'webgpu',
    }).initialized;

    this.dispatchEvent(new CustomEvent('ic-ready', { detail: this.#canvas }));

    const animate = (time?: DOMHighResTimeStamp) => {
      this.dispatchEvent(new CustomEvent('ic-frame', { detail: time }));
      this.#canvas.render();
      this.#rafHandle = window.requestAnimationFrame(animate);
    };
    animate();
  }
}
```

这样我们的画布组件就编写完成了。Web components 的框架无关性让我们可以以一致的方式使用。以 Vue 和 React 为例：

```vue
<template>
  <ic-canvas renderer="webgl"></ic-canvas>
</template>
```

```tsx
<div>
  <ic-canvas renderer="webgl"></ic-canvas>
</div>
```

画布加载完成后通过监听 `ic-ready` 自定义事件获取画布实例：

```ts
const $canvas = document.querySelector('ic-canvas');
$canvas.addEventListener('ic-ready', (e) => {
  const canvas = e.detail;
  // 创建场景图
  canvas.appendChild(circle);
});
```

下面我们来实现相机缩放组件。

## 相机缩放组件

下图是 Miro 的缩放组件：

![miro zoom toolbar](/miro-toolbar.png)

我们创建一个 `ic-zoom-toolbar`

```ts
@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {}
```

在上一节的画布组件中添加：

```html
<sl-resize-observer>
  <canvas></canvas>
  <ic-zoom-toolbar zoom="${this.zoom}"></ic-zoom-toolbar> // [!code ++]
</sl-resize-observer>
```

这个组件内部结构如下，可以看到 Lit 使用的模版语法很接近 Vue：

```html
<sl-button-group label="Zoom toolbar">
  <sl-tooltip content="Zoom out">
    <sl-icon-button
      name="dash-lg"
      label="Zoom out"
      @click="${this.zoomOut}"
    ></sl-icon-button>
  </sl-tooltip>
  <span>${this.zoom}%</span>
  <sl-tooltip content="Zoom in">
    <sl-icon-button
      name="plus-lg"
      label="Zoom in"
      @click="${this.zoomIn}"
    ></sl-icon-button>
  </sl-tooltip>
</sl-button-group>
```

为了将画布组件中的画布实例传递到组件中，我们使用了 [Lit Context]，在实例化后保存到上下文中：

```ts
const canvasContext = createContext<Canvas>(Symbol('canvas'));

export class InfiniteCanvas extends LitElement {
  #provider = new ContextProvider(this, { context: canvasContext });

  async firstUpdated() {
    this.#provider.setValue(this.#canvas);
  }
}
```

然后就可以通过上下文在组件中消费了，由于画布的创建是异步的，需要通过 `subscribe` 让我们实时保持对上下文的跟踪：

```ts
export class ZoomToolbar extends LitElement {
  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;
}
```

在相机上增加一个回调函数，每次相机或者投影矩阵发生变化时触发：

```ts
export class Camera {
  onchange: () => void;
  private updateViewProjectionMatrix() {
    if (this.onchange) {
      this.onchange();
    }
  }
}
```

回调触发时会修改响应式变量 `zoom`

```ts
this.#canvas.camera.onchange = () => {
  this.zoom = Math.round(this.#canvas.camera.zoom * 100);
};
```

后续我们就不再详细介绍 UI 部分的实现了。

[Shoelace]: https://shoelace.style/
[VitePress]: https://vitepress.dev/
[Vue 的接入方式]: https://shoelace.style/frameworks/vue
[Resize Observer]: https://shoelace.style/components/resize-observer
[Lit]: https://lit.dev/
[connectedCallback]: https://lit.dev/docs/components/lifecycle/#connectedcallback
[disconnectedCallback]: https://lit.dev/docs/components/lifecycle/#disconnectedCallback
[query]: https://lit.dev/docs/api/decorators/#query
[firstUpdated]: https://lit.dev/docs/components/lifecycle/#firstupdated
[Lit Context]: https://lit.dev/docs/data/context/
