import { html, css, LitElement, TemplateResult } from 'lit';
import { Task } from '@lit/task';
import { ContextProvider } from '@lit/context';
import { customElement, property } from 'lit/decorators.js';
import {
  Canvas,
  ComputedCamera,
  Pen,
  SerializedNode,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';

import {
  AppState,
  Task as TaskEnum,
  appStateContext,
  nodesContext,
} from '../context';
import { Event } from '../event';
import { API } from '../API';
import { checkWebGPUSupport } from '../utils';

import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/src/themes.js';
import '@spectrum-web-components/alert-banner/sp-alert-banner.js';
import '@spectrum-web-components/progress-circle/sp-progress-circle.js';

const TOP_NAVBAR_HEIGHT = 48;

/**
 * Since the canvas is created in the system, we need to store them here for later use.
 */
export const pendingCanvases: {
  container: LitElement;
  canvas: Partial<Canvas>;
  camera: Partial<ComputedCamera>;
}[] = [];

@customElement('ic-spectrum-canvas')
export class InfiniteCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    ic-spectrum-penbar {
      position: absolute;
      top: 48px;
      left: 0;
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

  @property({
    attribute: 'shader-compiler-path',
  })
  shaderCompilerPath =
    'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm';

  @property({ type: Object, attribute: 'app-state' })
  appState: AppState = {
    theme: {
      mode: ThemeMode.LIGHT,
      colors: {
        [ThemeMode.LIGHT]: {},
        [ThemeMode.DARK]: {},
      },
    },
    camera: {
      zoom: 1,
    },
    penbar: {
      all: [Pen.HAND, Pen.SELECT, Pen.DRAW_RECT],
      selected: [Pen.HAND],
    },
    taskbar: {
      all: [TaskEnum.SHOW_LAYERS_PANEL, TaskEnum.SHOW_PROPERTIES_PANEL],
      selected: [],
    },
  };

  @property({ type: Array })
  nodes: SerializedNode[] = [];

  #appStateProvider = new ContextProvider(this, { context: appStateContext });
  #nodesProvider = new ContextProvider(this, { context: nodesContext });

  api: API;

  private resizeObserver: ResizeObserver;

  connectedCallback() {
    super.connectedCallback();

    this.resizeObserver = new ResizeObserver((entries) =>
      this.handleResize(entries),
    );
    this.updateComplete.then(() => this.resizeObserver.observe(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.unobserve(this);

    this.api?.destroy();
  }

  private handleResize(entries: ResizeObserverEntry[]) {
    const { width, height } = entries[0].contentRect;
    const dpr = window.devicePixelRatio;

    if (width && height) {
      const $canvas = this.shadowRoot?.querySelector('canvas');
      $canvas.width = width * dpr;
      $canvas.height = (height - TOP_NAVBAR_HEIGHT) * dpr;

      this.api.resizeCanvas(width, height - TOP_NAVBAR_HEIGHT);
    }
  }

  private initCanvas = new Task(this, {
    task: async ([renderer, shaderCompilerPath]) => {
      if (renderer === 'webgpu') {
        await checkWebGPUSupport();
      }

      this.#appStateProvider.setValue(this.appState);
      this.#nodesProvider.setValue(this.nodes);

      /**
       * Update context values
       */

      this.addEventListener(Event.ZOOM_CHANGED, (e: CustomEvent) => {
        this.#appStateProvider.setValue({
          ...this.#appStateProvider.value,
          camera: {
            ...this.#appStateProvider.value.camera,
            zoom: e.detail.zoom,
          },
        });
      });

      this.addEventListener(Event.PEN_CHANGED, (e: CustomEvent) => {
        this.#appStateProvider.setValue({
          ...this.#appStateProvider.value,
          penbar: {
            ...this.#appStateProvider.value.penbar,
            selected: e.detail.selected,
          },
        });
      });

      this.addEventListener(Event.TASK_CHANGED, (e: CustomEvent) => {
        this.#appStateProvider.setValue({
          ...this.#appStateProvider.value,
          taskbar: {
            ...this.#appStateProvider.value.taskbar,
            selected: e.detail.selected,
          },
        });
      });

      this.addEventListener(Event.NODES_UPDATED, (e: CustomEvent) => {
        this.#nodesProvider.setValue(e.detail.nodes);
      });

      const $canvas = document.createElement('canvas');
      $canvas.style.width = '100%';
      $canvas.style.height = 'calc(100% - 48px)';

      const { width, height } = this.getBoundingClientRect();
      const {
        camera: { zoom },
      } = this.appState;

      pendingCanvases.push({
        container: this,
        canvas: {
          element: $canvas,
          width,
          height: height - TOP_NAVBAR_HEIGHT,
          devicePixelRatio: window.devicePixelRatio,
          renderer,
          shaderCompilerPath,
        },
        camera: {
          zoom,
        },
      });

      return $canvas;
    },
    args: () => [this.renderer, this.shaderCompilerPath] as const,
  });

  render() {
    const themeWrapper = (content: string | TemplateResult) =>
      html`<sp-theme
        system="spectrum"
        color="${this.appState.theme.mode}"
        scale="medium"
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
            <ic-spectrum-penbar></ic-spectrum-penbar>
            <ic-spectrum-taskbar></ic-spectrum-taskbar>
            <ic-spectrum-layers-panel></ic-spectrum-layers-panel>
            ${$canvas}`,
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
