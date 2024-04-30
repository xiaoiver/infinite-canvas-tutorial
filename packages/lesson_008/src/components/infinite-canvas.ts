import { html, css, LitElement } from 'lit';
import { ContextProvider } from '@lit/context';
import { customElement, property, state, query } from 'lit/decorators.js';
import { Canvas } from '../Canvas';
import { canvasContext } from './context';

@customElement('ic-canvas-lesson8')
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

  @state()
  zoom = 100;

  @query('canvas', true)
  $canvas: HTMLCanvasElement;

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

  async firstUpdated() {
    this.#canvas = await new Canvas({
      canvas: this.$canvas,
      renderer: this.renderer as 'webgl' | 'webgpu',
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
  }

  private resize(event: CustomEvent) {
    const detail = event.detail as { entries: ResizeObserverEntry[] };
    const { width, height } = detail.entries[0].contentRect;
    const dpr = window.devicePixelRatio;

    if (width && height) {
      const $canvas = this.$canvas;
      $canvas.width = width * dpr;
      $canvas.height = height * dpr;
      this.#canvas?.resize(width, height);
    }
  }

  render() {
    return html`
      <sl-resize-observer>
        <canvas></canvas>
        <ic-zoom-toolbar-lesson8 zoom=${this.zoom}></ic-zoom-toolbar>
      </sl-resize-observer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-canvas-lesson8': InfiniteCanvas;
  }
}
