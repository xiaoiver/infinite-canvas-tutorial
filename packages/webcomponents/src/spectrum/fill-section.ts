import { html, css, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  FillAttributes,
  isGradient,
  resolveDesignVariableValue,
  SerializedNode,
  type SerializedFillLayerItem,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import { normalizeSolidCssValue } from './normalize-solid-css';
import {
  ColorType,
  type ColorPickerChangeDetail,
} from './color-picker.js';
import './color-picker.js';
import './fill-icon.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-add.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-remove.js';

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
      gap: 6px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1 1 auto;
      min-width: 0;
      padding: 4px 8px;
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

    .swatch-btn {
      flex-shrink: 0;
      padding: 0;
      min-width: 0;
    }

    .swatch-btn .swatch {
      pointer-events: none;
    }

    .value-input {
      flex: 1 1 auto;
      min-width: 0;
    }

    .opacity-wrap {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      padding-left: 6px;
      border-left: 1px solid var(--spectrum-gray-400);
      margin-left: 2px;
    }

    .opacity-field {
      width: 48px;
    }

    .opacity-suffix {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-gray-700);
      white-space: nowrap;
    }

    .row-actions {
      display: flex;
      flex-shrink: 0;
      gap: 0;
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

  private commit(patch: Partial<SerializedNode>) {
    this.api.updateNode(this.node, patch as Partial<SerializedNode>);
    this.api.record();
    const p = patch as Partial<FillAttributes>;
    if (
      Object.prototype.hasOwnProperty.call(p, 'fills') &&
      p.fills === undefined
    ) {
      delete (this.node as FillAttributes).fills;
    }
    this.fillPanelEpoch += 1;
  }

  private getMultiLayers(): SerializedFillLayerItem[] | null {
    const fl = (this.node as FillAttributes).fills;
    return Array.isArray(fl) && fl.length >= 2 ? fl : null;
  }

  /** 单层编辑用的当前层（无 `fills` 时给默认，首次写入时再 `commit`） */
  private singleLayerFromNode(): SerializedFillLayerItem {
    const fl = (this.node as FillAttributes).fills;
    if (Array.isArray(fl) && fl.length >= 1) {
      return { ...fl[0]! };
    }
    return { type: 'solid', value: '#000000', opacity: 1 };
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
    if (layer.type === 'gradient') {
      return layer.value;
    }
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
    const multi = this.getMultiLayers();
    const defaultLayer: SerializedFillLayerItem = {
      type: 'solid',
      value: '#CCCCCC',
      opacity: 1,
    };
    if (multi) {
      const next = [...multi, defaultLayer];
      this.commit({ fills: next });
      return;
    }
    const base = this.singleLayerFromNode();
    const resolved = String(
      resolveDesignVariableValue(
        base.value,
        this.appState.variables,
        this.appState.themeMode,
      ),
    );
    const normalized =
      base.type === 'gradient' || isGradient(resolved)
        ? ({ ...base, type: 'gradient' as const, value: resolved } as SerializedFillLayerItem)
        : base.type === 'image'
          ? ({ ...base, type: 'image' as const, value: resolved } as SerializedFillLayerItem)
          : ({
              ...base,
              type: 'solid' as const,
              value: normalizeSolidCssValue(base.value),
            } as SerializedFillLayerItem);
    const next = [normalized, defaultLayer];
    this.commit({ fills: next });
  }

  private handleRemove(index: number) {
    const multi = this.getMultiLayers();
    if (!multi) {
      return;
    }
    if (multi.length <= 2) {
      const remaining = multi[index === 0 ? 1 : 0]!;
      this.commit({
        fills: [{ ...remaining }],
      });
      return;
    }
    const next = multi.filter((_, i) => i !== index);
    this.commit({ fills: next });
  }

  private handleToggleLayer(index: number) {
    const multi = this.getMultiLayers();
    if (!multi) {
      return;
    }
    const cur = multi[index];
    if (!cur) {
      return;
    }
    const visible = cur.enabled !== false;
    const next = multi.map((L, i) =>
      i === index ? { ...L, enabled: visible ? false : true } : L,
    );
    this.commit({ fills: next });
  }

  private handleValueChange(
    index: number | null,
    e: CustomEvent<{ value: string }>,
  ) {
    const raw = String((e.target as unknown as { value: string }).value).trim();
    const multi = this.getMultiLayers();
    if (multi && index != null) {
      const L = multi[index];
      if (!L) {
        return;
      }
      let nextLayer: SerializedFillLayerItem;
      if (L.type === 'gradient' || L.type === 'image') {
        nextLayer = { ...L, value: raw };
      } else {
        nextLayer = { ...L, value: normalizeSolidCssValue(raw) };
      }
      const next = multi.map((x, i) => (i === index ? nextLayer : x));
      this.commit({ fills: next });
      return;
    }
    const base = this.singleLayerFromNode();
    let nextLayer: SerializedFillLayerItem;
    if (isGradient(raw)) {
      nextLayer = { ...base, type: 'gradient', value: raw };
    } else {
      nextLayer = {
        ...base,
        type: 'solid',
        value: normalizeSolidCssValue(raw),
      };
    }
    this.commit({ fills: [nextLayer] });
  }

  private handlePickerColorChange(
    index: number | null,
    e: CustomEvent<ColorPickerChangeDetail>,
  ) {
    const { type, value, fillOpacity: pickFillOpacity } = e.detail;
    let layerType: 'solid' | 'gradient' | 'image';
    let wireValue: string;
    if (type === ColorType.Gradient) {
      layerType = 'gradient';
      wireValue = value;
    } else if (type === ColorType.Image) {
      layerType = 'image';
      wireValue = value;
    } else if (type === ColorType.Solid) {
      layerType = 'solid';
      wireValue = normalizeSolidCssValue(value);
    } else if (type === ColorType.None) {
      layerType = 'solid';
      wireValue = 'none';
    } else {
      layerType = 'solid';
      wireValue = value;
    }

    const multi = this.getMultiLayers();

    if (multi && index != null) {
      const next = multi.map((L, i) => {
        if (i !== index) {
          return L;
        }
        if (layerType === 'gradient') {
          return { ...L, type: 'gradient' as const, value: wireValue };
        }
        if (layerType === 'image') {
          return { ...L, type: 'image' as const, value: wireValue };
        }
        return { ...L, type: 'solid' as const, value: wireValue };
      });

      this.commit({ fills: next });
      return;
    }

    const base = this.singleLayerFromNode();
    const next0: SerializedFillLayerItem =
      layerType === 'gradient'
        ? { ...base, type: 'gradient', value: wireValue }
        : layerType === 'image'
          ? { ...base, type: 'image', value: wireValue }
          : { ...base, type: 'solid', value: wireValue };
    if (
      pickFillOpacity !== undefined &&
      index == null &&
      !multi
    ) {
      next0.opacity = pickFillOpacity;
    }
    this.commit({ fills: [next0] });
  }

  private handlePickerOpacityChange(
    e: CustomEvent<{ fillOpacity?: number }>,
  ) {
    const { fillOpacity } = e.detail;
    if (fillOpacity === undefined) {
      return;
    }
    const base = this.singleLayerFromNode();
    this.commit({ fills: [{ ...base, opacity: fillOpacity }] });
  }

  private handlePickerOpacityVariablePick(
    e: CustomEvent<{ mode: 'fill' | 'stroke'; key: string }>,
  ) {
    if (e.detail.mode !== 'fill') {
      return;
    }
    const base = this.singleLayerFromNode();
    this.commit({
      fills: [{ ...base, opacity: `$${e.detail.key}` }],
    });
  }

  private handlePickerOpacityVariableUnbind(
    e: CustomEvent<{ mode: 'fill' | 'stroke' }>,
  ) {
    if (e.detail.mode !== 'fill') {
      return;
    }
    const base = this.singleLayerFromNode();
    const raw = base.opacity ?? 1;
    const resolved = resolveDesignVariableValue(
      raw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      this.commit({
        fills: [{ ...base, opacity: Math.max(0, Math.min(1, n)) }],
      });
    }
  }

  private renderColorSwatchPicker(
    layer: SerializedFillLayerItem,
    index: number | null,
  ): TemplateResult {
    const safeId = this.node.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const suffix = index == null ? 'single' : String(index);
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
          ${index == null
        ? html`<ic-spectrum-color-picker
                .value=${pickerValue}
                .fillOpacity=${this.layerOpacityResolved01(this.singleLayerFromNode())}
                enable-opacity-variable-binding
                @color-change=${(e: CustomEvent<ColorPickerChangeDetail>) =>
            this.handlePickerColorChange(null, e)}
                @opacity-change=${this.handlePickerOpacityChange}
                @opacity-variable-pick=${this.handlePickerOpacityVariablePick}
                @opacity-variable-unbind=${this
            .handlePickerOpacityVariableUnbind}
              ></ic-spectrum-color-picker>`
        : html`<ic-spectrum-color-picker
                .value=${pickerValue}
                @color-change=${(e: CustomEvent<ColorPickerChangeDetail>) =>
            this.handlePickerColorChange(index, e)}
              ></ic-spectrum-color-picker>`}
        </sp-popover>
      </sp-overlay>
    `;
  }

  private handleOpacityChange(
    index: number | null,
    e: CustomEvent<{ value: string }>,
  ) {
    const n = parseInt(
      String((e.target as unknown as { value: string }).value),
      10,
    );
    const p = Number.isFinite(n) ? clamp01(n / 100) : 1;
    const multi = this.getMultiLayers();
    if (multi && index != null) {
      const next = multi.map((L, i) =>
        i === index ? { ...L, opacity: p } : L,
      );
      this.commit({ fills: next });
      return;
    }
    const base = this.singleLayerFromNode();
    this.commit({ fills: [{ ...base, opacity: p }] });
  }

  private renderEye(layer: SerializedFillLayerItem, index: number) {
    const visible = layer.enabled !== false;
    return html`
      <sp-action-button
        quiet
        size="s"
        class="row-actions"
        label=${visible
        ? msg(str`Hide fill layer`)
        : msg(str`Show fill layer`)}
        @click=${() => this.handleToggleLayer(index)}
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
    isMulti: boolean,
  ) {
    const pct = Math.round(layerOpacity01(layer.opacity) * 100);
    const showEye = isMulti;
    const showRemove = isMulti;
    const pillClass = layer.enabled === false ? 'pill layer-off' : 'pill';

    return html`
      <div class="row">
        <div class=${pillClass}>
          ${this.renderColorSwatchPicker(layer, index)}
          <sp-textfield
            class="value-input"
            size="s"
            value=${this.displayValueForLayer(layer)}
            @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleValueChange(isMulti ? index : null, e)}
          ></sp-textfield>
          <div class="opacity-wrap">
            <sp-textfield
              class="opacity-field"
              size="s"
              value=${String(pct)}
              @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleOpacityChange(isMulti ? index : null, e)}
            ></sp-textfield>
            <span class="opacity-suffix">%</span>
          </div>
        </div>
        ${showEye ? this.renderEye(layer, index) : nothing}
        ${showRemove
        ? html`
              <sp-action-button
                quiet
                size="s"
                label=${msg(str`Remove fill layer`)}
                @click=${() => this.handleRemove(index)}
              >
                <sp-icon-remove slot="icon"></sp-icon-remove>
                <sp-tooltip self-managed placement="bottom">
                  ${msg(str`Remove`)}
                </sp-tooltip>
              </sp-action-button>
            `
        : nothing}
      </div>
    `;
  }

  private renderSingleRow(layer: SerializedFillLayerItem) {
    const pct = Math.round(this.layerOpacityResolved01(layer) * 100);
    const pillClass = 'pill';

    return html`
      <div class="row">
        <div class=${pillClass}>
          ${this.renderColorSwatchPicker(layer, null)}
          <sp-textfield
            class="value-input"
            size="s"
            value=${this.displayValueForLayer(layer)}
            @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleValueChange(null, e)}
          ></sp-textfield>
          <div class="opacity-wrap">
            <sp-textfield
              class="opacity-field"
              size="s"
              value=${String(pct)}
              @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleOpacityChange(null, e)}
            ></sp-textfield>
            <span class="opacity-suffix">%</span>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.node) {
      return html``;
    }
    // 依赖 fillPanelEpoch，避免仅 mutate node 同引用时 Lit 合并掉更新
    void this.fillPanelEpoch;

    const multi = this.getMultiLayers();
    if (multi) {
      return html`
        <div class="header">
          <span class="title">${msg(str`Fill`)}</span>
          <sp-action-button
            quiet
            size="s"
            label=${msg(str`Add fill layer`)}
            @click=${this.handleAdd}
          >
            <sp-icon-add slot="icon"></sp-icon-add>
          </sp-action-button>
        </div>
        <div class="rows">
          ${multi.map((layer, i) => this.renderLayerRow(layer, i, true))}
        </div>
      `;
    }

    const layer = this.singleLayerFromNode();

    return html`
      <div class="header">
        <span class="title">${msg(str`Fill`)}</span>
        <sp-action-button
          quiet
          size="s"
          label=${msg(str`Add fill layer`)}
          @click=${this.handleAdd}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
        </sp-action-button>
      </div>
      <div class="rows">${this.renderSingleRow(layer)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-fill-section': FillSection;
  }
}
