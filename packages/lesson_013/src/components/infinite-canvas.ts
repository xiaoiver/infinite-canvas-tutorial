import { html, css, LitElement } from 'lit';
import { ContextProvider } from '@lit/context';
import { Task } from '@lit/task';
import { customElement, property, state } from 'lit/decorators.js';
import { Canvas } from '../Canvas';
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

@customElement('ic-canvas-lesson13')
export class InfiniteCanvas extends LitElement {
  static styles = css`
    :host {
      position: relative;
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

  @state()
  zoom = 100;

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

      this.#canvas.pluginContext.hooks.cameraChange.tap(() => {
        this.zoom = Math.round(this.#canvas.camera.zoom * 100);
      });

      this.dispatchEvent(new CustomEvent('ic-ready', { detail: this.#canvas }));

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
          <ic-zoom-toolbar-lesson13
            zoom=${this.zoom}
          ></ic-zoom-toolbar-lesson13>
          <ic-exporter-lesson13></ic-exporter-lesson13>
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
    'ic-canvas-lesson13': InfiniteCanvas;
  }
}
