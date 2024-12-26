import { html, css, LitElement } from 'lit';
import { ContextProvider } from '@lit/context';
import { Task } from '@lit/task';
import { customElement, property, state } from 'lit/decorators.js';
import { Canvas, CanvasMode } from '@infinite-canvas-tutorial/core';
import { canvasContext } from './context';

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
  renderer = 'webgl';

  @property()
  shaderCompilerPath =
    'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm';

  @property()
  @state()
  zoom = 100;

  @property()
  @state()
  mode = CanvasMode.HAND;

  @property({ type: Array })
  modes = [CanvasMode.HAND, CanvasMode.SELECT, CanvasMode.DRAW_RECT];

  #provider = new ContextProvider(this, { context: canvasContext });

  #canvas: Canvas;
  #rafHandle: number;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('sl-resize', this.resize);
  }

  disconnectedCallback() {
    this.removeEventListener('sl-resize', this.resize);

    if (this.#rafHandle) {
      window.cancelAnimationFrame(this.#rafHandle);
    }
    this.#canvas?.destroy();
    super.disconnectedCallback();
  }

  private resize(event: CustomEvent) {
    const detail = event.detail as { entries: ResizeObserverEntry[] };
    const { width, height } = detail.entries[0].contentRect;
    const dpr = window.devicePixelRatio;

    if (width && height) {
      const $canvas = this.#canvas.getDOM();
      $canvas.width = width * dpr;
      $canvas.height = height * dpr;
      this.#canvas?.resize(width, height);
    }
  }

  private modeChangedHandler(e: CustomEvent) {
    this.mode = e.detail.mode;
    this.#canvas.mode = e.detail.mode;
  }

  private initCanvas = new Task(this, {
    task: async ([renderer, shaderCompilerPath]) => {
      if (renderer === 'webgpu') {
        await checkWebGPUSupport();
      }

      const canvas = document.createElement('canvas');

      this.#canvas = await new Canvas({
        canvas,
        renderer,
        shaderCompilerPath,
      }).initialized;

      this.#provider.setValue(this.#canvas);

      this.#canvas.mode = this.mode;

      // Initialize camera zoom.
      this.#canvas.camera.zoom = this.zoom / 100;
      this.#canvas.pluginContext.hooks.cameraChange.tap(() => {
        this.zoom = Math.round(this.#canvas.camera.zoom * 100);
      });

      // FIXME: Hack to make sure the canvas is ready for Genji.
      // setTimeout(() => {
      this.dispatchEvent(new CustomEvent('ic-ready', { detail: this.#canvas }));
      // }, 10);

      const animate = (time?: DOMHighResTimeStamp) => {
        this.dispatchEvent(new CustomEvent('ic-frame', { detail: time }));

        this.#canvas.render();
        this.#rafHandle = window.requestAnimationFrame(animate);
      };
      animate();

      return this.#canvas.getDOM();
    },
    args: () =>
      [this.renderer as 'webgl' | 'webgpu', this.shaderCompilerPath] as const,
  });

  render() {
    return this.initCanvas.render({
      pending: () => html`<sl-spinner></sl-spinner>`,
      complete: ($canvas) => html`
        <sl-resize-observer>
          ${$canvas}
          <ic-zoom-toolbar zoom=${this.zoom}></ic-zoom-toolbar>
          <ic-mode-toolbar
            mode=${this.mode}
            modes=${JSON.stringify(this.modes)}
            @modechanged=${this.modeChangedHandler}
          ></ic-mode-toolbar>
          <ic-exporter></ic-exporter>
          <ic-property-drawer></ic-property-drawer>
        </sl-resize-observer>
      `,
      error: (e: Error) => html`<sl-alert variant="danger" open>
        <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
        <strong>Initialize canvas failed</strong><br />
        ${e.message}
      </sl-alert>`,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-canvas': InfiniteCanvas;
  }
}
