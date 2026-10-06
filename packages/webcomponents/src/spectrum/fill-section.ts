import { html, css, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { live } from 'lit/directives/live.js';
import {
  AppState,
  resolveDesignVariableValue,
  SerializedNode,
  type SerializedFillLayerItem,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import type { ColorPickerChangeDetail } from './color-picker.js';
import { editPaint, paintLayers } from './paint-command';
import './color-picker.js';
import './fill-icon.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-add.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-remove.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility-off.js';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function layerOpacity01(o?: number | string): number {
  if (o == null || o === '') {
    return 1;
  }
  if (typeof o === 'string') {
    const t = o.trim();
    if (t.startsWith('$')) {
      return 1;
    }
    const n = parseFloat(t);
    return Number.isFinite(n) ? clamp01(n) : 1;
  }
  if (Number.isNaN(o)) {
    return 1;
  }
  return clamp01(o);
}

@customElement('ic-spectrum-fill-section')
@localized()
export class FillSection extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spectrum-global-dimension-size-100);
    }

    .title {
      font-size: var(--spectrum-font-size-100);
      font-weight: var(--spectrum-bold-font-weight);
      color: var(--spectrum-gray-800);
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1 1 auto;
      min-width: 0;
      padding: 4px;
      border-radius: var(--spectrum-corner-radius-100);
      background: var(--spectrum-gray-200);
      border: 1px solid var(--spectrum-gray-300);
    }

    .pill.layer-off {
      opacity: 0.55;
    }

    .swatch {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: 4px;
      overflow: hidden;
    }

    .swatch ic-spectrum-fill-icon {
      width: 22px;
      height: 22px;
      display: block;
    }

    .value-input {
      flex: 1 1 auto;
      min-width: 0;
    }

    .opacity-wrap {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .opacity-field {
      width: 56px;
    }

    .row-actions {
      display: flex;
      flex-shrink: 0;
      gap: 0;
    }

    .add-layer-cta {
      margin-top: 4px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    /* 与 fill-action-button / stroke-content 一致：默认 dialog popover 内边距过大易挡住取色按钮点击 */
    sp-popover {
      padding: 0;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState!: AppState;

  @consume({ context: apiContext, subscribe: true })
  api!: ExtendedAPI;

  @property({ type: Object })
  node!: SerializedNode;

  /** 与同引用 `node` 解耦，保证删 `fills` 等就地 mutate 后仍调度渲染 */
  @state()
  private fillPanelEpoch = 0;

  private commit(
    command: Parameters<typeof editPaint>[3],
    layer?: SerializedFillLayerItem,
  ) {
    const api = this.api;
    const id = this.node?.id;
    void editPaint(
      api,
      id,
      'fills',
      command,
      { type: 'solid', value: '#CCCCCC', opacity: 1 },
      layer,
    ).then(() => {
      if (this.isConnected && this.api === api && this.node?.id === id)
        this.fillPanelEpoch += 1;
    });
  }

  private fillsWireArray(): SerializedFillLayerItem[] {
    return paintLayers(this.node, 'fills');
  }

  private fillPickerUsesOpacityUi(index: number): boolean {
    return this.fillsWireArray().length === 1 && index === 0;
  }

  private layerOpacityResolved01(layer: SerializedFillLayerItem): number {
    const raw = layer.opacity ?? 1;
    const r = resolveDesignVariableValue(
      raw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const n = typeof r === 'number' ? r : parseFloat(String(r ?? ''));
    return layerOpacity01(Number.isFinite(n) ? n : 1);
  }

  private displayValueForLayer(layer: SerializedFillLayerItem): string {
    return layer.value;
  }

  private swatchValue(layer: SerializedFillLayerItem): string {
    const v = this.displayValueForLayer(layer);
    return String(
      resolveDesignVariableValue(
        v,
        this.appState.variables,
        this.appState.themeMode,
      ),
    );
  }

  private handleAdd() {
    this.commit({
      kind: 'add',
      layer: { type: 'solid', value: '#CCCCCC', opacity: 1 },
    });
  }

  private handleRemove(layer: SerializedFillLayerItem) {
    this.commit({ kind: 'remove' }, layer);
  }

  private handleToggleLayer(layer: SerializedFillLayerItem) {
    this.commit({ kind: 'toggle' }, layer);
  }

  private handleValueChange(layer: SerializedFillLayerItem, e: Event) {
    const value = String((e.target as HTMLElement & { value: string }).value);
    this.commit({ kind: 'value', value }, layer);
  }

  private handlePickerColorChange(
    layer: SerializedFillLayerItem,
    e: CustomEvent<ColorPickerChangeDetail>,
  ) {
    this.commit({ ...e.detail, kind: 'color' }, layer);
  }

  private handlePickerOpacityChange(
    layer: SerializedFillLayerItem,
    e: CustomEvent<{ fillOpacity?: number }>,
  ) {
    const value = e.detail.fillOpacity;
    if (value !== undefined) this.commit({ kind: 'opacity', value }, layer);
  }

  private handlePickerOpacityVariablePick(
    layer: SerializedFillLayerItem,
    e: CustomEvent<{ mode: 'fill' | 'stroke'; key: string }>,
  ) {
    if (e.detail.mode === 'fill')
      this.commit({ kind: 'bind', field: 'opacity', key: e.detail.key }, layer);
  }

  private handlePickerOpacityVariableUnbind(
    layer: SerializedFillLayerItem,
    e: CustomEvent<{ mode: 'fill' | 'stroke' }>,
  ) {
    if (e.detail.mode === 'fill')
      this.commit({ kind: 'unbind', field: 'opacity' }, layer);
  }

  private renderColorSwatchPicker(
    layer: SerializedFillLayerItem,
    index: number,
  ): TemplateResult {
    const safeId = this.node.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const suffix = `i${index}`;
    const triggerId = `ic-fill-swatch-${safeId}-${suffix}`;
    const pickerValue = this.swatchValue(layer);
    return html`
      <sp-action-button
        quiet
        size="s"
        class="swatch-btn"
        id=${triggerId}
        label=${msg(str`Edit fill color`)}
      >
        <div class="swatch" slot="icon">
          <ic-spectrum-fill-icon
            .value=${pickerValue}
            .node=${this.node}
          ></ic-spectrum-fill-icon>
        </div>
        <sp-tooltip self-managed placement="bottom">
          ${msg(str`Edit color`)}
        </sp-tooltip>
      </sp-action-button>
      <sp-overlay
        trigger=${`${triggerId}@click`}
        placement="bottom"
        type="auto"
      >
        <sp-popover dialog>
          ${this.fillPickerUsesOpacityUi(index)
        ? html`<ic-spectrum-color-picker
               .value=${pickerValue}
                .fillOpacity=${layer.opacity ?? 1}
                .objectFit=${layer.type === 'image'
          ? (layer.objectFit ?? 'fill')
          : 'fill'}
                .objectPosition=${layer.type === 'image'
          ? (layer.objectPosition ?? '')
          : ''}
                enable-opacity-variable-binding
                @color-change=${(e: CustomEvent<ColorPickerChangeDetail>) =>
            this.handlePickerColorChange(layer, e)}
                @opacity-change=${(e: CustomEvent<{ fillOpacity?: number }>) => this.handlePickerOpacityChange(layer, e)}
                @opacity-variable-pick=${(e: CustomEvent<{ mode: 'fill' | 'stroke'; key: string }>) => this.handlePickerOpacityVariablePick(layer, e)}
                @opacity-variable-unbind=${(e: CustomEvent<{ mode: 'fill' | 'stroke' }>) => this.handlePickerOpacityVariableUnbind(layer, e)}
              ></ic-spectrum-color-picker>`
        : html`<ic-spectrum-color-picker
               .value=${pickerValue}
                .objectFit=${layer.type === 'image'
          ? (layer.objectFit ?? 'fill')
          : 'fill'}
                .objectPosition=${layer.type === 'image'
          ? (layer.objectPosition ?? '')
          : ''}
                @color-change=${(e: CustomEvent<ColorPickerChangeDetail>) =>
            this.handlePickerColorChange(layer, e)}
              ></ic-spectrum-color-picker>`}
        </sp-popover>
      </sp-overlay>
    `;
  }

  private handleOpacityChange(layer: SerializedFillLayerItem, e: Event) {
    const raw = String(
      (e.target as HTMLElement & { value: string | number }).value,
    ).trim();
    const value = raw ? Number(raw) / 100 : NaN;
    this.commit({ kind: 'opacity', value }, layer);
  }

  private renderEye(layer: SerializedFillLayerItem) {
    const visible = layer.enabled !== false;
    return html`
      <sp-action-button
        quiet
        size="s"
        class="row-actions"
        label=${visible
        ? msg(str`Hide fill layer`)
        : msg(str`Show fill layer`)}
        @click=${() => this.handleToggleLayer(layer)}
      >
        ${visible
        ? html`<sp-icon-visibility slot="icon"></sp-icon-visibility>`
        : html`<sp-icon-visibility-off slot="icon"></sp-icon-visibility-off>`}
        <sp-tooltip self-managed placement="bottom">
          ${visible ? msg(str`Hide`) : msg(str`Show`)}
        </sp-tooltip>
      </sp-action-button>
    `;
  }

  private renderLayerRow(
    layer: SerializedFillLayerItem,
    index: number,
  ) {
    const pct = this.layerOpacityResolved01(layer) * 100;
    const pillClass = layer.enabled === false ? 'pill layer-off' : 'pill';

    return html`
      <div class="row">
        <div class=${pillClass}>
          ${this.renderColorSwatchPicker(layer, index)}
          <sp-textfield
            class="value-input"
            size="s"
            .value=${live(this.displayValueForLayer(layer))}
            @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleValueChange(layer, e)}
          ></sp-textfield>
          <div class="opacity-wrap">
            <sp-number-field
              class="opacity-field"
              size="s"
              .value=${live(pct)}
              @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleOpacityChange(layer, e)}
              hide-stepper
              autocomplete="off"
              format-options='{
                  "style": "unit",
                  "unit": "%"
                }'
            ></sp-number-field>
          </div>
        </div>
        ${this.renderEye(layer)}
        <sp-action-button
          quiet
          size="s"
          label=${msg(str`Remove fill layer`)}
          @click=${() => this.handleRemove(layer)}
        >
          <sp-icon-remove slot="icon"></sp-icon-remove>
          <sp-tooltip self-managed placement="bottom">
            ${msg(str`Remove`)}
          </sp-tooltip>
        </sp-action-button>
      </div>
    `;
  }

  render() {
    if (!this.node) {
      return html``;
    }
    // 依赖 fillPanelEpoch，避免仅 mutate node 同引用时 Lit 合并掉更新
    void this.fillPanelEpoch;

    const header = html`
      <sp-action-button
        class="add-layer-cta"
        size="s"
        @click=${this.handleAdd}
      >
        ${msg(str`Add fill layer`)}
      </sp-action-button>
    `;

    return html`
      <div class="rows">
        ${this.fillsWireArray().map((layer, i) => this.renderLayerRow(layer, i))}
      </div>
      ${header}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-fill-section': FillSection;
  }
}
