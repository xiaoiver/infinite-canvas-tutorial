---
outline: deep
---

# Lesson 7 - Web UI

In this lesson, you will learn the following:

-   Developing Web UI with Lit and Shoelace
-   Implementing a canvas component
-   Implementing a zoom toolbar component

<div style="width: 100%; height: 200px;">
  <ic-canvas-lesson7 />
</div>

## Web UI with Lit and Shoelace

When choosing a component library, I didn't want it to be tied to a specific framework implementation, see [Web Components are not Framework Components — and That’s Okay]. Web components is a good choice, and [Lit] provides reactive state, scoped styles, and a declarative template system to make the development process easier. [Shoelace] is an UI library based on [Lit], [Web Awesome] is the fancy pants new name for it. Using them, we can make our canvas components framework-agnostic by supporting React, Vue, and Angular at the same time. It's worth noting that the [spectrum-web-components] component library used by Photoshop Web is also based on Lit, see: [Photoshop is now on the web!]

> Photoshop is part of Adobe’s broader Creative Cloud ecosystem. Using a standardized Web Components strategy built on Lit allows UI consistency across applications.

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

### Lifecycle for canvas initialization {#lifecycle-for-canvas-initialization}

The question of when to create the canvas has been bugging me for a while, trying to get `<canvas>` in the [connectedCallback] lifecycle would return `undefined` since the CustomElement had not been added to the document yet, so naturally I couldn't query it via the DOM API. In the end I found that [firstUpdated] was a good time to trigger the custom event `ic-ready` after creating the canvas and bring the canvas instance in the event object, and to trigger the custom event `ic-frame` on each tick:

```ts
export class InfiniteCanvas extends LitElement {
    async firstUpdated() {
        this.#canvas = await new Canvas({
            canvas: this.$canvas,
            renderer: this.renderer as 'webgl' | 'webgpu',
        }).initialized;

        this.dispatchEvent(
            new CustomEvent('ic-ready', { detail: this.#canvas }),
        );

        const animate = (time?: DOMHighResTimeStamp) => {
            this.dispatchEvent(new CustomEvent('ic-frame', { detail: time }));
            this.#canvas.render();
            this.#rafHandle = window.requestAnimationFrame(animate);
        };
        animate();
    }
}
```

Is there a better solution than this hack?

### Use async task {#async-task}

For this kind of scenario where an asynchronous task is executed and then rendered, React provides [\<Suspense\>]:

```tsx
<Suspense fallback={<Loading />}>
    <SomeComponent />
</Suspense>
```

Lit also provides similar [Async Tasks] so that we can display the loading and error states before the asynchronous task completes and when it errors out. When creating an asynchronous task with `Task`, you need to specify the parameters and include the created `<canvas>` as a return value, so that it can be retrieved and rendered in the `complete` hook of the render function.

```ts
private initCanvas = new Task(this, {
    task: async ([renderer]) => {
      return canvas.getDOM();
    },
    args: () => [this.renderer as 'webgl' | 'webgpu'] as const,
});

render() {
  return this.initCanvas.render({
    pending: () => html`<sl-spinner></sl-spinner>`,
    complete: ($canvas) => html`
      <sl-resize-observer>
        ${$canvas}
        <ic-zoom-toolbar-lesson7 zoom=${this.zoom}></ic-zoom-toolbar-lesson7>
      </sl-resize-observer>
    `,
    error: (e) => html`<sl-alert variant="danger" open>${e}</sl-alert>`,
  });
}
```

For example, in Safari, which does not support WebGPU, the following error message will be displayed:

<sl-alert variant="danger" open>
  <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
  <strong>Initialize canvas failed</strong><br />
  WebGPU is not supported by the browser.
</sl-alert>

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

```ts{9}
const canvasContext = createContext<Canvas>(Symbol('canvas'));

export class InfiniteCanvas extends LitElement {
    #provider = new ContextProvider(this, { context: canvasContext });

    private initCanvas = new Task(this, {
      task: async ([renderer]) => {
        // ...省略实例化画布过程
        this.#provider.setValue(this.#canvas);
      }
    });
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

## Theme {#theme}

Theme needs to be applied to UI components and the canvas. Let's start with the former.

### UI components {#theme-in-ui}

Shoelace provides [Themes] functionality, which can be easily switched. First, import the style sheets for the two themes:

```ts
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';
```

When switching to the dark theme, simply add an identifier class to the root element:

```ts
this.classList.toggle('sl-theme-dark', this.theme === 'dark');
```

Finally, when writing component styles, use CSS variables instead of fixed values, so that they can be automatically applied when switching themes:

```ts
:host {
    background: var(--sl-panel-background-color);
}
```

### Canvas background and grid {#theme-in-canvas}

The background and [Grid] of the canvas also need to be associated with the theme color. Reference [Theme colors in DGM.js], we support passing in the color values for the light and dark themes when creating the canvas:

```ts
enum Theme {
    LIGHT,
    DARK,
}

interface ThemeColors {
    background: string;
    grid: string;
}

interface CanvasConfig {
    themeColors?: Partial<{
        [Theme.LIGHT]: Partial<ThemeColors>; // [!code ++]
        [Theme.DARK]: Partial<ThemeColors>; // [!code ++]
    }>; // [!code ++]
}
```

Support switching at runtime:

```ts
canvas.theme = Theme.DARK;
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
[Async Tasks]: https://lit.dev/docs/data/task/#overview
[\<Suspense\>]: https://react.dev/reference/react/Suspense
[Web Components are not Framework Components — and That’s Okay]: https://lea.verou.me/blog/2024/wcs-vs-frameworks/
[Photoshop is now on the web!]: https://medium.com/@addyosmani/photoshop-is-now-on-the-web-38d70954365a
[spectrum-web-components]: https://opensource.adobe.com/spectrum-web-components/
[Web Awesome]: https://www.kickstarter.com/projects/fontawesome/web-awesome
[Themes]: https://shoelace.style/getting-started/themes
[Grid]: /guide/lesson-005
[Theme colors in DGM.js]: https://dgmjs.dev/api-core/variables/themecolors
