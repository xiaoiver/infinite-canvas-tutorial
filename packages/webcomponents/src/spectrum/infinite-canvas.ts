import { html, css, LitElement, TemplateResult } from 'lit';
import { Task } from '@lit/task';
import { ContextProvider } from '@lit/context';
import { customElement, property } from 'lit/decorators.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

import {
  AppState,
  apiContext,
  appStateContext,
  getDefaultAppState,
  nodesContext,
} from '../context';
import { Event } from '../event';
import { checkWebGPUSupport } from '../utils';
import { pendingCanvases } from '../API';

import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/src/themes.js';
// import '@spectrum-web-components/accordion/sp-accordion.js';
// import '@spectrum-web-components/accordion/sp-accordion-item.js';
import '@spectrum-web-components/action-group/sp-action-group.js';
import '@spectrum-web-components/action-menu/sp-action-menu.js';
import '@spectrum-web-components/alert-banner/sp-alert-banner.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/menu/sp-menu-divider.js';
import '@spectrum-web-components/progress-circle/sp-progress-circle.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import '@spectrum-web-components/thumbnail/sp-thumbnail.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';

import '@spectrum-web-components/icons-workflow/icons/sp-icon-text.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility-off.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-properties.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-layers.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-properties.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-show-menu.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-hand.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-select.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-shapes.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-undo.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-redo.js';

const TOP_NAVBAR_HEIGHT = 48;

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
  appState: AppState = getDefaultAppState();

  @property({ type: Array })
  nodes: SerializedNode[] = [];

  #appStateProvider = new ContextProvider(this, { context: appStateContext });
  #nodesProvider = new ContextProvider(this, { context: nodesContext });
  #apiProvider = new ContextProvider(this, { context: apiContext });

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

    this.#apiProvider.value?.destroy();
  }

  private handleResize(entries: ResizeObserverEntry[]) {
    const { width, height } = entries[0].contentRect;
    const dpr = window.devicePixelRatio;

    if (width && height) {
      const $canvas = this.shadowRoot?.querySelector('canvas');
      $canvas.width = width * dpr;
      $canvas.height = (height - TOP_NAVBAR_HEIGHT) * dpr;

      this.#apiProvider.value?.resizeCanvas(width, height - TOP_NAVBAR_HEIGHT);
    }
  }

  private initCanvas = new Task(this, {
    task: async ([renderer, shaderCompilerPath]) => {
      if (renderer === 'webgpu') {
        await checkWebGPUSupport();
      }

      this.#appStateProvider.setValue(this.appState);

      /**
       * Update context values
       */
      this.addEventListener(Event.READY, (e: CustomEvent) => {
        e.detail.getAppState = () => this.#appStateProvider.value;
        e.detail.setAppState = (appState: AppState) =>
          this.#appStateProvider.setValue(appState);
        e.detail.getNodes = () => this.#nodesProvider.value;
        e.detail.setNodes = (nodes: SerializedNode[]) =>
          this.#nodesProvider.setValue(nodes);
        this.#apiProvider.setValue(e.detail);
      });

      this.addEventListener(Event.ZOOM_CHANGED, (e: CustomEvent) => {
        this.#appStateProvider.setValue({
          ...this.#appStateProvider.value,
          cameraZoom: e.detail.zoom,
        });
      });

      const $canvas = document.createElement('canvas');
      $canvas.style.width = '100%';
      $canvas.style.height = 'calc(100% - 48px)';
      $canvas.tabIndex = 0; // Make canvas focusable

      const { width, height } = this.getBoundingClientRect();
      const { cameraZoom } = this.appState;

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
          zoom: cameraZoom,
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
