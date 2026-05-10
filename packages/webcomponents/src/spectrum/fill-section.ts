import { html, css, LitElement, type TemplateResult } from 'lit';
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
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility-off.js';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function fillLayerPrimaryWire(layer: SerializedFillLayerItem): string {
  return layer.value;
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

  /** 线框上已使用 `fills` 数组（可为空 `[]`）；非数组为旧数据，编辑时写入数组。 */
  private fillsWireArray(): SerializedFillLayerItem[] | null {
    const fl = (this.node as FillAttributes).fills;
    return Array.isArray(fl) ? fl.map((L) => ({ ...L })) : null;
  }

  /** 单层编辑用的当前层（无 `fills` 数组时给默认，首次写入时再 `commit`） */
  private singleLayerFromNode(): SerializedFillLayerItem {
    const fl = (this.node as FillAttributes).fills;
    if (Array.isArray(fl) && fl.length >= 1) {
      return { ...fl[0]! };
    }
    return { type: 'solid', value: '#000000', opacity: 1 };
  }

  /** 色盘是否带整体不透明度 / 变量绑定：仅「唯一一层」时启用（含 `fills: [L]` 与旧式无数组） */
  private fillPickerUsesOpacityUi(index: number | null): boolean {
    if (index === null) {
      return true;
    }
    const arr = this.fillsWireArray();
    return arr !== null && arr.length === 1 && index === 0;
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
    const defaultLayer: SerializedFillLayerItem = {
      type: 'solid',
      value: '#CCCCCC',
      opacity: 1,
    };
    const arr = this.fillsWireArray();
    if (arr !== null) {
      this.commit({ fills: [...arr, defaultLayer] });
      return;
    }
    const base = this.singleLayerFromNode();
    const primary = fillLayerPrimaryWire(base);
    const resolved = String(
      resolveDesignVariableValue(
        primary,
        this.appState.variables,
        this.appState.themeMode,
      ),
    );
    const normalized =
      base.type === 'gradient' || isGradient(resolved)
        ? ({ ...base, type: 'gradient' as const, value: resolved } as SerializedFillLayerItem)
        : base.type === 'image'
          ? ({ ...base, type: 'image' as const, value: resolved } as SerializedFillLayerItem)
          : base.type === 'pattern'
            ? ({
              ...base,
              type: 'pattern' as const,
              value: resolved,
            } as SerializedFillLayerItem)
          : ({
            ...base,
            type: 'solid' as const,
            value: normalizeSolidCssValue(resolved),
          } as SerializedFillLayerItem);
    this.commit({ fills: [normalized, defaultLayer] });
  }

  private handleRemove(index: number) {
    const arr = this.fillsWireArray();
    if (arr !== null) {
      if (index < 0 || index >= arr.length) {
        return;
      }
      this.commit({ fills: arr.filter((_, i) => i !== index) });
      return;
    }
    if (index !== 0) {
      return;
    }
    this.commit({ fills: [] });
  }

  private handleToggleLayer(index: number) {
    const arr = this.fillsWireArray();
    if (arr !== null) {
      const cur = arr[index];
      if (!cur) {
        return;
      }
      const visible = cur.enabled !== false;
      const next = arr.map((L, i) =>
        i === index ? { ...L, enabled: visible ? false : true } : L,
      );
      this.commit({ fills: next });
      return;
    }
    if (index !== 0) {
      return;
    }
    const base = this.singleLayerFromNode();
    const visible = base.enabled !== false;
    this.commit({
      fills: [{ ...base, enabled: visible ? false : true }],
    });
  }

  private handleValueChange(
    index: number | null,
    e: CustomEvent<{ value: string }>,
  ) {
    const raw = String((e.target as unknown as { value: string }).value).trim();
    const arr = this.fillsWireArray();
    if (arr !== null && index != null) {
      const L = arr[index];
      if (!L) {
        return;
      }
      let nextLayer: SerializedFillLayerItem;
      if (L.type === 'gradient' || L.type === 'image') {
        nextLayer = { ...L, value: raw };
      } else if (L.type === 'pattern') {
        nextLayer = { ...L, value: raw };
      } else {
        nextLayer = { ...L, value: normalizeSolidCssValue(raw) };
      }
      const next = arr.map((x, i) => (i === index ? nextLayer : x));
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

    const arr = this.fillsWireArray();

    if (arr !== null && index != null) {
      const applyOpacity =
        pickFillOpacity !== undefined && arr.length === 1 && index === 0;
      const next = arr.map((L, i) => {
        if (i !== index) {
          return L;
        }
        let nextL: SerializedFillLayerItem;
        if (layerType === 'gradient') {
          nextL = { ...L, type: 'gradient' as const, value: wireValue };
        } else if (layerType === 'image') {
          nextL = { ...L, type: 'image' as const, value: wireValue };
        } else {
          nextL = { ...L, type: 'solid' as const, value: wireValue };
        }
        if (applyOpacity) {
          nextL = { ...nextL, opacity: pickFillOpacity };
        }
        return nextL;
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
    if (pickFillOpacity !== undefined && index == null && arr === null) {
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
    const suffix =
      index == null ? 'single' : `i${index}`;
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
                .fillOpacity=${this.layerOpacityResolved01(
          index == null
            ? this.singleLayerFromNode()
            : this.fillsWireArray()![0]!,
        )}
                enable-opacity-variable-binding
                @color-change=${(e: CustomEvent<ColorPickerChangeDetail>) =>
            this.handlePickerColorChange(index, e)}
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
    const arr = this.fillsWireArray();
    if (arr !== null) {
      if (index == null) {
        return;
      }
      const next = arr.map((L, i) =>
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
    fillsArrayMode: boolean,
  ) {
    const pct = Math.round(
      (fillsArrayMode
        ? layerOpacity01(layer.opacity)
        : this.layerOpacityResolved01(layer)) * 100,
    );
    const pillClass = layer.enabled === false ? 'pill layer-off' : 'pill';
    const valueIndex = fillsArrayMode ? index : null;
    const pickerIndex = fillsArrayMode ? index : null;

    return html`
      <div class="row">
        <div class=${pillClass}>
          ${this.renderColorSwatchPicker(layer, pickerIndex)}
          <sp-textfield
            class="value-input"
            size="s"
            value=${this.displayValueForLayer(layer)}
            @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleValueChange(valueIndex, e)}
          ></sp-textfield>
          <div class="opacity-wrap">
            <sp-number-field
              class="opacity-field"
              size="s"
              value=${String(pct)}
              @change=${(e: CustomEvent<{ value: string }>) =>
        this.handleOpacityChange(valueIndex, e)}
              hide-stepper
              autocomplete="off"
              format-options='{
                  "style": "unit",
                  "unit": "%"
                }'
            ></sp-number-field>
          </div>
        </div>
        ${this.renderEye(layer, index)}
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

    const arr = this.fillsWireArray();
    if (arr !== null) {
      return html`
        <div class="rows">
          ${arr.length === 0
          ? html``
          : arr.map((layer, i) =>
            this.renderLayerRow(layer, i, true))}
        </div>
        ${header}
      `;
    }

    const layer = this.singleLayerFromNode();
    return html`
      ${header}
      <div class="rows">${this.renderLayerRow(layer, 0, false)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-fill-section': FillSection;
  }
}
