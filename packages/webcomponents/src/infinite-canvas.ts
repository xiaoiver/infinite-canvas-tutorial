import { html, css, LitElement } from 'lit';
import { Task } from '@lit/task';
import { customElement, property, state } from 'lit/decorators.js';
import { App, DefaultPlugins, Pen } from '@infinite-canvas-tutorial/ecs';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';

import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/resize-observer/resize-observer.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
/**
 * @see https://shoelace.style/getting-started/themes
 */
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';

import { UIPlugin } from './plugins';
import { Event } from './event';

async function checkWebGPUSupport() {
  if ('gpu' in navigator) {
    const gpu = await navigator.gpu.requestAdapter();
    if (!gpu) {
      throw new Error('No WebGPU adapter available.');
    }
  } else {
    throw new Error('WebGPU is not supported by the browser.');
  }
}

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    :host ic-dark-mode {
      position: absolute;
      right: 52px;
      top: 16px;
    }

    :host ic-exporter {
      position: absolute;
      right: 16px;
      top: 16px;
    }

    :host ic-mode-toolbar {
      position: absolute;
      left: 50%;
      top: 16px;
      transform: translateX(-50%);
    }

    :host ic-zoom-toolbar {
      position: absolute;
      right: 16px;
      bottom: 16px;
    }

    canvas {
      width: 100%;
      height: 100%;
      outline: none;
      padding: 0;
      margin: 0;
      touch-action: none;
    }
  `;

  @property()
  renderer: 'webgl' | 'webgpu' = 'webgl';

  @property()
  theme: 'dark' | 'light' = 'light';

  @property()
  shaderCompilerPath =
    'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm';

  @property()
  shoelaceBasePath =
    'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn';

  @property({ type: Number })
  @state()
  zoom = 1;

  @property()
  @state()
  mode = Pen.HAND;

  @property({ type: Array })
  modes = [Pen.HAND, Pen.SELECT, Pen.DRAW_RECT];

  #app: App;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('sl-resize', this.resize);
  }

  disconnectedCallback() {
    this.removeEventListener('sl-resize', this.resize);

    if (this.#app) {
      this.#app.exit();
    }
    super.disconnectedCallback();
  }

  private resize(event: CustomEvent) {
    const detail = event.detail as { entries: ResizeObserverEntry[] };
    const { width, height } = detail.entries[0].contentRect;
    const dpr = window.devicePixelRatio;

    if (width && height) {
      const $canvas = this.shadowRoot?.querySelector('canvas');
      $canvas.width = width * dpr;
      $canvas.height = height * dpr;

      this.dispatchEvent(
        new CustomEvent(Event.RESIZED, {
          detail: { width, height },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private initCanvas = new Task(this, {
    task: async ([renderer, shaderCompilerPath]) => {
      if (renderer === 'webgpu') {
        await checkWebGPUSupport();
      }

      setBasePath(this.shoelaceBasePath);

      const zoom = this.zoom;
      this.addEventListener(
        Event.ZOOM_CHANGED,
        (e: CustomEvent<{ zoom: number }>) => {
          this.zoom = e.detail.zoom;
        },
      );

      const canvas = document.createElement('canvas');
      this.#app = new App().addPlugins(...DefaultPlugins, [
        UIPlugin,
        {
          container: this,
          canvas,
          renderer,
          shaderCompilerPath,
          zoom,
        },
      ]);

      this.dispatchEvent(new CustomEvent(Event.READY, { detail: this.#app }));

      await this.#app.run();

      return canvas;
    },
    args: () => [this.renderer, this.shaderCompilerPath] as const,
  });

  render() {
    return this.initCanvas.render({
      pending: () => html`<sl-spinner></sl-spinner>`,
      complete: ($canvas) => html`
        <sl-resize-observer>
          ${$canvas}
          <ic-zoom-toolbar zoom=${this.zoom}></ic-zoom-toolbar>
          <ic-exporter></ic-exporter>
        </sl-resize-observer>
      `,
      error: (e: Error) => {
        console.error(e);
        return html`<sl-alert variant="danger" open>
          <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
          <strong>Initialize canvas failed</strong><br />
          ${e.message}
        </sl-alert>`;
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-canvas': InfiniteCanvas;
  }

  interface HTMLElementEventMap {
    [Event.READY]: CustomEvent<App>;
    [Event.RESIZED]: CustomEvent<{ width: number; height: number }>;
  }
}
