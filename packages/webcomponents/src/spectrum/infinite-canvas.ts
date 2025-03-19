import { html, css, LitElement, TemplateResult } from 'lit';
import { Task } from '@lit/task';
import { ContextProvider } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { App, DefaultPlugins, Pen } from '@infinite-canvas-tutorial/ecs';

import { appStateContext } from '../context';
import { UIPlugin } from '../plugins';
import { Event } from '../event';
import { checkWebGPUSupport } from '../utils';

import '@shoelace-style/shoelace/dist/components/resize-observer/resize-observer.js';

import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/src/themes.js';
import '@spectrum-web-components/alert-banner/sp-alert-banner.js';
import '@spectrum-web-components/progress-circle/sp-progress-circle.js';

@customElement('ic-spectrum-canvas')
export class InfiniteCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    sp-top-nav {
      padding: var(--spectrum-global-dimension-size-100);
      display: flex;
      justify-content: end;
      align-items: center;
    }

    ic-spectrum-taskbar {
      position: absolute;
      top: 48px;
      right: 0;
    }

    ic-spectrum-layers-panel {
      position: absolute;
      top: 48px;
      right: 54px;
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

  @property({
    attribute: 'shader-compiler-path',
  })
  shaderCompilerPath =
    'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm';

  @property({ type: Number })
  @state()
  zoom = 1;

  @property()
  @state()
  pen = Pen.HAND;

  @property({ type: Array })
  pens = [Pen.HAND, Pen.SELECT, Pen.DRAW_RECT];

  @state()
  layersPanelOpen = false;

  #app: App;

  #provider = new ContextProvider(this, { context: appStateContext });

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

      this.#provider.setValue({
        ...this.#provider.value,
        zoom: this.zoom,
      });

      const zoom = this.zoom;
      this.addEventListener(
        Event.ZOOM_CHANGED,
        (e: CustomEvent<{ zoom: number }>) => {
          this.zoom = e.detail.zoom;

          this.#provider.setValue({
            ...this.#provider.value,
            zoom: this.zoom,
          });
        },
      );

      const pen = this.pen;
      this.addEventListener(
        Event.PEN_CHANGED,
        (e: CustomEvent<{ pen: Pen }>) => {
          this.pen = e.detail.pen;
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
          pen,
        },
      ]);

      this.dispatchEvent(new CustomEvent(Event.READY, { detail: this.#app }));

      await this.#app.run();

      return canvas;
    },
    args: () => [this.renderer, this.shaderCompilerPath] as const,
  });

  private toggleLayersPanel() {
    this.layersPanelOpen = !this.layersPanelOpen;

    console.log('toggleLayersPanel', this.layersPanelOpen);
  }

  render() {
    const themeWrapper = (content: string | TemplateResult) =>
      html`<sp-theme system="spectrum" color="${this.theme}" scale="medium"
        >${typeof content === 'string' ? html`${content}` : content}</sp-theme
      >`;

    return this.initCanvas.render({
      pending: () =>
        themeWrapper(
          html`<sp-progress-circle
            label="A small representation of an unclear amount of work"
            indeterminate
            size="s"
          ></sp-progress-circle>`,
        ),
      complete: ($canvas) =>
        themeWrapper(
          html`<ic-spectrum-top-navbar></ic-spectrum-top-navbar>
            <ic-spectrum-taskbar
              @toggle-layers-panel=${this.toggleLayersPanel}
            ></ic-spectrum-taskbar>
            <ic-spectrum-layers-panel
              open=${this.layersPanelOpen}
            ></ic-spectrum-layers-panel>
            <sl-resize-observer @sl-resize=${this.resize}>
              ${$canvas}
            </sl-resize-observer>`,
        ),
      error: (e: Error) => {
        console.error(e);
        return themeWrapper(
          html`<sp-alert-banner open variant="negative">
            Initialize canvas failed<br />
            <strong></strong><br />
            ${e.message}
          </sp-alert-banner>`,
        );
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-canvas': InfiniteCanvas;
  }
}
