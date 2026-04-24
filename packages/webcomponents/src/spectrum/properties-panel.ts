import { html, css, LitElement, nothing, type TemplateResult } from 'lit';
import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import { NodeAlignment, SerializedNode, Task, AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { type ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-align-bottom.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-align-center.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-align-left.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-align-middle.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-align-right.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-align-top.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-distribute-space-horiz.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-distribute-space-vert.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import './document-theme-settings';
import './effects-panel';
import './export-panel';
import '@spectrum-web-components/accordion/sp-accordion.js';
import '@spectrum-web-components/accordion/sp-accordion-item.js';

const PANEL_HEIGHT_STORAGE_KEY = 'ic-spectrum-properties-panel-body-height';
const PANEL_WIDTH_STORAGE_KEY = 'ic-spectrum-properties-panel-width';
const DEFAULT_PANEL_BODY_HEIGHT = 400;
const DEFAULT_PANEL_WIDTH_PX = 320;
const MIN_PANEL_BODY_HEIGHT = 120;
const MAX_PANEL_BODY_HEIGHT = 900;
/** 无选中时内容为空，仍需保持侧栏可读宽度；后续可放画布背景、全局 token 等 */
const MIN_PANEL_WIDTH_PX = 260;
const MAX_PANEL_WIDTH_PX = 720;

@customElement('ic-spectrum-properties-panel')
@localized()
export class PropertiesPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 100%;
    }

    .panel-root {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      box-sizing: border-box;
      min-width: ${MIN_PANEL_WIDTH_PX}px;
      max-width: 100%;
    }

    .width-resize-handle {
      flex-shrink: 0;
      width: 10px;
      margin: 4px 0 4px 0;
      cursor: ew-resize;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--spectrum-corner-radius-100);
    }

    .width-resize-handle:hover,
    .width-resize-handle:focus-visible {
      background: var(--spectrum-gray-300);
    }

    .width-resize-handle::after {
      content: '';
      width: 3px;
      height: 36px;
      border-radius: 2px;
      background: var(--spectrum-gray-500);
    }

    section {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
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

    .multi-select-hint {
      margin: 0 0 var(--spectrum-global-dimension-size-100) 0;
      padding: 0 var(--spectrum-global-dimension-size-100);
      color: var(--spectrum-gray-800);
      font-size: var(--spectrum-font-size-75);
    }

    .align-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spectrum-global-dimension-size-50);
      align-items: center;
    }

    .multi-select-accordion {
      flex: 1 1 auto;
      min-height: 0;
      --system-accordion-size-s-item-header-font-size: 14px;
      --mod-accordion-item-header-font-size: 14px;
    }

    .multi-select-accordion .content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
    }

    .multi-select-accordion .effects-hint {
      margin: 0 0 var(--spectrum-global-dimension-size-50) 0;
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
  api: ExtendedAPI;

  @state()
  private panelBodyHeight = DEFAULT_PANEL_BODY_HEIGHT;

  @state()
  private panelWidth = DEFAULT_PANEL_WIDTH_PX;

  private resizePointerId: number | null = null;

  private resizeStartY = 0;

  private resizeStartHeight = 0;

  private widthResizePointerId: number | null = null;

  private widthResizeStartX = 0;

  private widthResizeStartW = 0;

  private get multiSelectSectionsOpenResolved(): {
    alignment: boolean;
    effects: boolean;
  } {
    const s = this.appState.propertiesPanelSectionsOpen as AppState['propertiesPanelSectionsOpen'] & {
      multiSelectAlignment?: boolean;
      multiSelectEffects?: boolean;
    };
    return {
      alignment: s.multiSelectAlignment ?? true,
      effects: s.multiSelectEffects ?? true,
    };
  }

  private get exportSectionOpenResolved(): boolean {
    const s = this.appState.propertiesPanelSectionsOpen as AppState['propertiesPanelSectionsOpen'] & {
      exportSection?: boolean;
    };
    return s.exportSection ?? true;
  }

  private renderExportAccordionItem(accordionItemSlot?: string) {
    return html`
      <sp-accordion-item
        label=${msg(str`Export`)}
        ?open=${this.exportSectionOpenResolved}
        slot=${accordionItemSlot ?? nothing}
      >
        <div class="content">
          <ic-spectrum-export-panel></ic-spectrum-export-panel>
        </div>
      </sp-accordion-item>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof localStorage === 'undefined') {
      return;
    }
    const storedH = localStorage.getItem(PANEL_HEIGHT_STORAGE_KEY);
    if (storedH) {
      const n = parseInt(storedH, 10);
      if (!Number.isNaN(n)) {
        this.panelBodyHeight = this.clampPanelHeight(n);
      }
    }
    const storedW = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (storedW) {
      const n = parseInt(storedW, 10);
      if (!Number.isNaN(n)) {
        this.panelWidth = this.clampPanelWidth(n);
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

  private clampPanelWidth(w: number): number {
    const max = Math.min(
      MAX_PANEL_WIDTH_PX,
      typeof window !== 'undefined'
        ? Math.max(
          MIN_PANEL_WIDTH_PX,
          Math.floor(window.innerWidth - 80),
        )
        : MAX_PANEL_WIDTH_PX,
    );
    return Math.min(max, Math.max(MIN_PANEL_WIDTH_PX, Math.round(w)));
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

  private handleWidthResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    this.widthResizePointerId = e.pointerId;
    this.widthResizeStartX = e.clientX;
    this.widthResizeStartW = this.panelWidth;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private handleWidthResizePointerMove(e: PointerEvent) {
    if (this.widthResizePointerId !== e.pointerId) {
      return;
    }
    const dx = e.clientX - this.widthResizeStartX;
    // 向左拖（dx<0）加宽
    const next = this.clampPanelWidth(this.widthResizeStartW - dx);
    if (next !== this.panelWidth) {
      this.panelWidth = next;
    }
  }

  private endWidthResize(e: PointerEvent) {
    if (this.widthResizePointerId !== e.pointerId) {
      return;
    }
    this.widthResizePointerId = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(this.panelWidth));
    }
  }

  private handleClose() {
    this.api.setAppState({
      taskbarSelected: this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_PROPERTIES_PANEL,
      ),
    });
  }

  private handleAlign(alignment: NodeAlignment) {
    this.api?.alignSelectedNodes(alignment);
  }

  private handleDistributeSpacing(axis: 'horizontal' | 'vertical') {
    this.api?.distributeSelectedNodesSpacing(axis);
  }

  private renderWidthResizeHandle() {
    return html`<div
      class="width-resize-handle"
      tabindex="0"
      role="separator"
      aria-orientation="vertical"
      aria-label=${msg(str`Resize panel width`)}
      aria-valuenow=${this.panelWidth}
      aria-valuemin=${MIN_PANEL_WIDTH_PX}
      aria-valuemax=${this.maxPanelWidthResolved}
      @pointerdown=${this.handleWidthResizePointerDown}
      @pointermove=${this.handleWidthResizePointerMove}
      @pointerup=${this.endWidthResize}
      @pointercancel=${this.endWidthResize}
    ></div>`;
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

  private get maxPanelWidthResolved(): number {
    return typeof window !== 'undefined'
      ? Math.max(
        MIN_PANEL_WIDTH_PX,
        Math.min(MAX_PANEL_WIDTH_PX, window.innerWidth - 80),
      )
      : MAX_PANEL_WIDTH_PX;
  }

  private renderPanelRoot(inner: TemplateResult) {
    return html`
      <div
        class="panel-root"
        style=${`width: ${this.panelWidth}px; max-width: 100%;`}
      >
        ${this.renderWidthResizeHandle()}
        ${inner}
      </div>
    `;
  }

  /** 未选中或选中 id 无效时：画布级设置（主题色等） */
  private renderDocumentSettingsPlaceholder() {
    return html`
      <div
        class="panel-body"
        style=${`height:${this.panelBodyHeight}px; overflow: auto;`}
      >
        <ic-spectrum-document-theme-settings>
          ${this.renderExportAccordionItem('extra-accordion-items')}
        </ic-spectrum-document-theme-settings>
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
      const selectedNodes = layersSelected
        .map((id) => this.api?.getNodeById(id))
        .filter((n): n is SerializedNode => n != null);
      const firstNode = selectedNodes[0];
      const filterWire = (n: SerializedNode) =>
        (n as { filter?: string }).filter ?? '';
      const allIdsResolved = selectedNodes.length === layersSelected.length;
      const firstF =
        selectedNodes.length > 0 ? filterWire(selectedNodes[0]) : '';
      const filtersMatch =
        allIdsResolved &&
        selectedNodes.length > 0 &&
        selectedNodes.every((n) => filterWire(n) === firstF);
      const filtersMixed = !filtersMatch;
      return this.renderPanelRoot(html`<section>
        <h4>
          ${msg(str`Properties`)}
          <sp-action-button quiet size="s" @click=${this.handleClose}>
            <sp-icon-close slot="icon"></sp-icon-close>
          </sp-action-button>
        </h4>
        <div
          class="panel-body"
          style=${`height:${this.panelBodyHeight}px; overflow: auto;`}
        >
          <p class="multi-select-hint">
            ${layersSelected.length}
            ${msg(str` selected`)}
          </p>
          <sp-accordion
            class="multi-select-accordion"
            allow-multiple
            size="s"
          >
            <sp-accordion-item
              label=${msg(str`Alignment`)}
              ?open=${this.multiSelectSectionsOpenResolved.alignment}
            >
              <div class="content">
                <div
                  class="align-toolbar"
                  role="toolbar"
                  aria-label=${msg(str`Alignment`)}
                >
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() => this.handleAlign('left')}
                    label=${msg(str`Align left`)}
                  >
                    <sp-icon-align-left slot="icon"></sp-icon-align-left>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Align left`)}
                    </sp-tooltip>
                  </sp-action-button>
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() => this.handleAlign('centerH')}
                    label=${msg(str`Align center horizontally`)}
                  >
                    <sp-icon-align-center slot="icon"></sp-icon-align-center>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Align center horizontally`)}
                    </sp-tooltip>
                  </sp-action-button>
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() => this.handleAlign('right')}
                    label=${msg(str`Align right`)}
                  >
                    <sp-icon-align-right slot="icon"></sp-icon-align-right>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Align right`)}
                    </sp-tooltip>
                  </sp-action-button>
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() => this.handleAlign('top')}
                    label=${msg(str`Align top`)}
                  >
                    <sp-icon-align-top slot="icon"></sp-icon-align-top>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Align top`)}
                    </sp-tooltip>
                  </sp-action-button>
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() => this.handleAlign('centerV')}
                    label=${msg(str`Align middle vertically`)}
                  >
                    <sp-icon-align-middle
                      slot="icon"
                    ></sp-icon-align-middle>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Align middle vertically`)}
                    </sp-tooltip>
                  </sp-action-button>
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() => this.handleAlign('bottom')}
                    label=${msg(str`Align bottom`)}
                  >
                    <sp-icon-align-bottom
                      slot="icon"
                    ></sp-icon-align-bottom>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Align bottom`)}
                    </sp-tooltip>
                  </sp-action-button>
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() =>
          this.handleDistributeSpacing('horizontal')}
                    label=${msg(str`Distribute horizontal spacing`)}
                  >
                    <sp-icon-distribute-space-horiz
                      slot="icon"
                    ></sp-icon-distribute-space-horiz>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Distribute horizontal spacing`)}
                    </sp-tooltip>
                  </sp-action-button>
                  <sp-action-button
                    quiet
                    size="s"
                    @click=${() =>
          this.handleDistributeSpacing('vertical')}
                    label=${msg(str`Distribute vertical spacing`)}
                  >
                    <sp-icon-distribute-space-vert
                      slot="icon"
                    ></sp-icon-distribute-space-vert>
                    <sp-tooltip self-managed placement="bottom">
                      ${msg(str`Distribute vertical spacing`)}
                    </sp-tooltip>
                  </sp-action-button>
                </div>
              </div>
            </sp-accordion-item>
            ${firstNode
          ? html`
                  <sp-accordion-item
                    label=${msg(str`Effects`)}
                    ?open=${this.multiSelectSectionsOpenResolved.effects}
                  >
                    <div class="content">
                      <p class="multi-select-hint effects-hint">
                        ${filtersMatch
              ? msg(str`Edits apply to all selected items.`)
              : msg(
                str`Selected items have different filters. Nothing is listed; add a filter to set the same chain for all.`,
              )}
                      </p>
                      <ic-spectrum-effects-panel
                        .node=${firstNode}
                        .targetNodeIds=${layersSelected}
                        .filtersMixed=${filtersMixed}
                      ></ic-spectrum-effects-panel>
                    </div>
                  </sp-accordion-item>
                `
          : null}
            ${this.renderExportAccordionItem()}
          </sp-accordion>
        </div>
        ${this.renderResizeHandle()}
      </section>`);
    }

    const node =
      layersSelected.length === 1
        ? this.api?.getNodeById(layersSelected[0])
        : undefined;

    if (!node) {
      return this.renderPanelRoot(html`<section>
        <h4>
          ${msg(str`Properties`)}
          <sp-action-button quiet size="s" @click=${this.handleClose}>
            <sp-icon-close slot="icon"></sp-icon-close>
          </sp-action-button>
        </h4>
        ${this.renderDocumentSettingsPlaceholder()}
      </section>`);
    }

    return this.renderPanelRoot(html`<section>
      <h4>
        ${msg(str`Properties`)}
        <sp-action-button quiet size="s" @click=${this.handleClose}>
          <sp-icon-close slot="icon"></sp-icon-close>
        </sp-action-button>
      </h4>
      <div
        class="panel-body"
        style=${`height:${this.panelBodyHeight}px; overflow: auto;`}
      >
        <ic-spectrum-properties-panel-content
          class="fills-panel"
          .node=${node}
        ></ic-spectrum-properties-panel-content>
      </div>
      ${this.renderResizeHandle()}
    </section>`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-properties-panel': PropertiesPanel;
  }
}
