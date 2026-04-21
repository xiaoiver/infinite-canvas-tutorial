import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import {
  SerializedNode,
  Task,
  AppState,
  API,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { localized, msg, str } from '@lit/localize';
import './document-theme-settings';

const PANEL_HEIGHT_STORAGE_KEY = 'ic-spectrum-properties-panel-body-height';
const DEFAULT_PANEL_BODY_HEIGHT = 400;
const MIN_PANEL_BODY_HEIGHT = 120;
const MAX_PANEL_BODY_HEIGHT = 900;
/** 无选中时内容为空，仍需保持侧栏可读宽度；后续可放画布背景、全局 token 等 */
const MIN_PANEL_WIDTH_PX = 260;

@customElement('ic-spectrum-properties-panel')
@localized()
export class PropertiesPanel extends LitElement {
  static styles = css`
    section {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      min-width: ${MIN_PANEL_WIDTH_PX}px;
      min-height: 0;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    h4 {
      padding: var(--spectrum-global-dimension-size-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
      color: canvastext;
    }

    .container {
      padding: var(--spectrum-global-dimension-size-100);
      padding-top: 0;
    }

    .panel-body {
      box-sizing: border-box;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .document-settings-placeholder {
      box-sizing: border-box;
      overflow: hidden auto;
      color: var(--spectrum-gray-800);
      font-size: var(--spectrum-font-size-75);
      line-height: 1.45;
    }

    ic-spectrum-document-theme-settings {
      display: block;
      min-height: 0;
    }

    .resize-handle {
      flex-shrink: 0;
      height: 10px;
      margin: 0 4px 2px;
      cursor: ns-resize;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--spectrum-corner-radius-100);
    }

    .resize-handle:hover,
    .resize-handle:focus-visible {
      background: var(--spectrum-gray-300);
    }

    .resize-handle::after {
      content: '';
      width: 36px;
      height: 3px;
      border-radius: 2px;
      background: var(--spectrum-gray-500);
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: nodesContext, subscribe: true })
  nodes: SerializedNode[];

  @consume({ context: apiContext, subscribe: true })
  api: API;

  @state()
  private panelBodyHeight = DEFAULT_PANEL_BODY_HEIGHT;

  private resizePointerId: number | null = null;

  private resizeStartY = 0;

  private resizeStartHeight = 0;

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof localStorage === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(PANEL_HEIGHT_STORAGE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n)) {
        this.panelBodyHeight = this.clampPanelHeight(n);
      }
    }
  }

  private clampPanelHeight(h: number): number {
    const max = Math.min(
      MAX_PANEL_BODY_HEIGHT,
      typeof window !== 'undefined'
        ? Math.floor(window.innerHeight * 0.85)
        : MAX_PANEL_BODY_HEIGHT,
    );
    return Math.min(max, Math.max(MIN_PANEL_BODY_HEIGHT, Math.round(h)));
  }

  private handleResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    this.resizePointerId = e.pointerId;
    this.resizeStartY = e.clientY;
    this.resizeStartHeight = this.panelBodyHeight;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private handleResizePointerMove(e: PointerEvent) {
    if (this.resizePointerId !== e.pointerId) {
      return;
    }
    const dy = e.clientY - this.resizeStartY;
    const next = this.clampPanelHeight(this.resizeStartHeight + dy);
    if (next !== this.panelBodyHeight) {
      this.panelBodyHeight = next;
    }
  }

  private endResize(e: PointerEvent) {
    if (this.resizePointerId !== e.pointerId) {
      return;
    }
    this.resizePointerId = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        PANEL_HEIGHT_STORAGE_KEY,
        String(this.panelBodyHeight),
      );
    }
  }

  private handleClose() {
    this.api.setAppState({
      taskbarSelected: this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_PROPERTIES_PANEL,
      ),
    });
  }

  private renderResizeHandle() {
    return html`<div
      class="resize-handle"
      tabindex="0"
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow=${this.panelBodyHeight}
      aria-valuemin=${MIN_PANEL_BODY_HEIGHT}
      aria-valuemax=${MAX_PANEL_BODY_HEIGHT}
      @pointerdown=${this.handleResizePointerDown}
      @pointermove=${this.handleResizePointerMove}
      @pointerup=${this.endResize}
      @pointercancel=${this.endResize}
    ></div>`;
  }

  /** 未选中或选中 id 无效时：画布级设置（主题色等） */
  private renderDocumentSettingsPlaceholder() {
    return html`
      <div
        class="panel-body document-settings-placeholder"
        style=${`height:${this.panelBodyHeight}px`}
      >
        <ic-spectrum-document-theme-settings></ic-spectrum-document-theme-settings>
      </div>
      ${this.renderResizeHandle()}
    `;
  }

  render() {
    const { layersSelected, taskbarSelected } = this.appState;
    const enabled = taskbarSelected.includes(Task.SHOW_PROPERTIES_PANEL);

    if (!enabled) {
      return null;
    }

    if (layersSelected.length > 1) {
      return html`<section>
        <h4>
          ${msg(str`Properties`)}
          <sp-action-button quiet size="s" @click=${this.handleClose}>
            <sp-icon-close slot="icon"></sp-icon-close>
          </sp-action-button>
        </h4>
        <div
          class="panel-body container"
          style=${`height:${this.panelBodyHeight}px`}
        >
          ${layersSelected.length} selected
        </div>
        ${this.renderResizeHandle()}
      </section>`;
    }

    const node =
      layersSelected.length === 1
        ? this.api?.getNodeById(layersSelected[0])
        : undefined;

    if (!node) {
      return html`<section>
        <h4>
          ${msg(str`Properties`)}
          <sp-action-button quiet size="s" @click=${this.handleClose}>
            <sp-icon-close slot="icon"></sp-icon-close>
          </sp-action-button>
        </h4>
        ${this.renderDocumentSettingsPlaceholder()}
      </section>`;
    }

    return html`<section>
      <h4>
        ${msg(str`Properties`)}
        <sp-action-button quiet size="s" @click=${this.handleClose}>
          <sp-icon-close slot="icon"></sp-icon-close>
        </sp-action-button>
      </h4>
      <div
        class="panel-body"
        style=${`height:${this.panelBodyHeight}px`}
      >
        <ic-spectrum-properties-panel-content
          class="fills-panel"
          .node=${node}
        ></ic-spectrum-properties-panel-content>
      </div>
      ${this.renderResizeHandle()}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-properties-panel': PropertiesPanel;
  }
}
