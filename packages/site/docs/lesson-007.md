---
outline: deep
---

# Lesson 7 - Web UI

In this lesson, you will learn the following:

- Developing Web UI with Lit and Shoelace
- Implementing a canvas component
- Implementing a zoom toolbar component

<div style="width: 100%; height: 200px;">
  <ic-canvas />
</div>

## Web UI with Lit and Shoelace

When choosing a component library, I didn't want it to be tied to a specific framework implementation. Web components is a good choice, and [Lit] provides reactive state, scoped styles, and a declarative template system to make the development process easier. [Shoelace] is an UI library based on [Lit]. Using them, we can make our canvas components framework-agnostic by supporting React, Vue, and Angular at the same time.

Since this tutorial static site is written using [VitePress], [Vue instructions] is used in the example pages, but no Vue syntax will be used in the components.

Next, we'll take the simple functionality that we already have and wrap it into UI components.

## Canvas component

A canvas component is declared using [Lit], and to avoid potential naming conflicts, we use `ic` as the component prefix:

```ts
import { LitElement } from 'lit';

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {}
```

We define `renderer` property with decorator, so that we can use it with such syntax: `<ic-canvas renderer="webgl" />`.

```ts
import { property } from 'lit/decorators.js';

export class InfiniteCanvas extends LitElement {
  @property()
  renderer = 'webgl';
}
```

We want the canvas to follow the page's width and height, and Shoelace provides an out-of-the-box [Resize Observer] that throws a custom event `sl-resize` when the element's width or height changes. We declare the HTML in the `render` lifecycle provided by [Lit], and the actual HTMLCanvasElement can be quickly queried via [query]:

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

Listens for size changes during the [connectedCallback] lifecycle and unlistsens during the [disconnectedCallback] lifecycle:

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

The question of when to create the canvas has been bugging me for a while, trying to get `<canvas>` in the [connectedCallback] lifecycle would return `undefined` since the CustomElement had not been added to the document yet, so naturally I couldn't query it via the DOM API. In the end I found that [firstUpdated] was a good time to trigger the custom event `ic-ready` after creating the canvas and bring the canvas instance in the event object, and to trigger the custom event `ic-frame` on each tick:

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

So our canvas component is written. the framework-agnostic nature of web components allows us to use them in a consistent way. Take Vue and React for example:

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

Get the canvas instance by listening to the `ic-ready` custom event when the canvas is loaded:

```ts
const $canvas = document.querySelector('ic-canvas');
$canvas.addEventListener('ic-ready', (e) => {
  const canvas = e.detail;
  // 创建场景图
  canvas.appendChild(circle);
});
```

Here we will implement the camera zoom component.

## Zoom component

The following figure shows the zoom component of Miro:

![miro zoom toolbar](/miro-toolbar.png)

Let's create an `ic-zoom-toolbar` first:

```ts
@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {}
```

Add it to canvas component:

```html
<sl-resize-observer>
  <canvas></canvas>
  <ic-zoom-toolbar zoom="${this.zoom}"></ic-zoom-toolbar> // [!code ++]
</sl-resize-observer>
```

The internal structure of this component looks like this, and you can see that Lit uses a template syntax that is very close to Vue:

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

In order to pass the canvas instance from the canvas component to its children, we use [Lit Context], which is saved to the context after instantiation:

```ts
const canvasContext = createContext<Canvas>(Symbol('canvas'));

export class InfiniteCanvas extends LitElement {
  #provider = new ContextProvider(this, { context: canvasContext });

  async firstUpdated() {
    this.#provider.setValue(this.#canvas);
  }
}
```

It can then be consumed in the child component via the context, and since the canvas creation is asynchronous, it needs to be `subscribe` to allow us to keep track of the context in real time:

```ts
export class ZoomToolbar extends LitElement {
  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;
}
```

Add a callback function to the camera that is triggered every time the camera or projection matrix changes:

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

The responsive variable `zoom` is modified when the callback is triggered.

```ts
this.#canvas.camera.onchange = () => {
  this.zoom = Math.round(this.#canvas.camera.zoom * 100);
};
```

We won't go into the details of the UI implementation later.

[Shoelace]: https://shoelace.style/
[VitePress]: https://vitepress.dev/
[Vue instructions]: https://shoelace.style/frameworks/vue
[Resize Observer]: https://shoelace.style/components/resize-observer
[Lit]: https://lit.dev/
[connectedCallback]: https://lit.dev/docs/components/lifecycle/#connectedcallback
[disconnectedCallback]: https://lit.dev/docs/components/lifecycle/#disconnectedCallback
[query]: https://lit.dev/docs/api/decorators/#query
[firstUpdated]: https://lit.dev/docs/components/lifecycle/#firstupdated
[Lit Context]: https://lit.dev/docs/data/context/
