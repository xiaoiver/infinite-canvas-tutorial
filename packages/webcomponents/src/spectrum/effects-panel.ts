import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { consume } from '@lit/context';
import * as d3 from 'd3-color';
import {
  AppState,
  parseColor,
  parseEffect,
  formatFilter,
  isSaturateOnlyAdjustment,
  createDefaultEffect,
  HEATMAP_DEFAULTS,
  GEM_SMOKE_DEFAULTS,
  GPUResource,
  listRegisteredCubeLutKeys,
  type Effect,
  type DefaultEffectKind,
  type SerializedNode,
  type BurnEffect,
  type LiquidMetalEffect,
  type HeatmapEffect,
  type GemSmokeEffect,
  type HalftoneDotsEffect,
  type CrtEffect,
  type VignetteEffect,
  type AsciiEffect,
  type GlitchEffect,
  type LiquidGlassEffect,
  type FlutedGlassEffect,
  type TsunamiEffect,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/switch/sp-switch.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';
import './input-solid';

function isHalftoneDotsEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'halftoneDots';
}

function isFlutedGlassEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'flutedGlass';
}

function isCrtEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'crt';
}

function isVignetteEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'vignette';
}

function isAsciiEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'ascii';
}

function isGlitchEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'glitch';
}

function isLiquidGlassEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'liquidGlass';
}

function isTsunamiEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'tsunami';
}

function isBurnEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'burn';
}

function isLiquidMetalEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'liquidMetal';
}

function isHeatmapEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'heatmap';
}

function isGemSmokeEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'gemSmoke';
}

function isLutEffect(e: Effect): boolean {
  return (e as { type?: string }).type === 'lut';
}

type SolidColorChangeDetail = { type: string; value: string };

function solidColorToPatch(
  e: CustomEvent<SolidColorChangeDetail>,
  apply: (value: string) => void,
) {
  if (e.detail.type !== 'solid' || !e.detail.value) return;
  apply(e.detail.value);
}

/** 与 `document-theme-settings` 色块预览一致：不透明显示用 hex。 */
function solidHexForPicker(raw: string): string {
  const p = parseColor((raw && raw.trim()) || '#808080');
  return d3.rgb(p.r, p.g, p.b, 1).formatHex();
}

/** Picker / menu value for an effect row (maps `adjustment` from saturate to `saturate`). */
type EffectKind = DefaultEffectKind;

function effectKind(
  effect: Effect,
):
  | EffectKind
  | 'drop-shadow'
  | 'adjustment-full'
  | 'unknown' {
  if (effect.type === 'adjustment') {
    return isSaturateOnlyAdjustment(effect) ? 'saturate' : 'adjustment-full';
  }
  if (isHalftoneDotsEffect(effect)) {
    return 'halftoneDots';
  }
  if (isFlutedGlassEffect(effect)) {
    return 'flutedGlass';
  }
  if (isCrtEffect(effect)) {
    return 'crt';
  }
  if (isVignetteEffect(effect)) {
    return 'vignette';
  }
  if (isAsciiEffect(effect)) {
    return 'ascii';
  }
  if (isGlitchEffect(effect)) {
    return 'glitch';
  }
  if (isLiquidGlassEffect(effect)) {
    return 'liquidGlass';
  }
  if (isTsunamiEffect(effect)) {
    return 'tsunami';
  }
  if (isBurnEffect(effect)) {
    return 'burn';
  }
  if (isLiquidMetalEffect(effect)) {
    return 'liquidMetal';
  }
  if (isHeatmapEffect(effect)) {
    return 'heatmap';
  }
  if (isGemSmokeEffect(effect)) {
    return 'gemSmoke';
  }
  if (isLutEffect(effect)) {
    return 'lut';
  }
  if (
    effect.type === 'brightness' ||
    effect.type === 'contrast' ||
    effect.type === 'noise' ||
    effect.type === 'fxaa' ||
    effect.type === 'blur' ||
    effect.type === 'pixelate' ||
    effect.type === 'dot' ||
    effect.type === 'colorHalftone'
  ) {
    return effect.type;
  }
  if (effect.type === 'drop-shadow') {
    return 'drop-shadow';
  }
  return 'unknown';
}

@customElement('ic-spectrum-effects-panel')
@localized()
export class EffectsPanel extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .effect-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--spectrum-gray-300);
      border-radius: var(--spectrum-corner-radius-100);
      background: var(--spectrum-gray-75);
    }

    .row-head {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    sp-picker {
      flex: 1;
      min-width: 0;
    }

    .row-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }

    sp-slider {
      width: 100%;
    }

    .hint {
      font-size: 11px;
      color: var(--spectrum-gray-700);
    }

    .add-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    sp-popover {
      padding: 0;
    }

    .effect-color-field-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      margin-bottom: 4px;
    }

    .effect-color-field-row sp-field-label {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
    }

    .color-ctrl-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .effect-color-popover-wrap {
      flex: 0 0 auto;
    }

    .color-trigger {
      flex: 0 0 auto;
    }

    .swatch {
      display: block;
      width: 28px;
      height: 22px;
      border-radius: var(--spectrum-corner-radius-100);
      border: 1px solid var(--spectrum-gray-400);
      box-sizing: border-box;
    }

    .solid-popover-body {
      padding: var(--spectrum-global-dimension-size-100);
      box-sizing: border-box;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property({ type: Object })
  node: SerializedNode;

  /** 多选时传入与 `layersSelected` 一致的 id 列表；提交时将相同 `filter` 写到所有这些节点。 */
  @property({ type: Array, attribute: false })
  targetNodeIds?: SerializedNode['id'][];

  /**
   * 多选且各对象 `filter` 字符串不一致时（Figma 式 “mixed”）：不展示任何已有个滤镜行，仅保留「添加」；
   * 自空白添加或统一提交后，会写入选中全部对象。
   */
  @property({ type: Boolean, attribute: false })
  filtersMixed = false;

  /**
   * 额外 LUT 逻辑名（在 `custom` 与 {@link listRegisteredCubeLutKeys} 结果之后合并去重）。
   * 与 `registerCubeLutFromText(device, key, …)` 的 `key` 一致；画布 GPU 上已注册的 key 会自动出现在下拉中。
   */
  @property({ type: Array, attribute: false })
  lutKeys: string[] = ['custom'];

  @state()
  private effects: Effect[] = [];

  private lutKeyPickerOptions(currentKey: string): string[] {
    const fromProp =
      Array.isArray(this.lutKeys) && this.lutKeys.length > 0
        ? this.lutKeys
        : ['custom'];
    let fromGpu: string[] = [];
    try {
      const device = this.api?.getCanvas?.()?.read(GPUResource)?.device;
      if (device) {
        fromGpu = listRegisteredCubeLutKeys(device);
      }
    } catch {
      // 画布 / GPU 尚未就绪
    }
    const base = [...new Set(['custom', ...fromGpu, ...fromProp])];
    const k = (currentKey && currentKey.trim()) || 'custom';
    if (base.includes(k)) {
      return base;
    }
    return [...base, k];
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('filtersMixed') || (changed.has('node') && this.node)) {
      if (this.filtersMixed) {
        this.effects = [];
      } else if (this.node) {
        const f = (this.node as { filter?: string }).filter ?? '';
        this.effects = f ? parseEffect(f) : [];
      }
    }
  }

  private commit(next: Effect[]) {
    this.effects = next;
    const filter = formatFilter(next);
    const ids =
      this.targetNodeIds && this.targetNodeIds.length > 0
        ? this.targetNodeIds
        : this.node
          ? [this.node.id]
          : [];
    for (const id of ids) {
      const n = this.api.getNodeById(id);
      if (n) {
        this.api.updateNode(n, { filter });
      }
    }
    this.api.record();
  }

  private renderEffectSolidPopover(
    triggerId: string,
    value: string,
    onColorChange: (e: CustomEvent<SolidColorChangeDetail>) => void,
  ) {
    const swatchHex = solidHexForPicker(
      value && value.trim() ? value : '#808080',
    );
    return html`
      <div class="effect-color-popover-wrap">
        <sp-action-button
          class="color-trigger"
          quiet
          size="s"
          id=${triggerId}
        >
          <span
            class="swatch"
            style=${`background-color: ${swatchHex}`}
            slot="icon"
          ></span>
        </sp-action-button>
        <sp-overlay
          trigger=${`${triggerId}@click`}
          placement="bottom"
          type="auto"
        >
          <sp-popover dialog>
            <div class="solid-popover-body">
              <ic-spectrum-input-solid
                .value=${value}
                @color-change=${onColorChange}
              ></ic-spectrum-input-solid>
            </div>
          </sp-popover>
        </sp-overlay>
      </div>
    `;
  }

  private handleAddFilter(e: CustomEvent) {
    const value = (e.target as { value?: string }).value as EffectKind | undefined;
    if (!value) return;
    this.commit([...this.effects, createDefaultEffect(value)]);
  }

  private handleRemove(index: number) {
    const next = this.effects.filter((_, i) => i !== index);
    this.commit(next);
  }

  private handleMove(index: number, delta: -1 | 1) {
    const j = index + delta;
    if (j < 0 || j >= this.effects.length) return;
    const next = [...this.effects];
    [next[index], next[j]] = [next[j], next[index]];
    this.commit(next);
  }

  private handleKindChanged(index: number, e: Event & { target: HTMLInputElement }) {
    const kind = e.target.value as EffectKind;
    const next = [...this.effects];
    next[index] = createDefaultEffect(kind);
    this.commit(next);
  }

  private renderEffectRow(effect: Effect, index: number) {
    const kind = effectKind(effect);
    const canEditKind =
      kind !== 'fxaa' &&
      kind !== 'blur' &&
      kind !== 'drop-shadow' &&
      kind !== 'unknown' &&
      kind !== 'adjustment-full';

    return html`
      <div class="effect-row">
        <div class="row-head">
          ${canEditKind
        ? html`
                <sp-picker
                  size="s"
                  label=${msg(str`Filter type`)}
                  .value=${kind}
                  @change=${(e: Event & { target: HTMLInputElement }) =>
            this.handleKindChanged(index, e)}
                >
                  <sp-menu-item value="brightness"
                    >${msg(str`Brightness`)}</sp-menu-item
                  >
                  <sp-menu-item value="contrast"
                    >${msg(str`Contrast`)}</sp-menu-item
                  >
                  <sp-menu-item value="saturate"
                    >${msg(str`Saturation`)}</sp-menu-item
                  >
                  <sp-menu-item value="noise">${msg(str`Noise`)}</sp-menu-item>
                  <sp-menu-item value="pixelate"
                    >${msg(str`Pixelate`)}</sp-menu-item
                  >
                  <sp-menu-item value="dot">${msg(str`Dot screen`)}</sp-menu-item>
                  <sp-menu-item value="colorHalftone"
                    >${msg(str`Color halftone`)}</sp-menu-item
                  >
                  <sp-menu-item value="halftoneDots"
                    >${msg(str`Halftone dots`)}</sp-menu-item
                  >
                  <sp-menu-item value="flutedGlass"
                    >${msg(str`Fluted glass`)}</sp-menu-item
                  >
                  <sp-menu-item value="crt"
                    >${msg(str`CRT`)}</sp-menu-item
                  >
                  <sp-menu-item value="vignette"
                    >${msg(str`Vignette`)}</sp-menu-item
                  >
                  <sp-menu-item value="ascii">${msg(str`ASCII`)}</sp-menu-item>
                  <sp-menu-item value="glitch">${msg(str`Glitch`)}</sp-menu-item>
                  <sp-menu-item value="liquidGlass"
                    >${msg(str`Liquid glass`)}</sp-menu-item
                  >
                  <sp-menu-item value="tsunami"
                    >${msg(str`Tsunami`)}</sp-menu-item
                  >
                  <sp-menu-item value="burn"
                    >${msg(str`Burn`)}</sp-menu-item
                  >
                  <sp-menu-item value="liquidMetal"
                    >${msg(str`Liquid metal`)}</sp-menu-item
                  >
                  <sp-menu-item value="heatmap"
                    >${msg(str`Heat map`)}</sp-menu-item
                  >
                  <sp-menu-item value="gemSmoke"
                    >${msg(str`Gem smoke`)}</sp-menu-item
                  >
                  <sp-menu-item value="lut">${msg(str`LUT`)}</sp-menu-item>
                </sp-picker>
              `
        : html`
                <span class="hint"
                  >${kind === 'drop-shadow'
            ? msg(str`Drop shadow (view only — remove or edit in code)`)
            : kind === 'adjustment-full'
              ? msg(
                str`Color adjustment (view only — remove or edit in code)`,
              )
              : msg(str`Unsupported effect`)}</span
                >
              `}
          <div class="row-actions">
            <sp-action-button
              quiet
              size="s"
              label=${msg(str`Move up`)}
              ?disabled=${index === 0}
              @click=${() => this.handleMove(index, -1)}
            >
              <sp-icon-arrow-up slot="icon"></sp-icon-arrow-up>
            </sp-action-button>
            <sp-action-button
              quiet
              size="s"
              label=${msg(str`Move down`)}
              ?disabled=${index >= this.effects.length - 1}
              @click=${() => this.handleMove(index, 1)}
            >
              <sp-icon-arrow-down slot="icon"></sp-icon-arrow-down>
            </sp-action-button>
            <sp-action-button
              quiet
              size="s"
              label=${msg(str`Remove`)}
              @click=${() => this.handleRemove(index)}
            >
              <sp-icon-delete slot="icon"></sp-icon-delete>
            </sp-action-button>
          </div>
        </div>
        ${this.renderEffectParams(effect, index)}
      </div>
    `;
  }

  private renderEffectParams(effect: Effect, index: number) {
    if (effect.type === 'brightness' || effect.type === 'contrast') {
      const label =
        effect.type === 'brightness'
          ? msg(str`Brightness`)
          : msg(str`Contrast`);
      return html`
        <sp-slider
          size="s"
          label=${label}
          label-visibility="none"
          min="-1"
          max="1"
          step="0.01"
          .value=${effect.value}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = {
            ...effect,
            value: v,
          };
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'noise') {
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Amount`)}
          label-visibility="none"
          min="0"
          max="1"
          step="0.01"
          .value=${effect.value}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = { ...effect, value: v };
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'blur') {
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Radius`)}
          min="0"
          max="64"
          step="0.5"
          .value=${effect.value}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = { ...effect, value: v };
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'pixelate') {
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Block size`)}
          min="1"
          max="64"
          step="1"
          .value=${effect.size}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = { ...effect, size: v };
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'dot') {
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Scale`)}
          min="0.1"
          max="8"
          step="0.05"
          .value=${effect.scale}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = { ...effect, scale: v };
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle`)}
          min="0"
          max="10"
          step="0.05"
          .value=${effect.angle}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = { ...effect, angle: v };
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Grayscale`)}
          min="0"
          max="1"
          step="1"
          .value=${effect.grayscale}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = {
            ...effect,
            grayscale: v > 0.5 ? 1 : 0,
          };
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'colorHalftone') {
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Dot size`)}
          min="1"
          max="32"
          step="0.5"
          .value=${effect.size}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = { ...effect, size: v };
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle`)}
          min="0"
          max="6.283"
          step="0.02"
          .value=${effect.angle}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          (next[index] as typeof effect) = { ...effect, angle: v };
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (isHalftoneDotsEffect(effect)) {
      const h = effect as unknown as HalftoneDotsEffect;
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Size`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.size}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            size: Number.isFinite(v) ? v : h.size,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Radius`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.radius}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            radius: Number.isFinite(v) ? v : h.radius,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Contrast`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.contrast}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            contrast: Number.isFinite(v) ? v : h.contrast,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-picker
          size="s"
          label=${msg(str`Grid`)}
          .value=${String(h.grid)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseInt(e.target.value, 10);
          const next = [...this.effects];
          next[index] = {
            ...h,
            grid: v === 1 ? 1 : 0,
          } as unknown as Effect;
          this.commit(next);
        }}
        >
          <sp-menu-item value="0">${msg(str`Square`)}</sp-menu-item>
          <sp-menu-item value="1">${msg(str`Hex`)}</sp-menu-item>
        </sp-picker>
        <sp-picker
          size="s"
          label=${msg(str`Dot style`)}
          .value=${String(h.dotStyle)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseInt(e.target.value, 10);
          const next = [...this.effects];
          next[index] = {
            ...h,
            dotStyle: Math.max(0, Math.min(3, v)),
          } as unknown as Effect;
          this.commit(next);
        }}
        >
          <sp-menu-item value="0">${msg(str`Classic`)}</sp-menu-item>
          <sp-menu-item value="1">${msg(str`Gooey`)}</sp-menu-item>
          <sp-menu-item value="2">${msg(str`Holes`)}</sp-menu-item>
          <sp-menu-item value="3">${msg(str`Soft`)}</sp-menu-item>
        </sp-picker>
        <sp-switch
          size="s"
          ?checked=${h.originalColors !== false}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          const next = [...this.effects];
          next[index] = {
            ...h,
            originalColors: checked,
          } as unknown as Effect;
          this.commit(next);
        }}
        >${msg(str`Original colors`)}</sp-switch>
      `;
    }
    if (isFlutedGlassEffect(effect)) {
      const h = effect as unknown as FlutedGlassEffect;
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Size`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.size}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            size: Number.isFinite(v) ? v : h.size,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle`)}
          min="0"
          max="180"
          step="1"
          .value=${h.angle}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            angle: Number.isFinite(v) ? v : h.angle,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Distortion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.distortion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            distortion: Number.isFinite(v) ? v : h.distortion,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Blur`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.blur}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            blur: Number.isFinite(v) ? v : h.blur,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Edges`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.edges}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            edges: Number.isFinite(v) ? v : h.edges,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (isTsunamiEffect(effect)) {
      const h = effect as unknown as TsunamiEffect;
      const num = (
        key: keyof Omit<TsunamiEffect, 'type'>,
        v: number,
      ) => {
        const next = [...this.effects];
        next[index] = {
          ...h,
          [key]: v,
        } as unknown as Effect;
        this.commit(next);
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Stripe count`)}
          min="4"
          max="128"
          step="1"
          .value=${h.stripeCount}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('stripeCount', Number.isFinite(v) ? v : h.stripeCount);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Stripe angle`)}
          min="-180"
          max="180"
          step="1"
          .value=${h.stripeAngle}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('stripeAngle', Number.isFinite(v) ? v : h.stripeAngle);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Distortion`)}
          min="0"
          max="4"
          step="0.01"
          .value=${h.distortion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('distortion', Number.isFinite(v) ? v : h.distortion);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Reflection`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.reflection}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('reflection', Number.isFinite(v) ? v : h.reflection);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Disturbance`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.disturbance}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('disturbance', Number.isFinite(v) ? v : h.disturbance);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Contortion`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.contortion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('contortion', Number.isFinite(v) ? v : h.contortion);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Dispersion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.dispersion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('dispersion', Number.isFinite(v) ? v : h.dispersion);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Drift`)}
          min="-1"
          max="1"
          step="0.01"
          .value=${h.drift}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('drift', Number.isFinite(v) ? v : h.drift);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Shadow`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.shadowIntensity}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('shadowIntensity', Number.isFinite(v) ? v : h.shadowIntensity);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Offset`)}
          min="-0.5"
          max="0.5"
          step="0.001"
          .value=${h.offset}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          num('offset', Number.isFinite(v) ? v : h.offset);
        }}
        ></sp-slider>
        <sp-switch
          size="s"
          ?checked=${h.blend > 0.5}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          const next = [...this.effects];
          next[index] = {
            ...h,
            blend: checked ? 1 : 0,
          } as unknown as Effect;
          this.commit(next);
        }}
        >${msg(str`Luminance blend (reflection)`)}
        </sp-switch>
      `;
    }
    if (isBurnEffect(effect)) {
      const h = effect as unknown as BurnEffect;
      const patch = (partial: Partial<BurnEffect>) => {
        const next = [...this.effects];
        next[index] = { ...h, ...partial, type: 'burn' } as unknown as Effect;
        this.commit(next);
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Burn amount`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.burn}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ burn: Number.isFinite(v) ? v : h.burn });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Density`)}
          min="0.01"
          max="4"
          step="0.01"
          .value=${h.density}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ density: Number.isFinite(v) ? v : h.density });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Softness`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.softness}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ softness: Number.isFinite(v) ? v : h.softness });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Dispersion`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.dispersion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ dispersion: Number.isFinite(v) ? v : h.dispersion });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`UV distortion`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.distortion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ distortion: Number.isFinite(v) ? v : h.distortion });
        }}
        ></sp-slider>
        <div class="effect-color-field-row">
          <sp-field-label
            size="s"
            for="ic-ef-burn-edge-${index}"
            side-aligned="start"
            >${msg(str`Edge color`)}</sp-field-label
          >
          ${this.renderEffectSolidPopover(
            `ic-ef-burn-edge-${index}`,
            h.edgeColor,
            (e) => {
              solidColorToPatch(e, (v) => patch({ edgeColor: v }));
            },
          )}
        </div>
        <div class="effect-color-field-row">
          <sp-field-label
            size="s"
            for="ic-ef-burn-mask-${index}"
            side-aligned="start"
            >${msg(str`Mask color`)}</sp-field-label
          >
          ${this.renderEffectSolidPopover(
            `ic-ef-burn-mask-${index}`,
            h.maskColor,
            (e) => {
              solidColorToPatch(e, (v) => patch({ maskColor: v }));
            },
          )}
        </div>
        <sp-switch
          size="s"
          ?checked=${h.invertMask}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ invertMask: checked });
        }}
        >${msg(str`Invert mask`)}</sp-switch
        >
        <sp-switch
          size="s"
          ?checked=${h.transparent}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ transparent: checked });
        }}
        >${msg(str`Transparent blend`)}</sp-switch
        >
      `;
    }
    if (isLiquidMetalEffect(effect)) {
      /** `ecs` 源码含 `usePoisson`；构建产物 `lib` 需重新 `build` 后声明才会同步。 */
      type Lm = LiquidMetalEffect & { usePoisson?: boolean };
      const h = effect as unknown as Lm;
      const patch = (partial: Partial<Lm>) => {
        const next = [...this.effects];
        next[index] = { ...h, ...partial, type: 'liquidMetal' } as unknown as Effect;
        this.commit(next);
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Repetition`)}
          min="1"
          max="10"
          step="0.1"
          .value=${h.repetition}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({
            repetition: Number.isFinite(v) ? v : h.repetition,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Softness`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.softness}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ softness: Number.isFinite(v) ? v : h.softness });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Shift red`)}
          min="-30"
          max="30"
          step="0.5"
          .value=${h.shiftRed}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ shiftRed: Number.isFinite(v) ? v : h.shiftRed });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Shift blue`)}
          min="-30"
          max="30"
          step="0.5"
          .value=${h.shiftBlue}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ shiftBlue: Number.isFinite(v) ? v : h.shiftBlue });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Distortion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.distortion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ distortion: Number.isFinite(v) ? v : h.distortion });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Contour`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.contour}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ contour: Number.isFinite(v) ? v : h.contour });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle (°)`)}
          min="-180"
          max="180"
          step="1"
          .value=${h.angle}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ angle: Number.isFinite(v) ? v : h.angle });
        }}
        ></sp-slider>
        <sp-picker
          size="s"
          label=${msg(str`Shape (no image)`)}
          .value=${String(h.shape)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseInt(e.target.value, 10);
          patch({ shape: Math.max(0, Math.min(4, Number.isFinite(v) ? v : h.shape)) });
        }}
        >
          <sp-menu-item value="0"
            >${msg(str`None (canvas border)`)}</sp-menu-item
          >
          <sp-menu-item value="1">${msg(str`Circle`)}</sp-menu-item>
          <sp-menu-item value="2">${msg(str`Daisy`)}</sp-menu-item>
          <sp-menu-item value="3">${msg(str`Diamond`)}</sp-menu-item>
          <sp-menu-item value="4">${msg(str`Metaballs`)}</sp-menu-item>
        </sp-picker>
        <sp-switch
          size="s"
          ?checked=${h.useImage}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ useImage: checked });
        }}
        >${msg(str`Use layer as mask`)}</sp-switch
        >
        ${h.useImage
          ? html`<sp-switch
            size="s"
            ?checked=${h.usePoisson !== false}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const checked = (e.target as { checked?: boolean }).checked === true;
              patch({ usePoisson: checked });
            }}
            >${msg(str`CPU Poisson edge (WebGL; Paper-style R/G)`)}</sp-switch
            >`
          : ''}
        <div class="effect-color-field-row">
          <sp-field-label
            size="s"
            for="ic-ef-lm-b-${index}"
            side-aligned="start"
            >${msg(str`Background`)}</sp-field-label
          >
          ${this.renderEffectSolidPopover(
            `ic-ef-lm-b-${index}`,
            h.colorBack,
            (e) => {
              solidColorToPatch(e, (v) => patch({ colorBack: v }));
            },
          )}
        </div>
        <div class="effect-color-field-row">
          <sp-field-label size="s" for="ic-ef-lm-t-${index}" side-aligned="start"
            >${msg(str`Tint`)}</sp-field-label
          >
          ${this.renderEffectSolidPopover(
            `ic-ef-lm-t-${index}`,
            h.colorTint,
            (e) => {
              solidColorToPatch(e, (v) => patch({ colorTint: v }));
            },
          )}
        </div>
        <div class="row-head">
          <sp-switch
            size="s"
            ?checked=${!!h.useEngineTime}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          patch({ useEngineTime: checked });
        }}
            >${msg(str`Engine time (animate)`)}</sp-switch
          >
        </div>
        ${h.useEngineTime
          ? html`<span class="hint"
              >${msg(
            str`Time uniform follows the app clock each frame (liquid metal).`,
          )}</span
            >`
          : html`
        <sp-slider
          size="s"
          label=${msg(str`Time`)}
          min="0"
          max="100"
          step="0.1"
          .value=${h.time}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = parseFloat(e.target.value);
              patch({ time: Number.isFinite(v) ? v : h.time });
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isHeatmapEffect(effect)) {
      const h = effect as unknown as HeatmapEffect;
      const patch = (partial: Partial<HeatmapEffect>) => {
        const next = [...this.effects];
        next[index] = {
          ...h,
          ...partial,
          type: 'heatmap',
        } as unknown as Effect;
        this.commit(next);
      };
      const palette = h.colors?.length ? h.colors : [...HEATMAP_DEFAULTS.colors];
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Contour`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.contour}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ contour: Number.isFinite(v) ? v : h.contour });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle (°)`)}
          min="-180"
          max="180"
          step="1"
          .value=${h.angle}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ angle: Number.isFinite(v) ? v : h.angle });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Noise`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.noise}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ noise: Number.isFinite(v) ? v : h.noise });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Inner glow`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.innerGlow}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ innerGlow: Number.isFinite(v) ? v : h.innerGlow });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Outer glow`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.outerGlow}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ outerGlow: Number.isFinite(v) ? v : h.outerGlow });
        }}
        ></sp-slider>
        <sp-switch
          size="s"
          ?checked=${h.useImage}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ useImage: checked });
        }}
        >${msg(str`Use layer as mask`)}</sp-switch
        >
        ${h.useImage
          ? html`<sp-switch
            size="s"
            ?checked=${h.usePreprocess !== false}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const checked = (e.target as { checked?: boolean }).checked === true;
              patch({ usePreprocess: checked });
            }}
            >${msg(str`CPU preprocess (WebGL; RGB blur)`)}</sp-switch
            >`
          : ''}
        <div class="effect-color-field-row">
          <sp-field-label
            size="s"
            for="ic-ef-hm-b-${index}"
            side-aligned="start"
            >${msg(str`Background`)}</sp-field-label
          >
          ${this.renderEffectSolidPopover(
            `ic-ef-hm-b-${index}`,
            h.colorBack,
            (e) => {
              solidColorToPatch(e, (v) => patch({ colorBack: v }));
            },
          )}
        </div>
        <sp-field-label size="s" side-top
          >${msg(str`Gradient (max 10)`)}</sp-field-label
        >
        ${palette.map(
            (c, ci) => html`
            <div class="color-ctrl-row">
              ${this.renderEffectSolidPopover(
              `ic-ef-hm-g-${index}-${ci}`,
              c,
              (e) => {
                solidColorToPatch(e, (v) => {
                  const list = [...palette];
                  list[ci] = v;
                  patch({ colors: list });
                });
              },
            )}
              <sp-action-button
                quiet
                size="s"
                label=${msg(str`Remove`)}
                ?disabled=${palette.length <= 1}
                @click=${() => {
                const list = palette.filter((_, j) => j !== ci);
                patch({
                  colors: list.length > 0 ? list : [...HEATMAP_DEFAULTS.colors],
                });
              }}
              >
                <sp-icon-delete slot="icon"></sp-icon-delete>
              </sp-action-button>
            </div>
          `,
          )}
        <sp-action-button
          quiet
          size="m"
          label=${msg(str`Add gradient stop`)}
          @click=${() => {
          const list = [...palette];
          if (list.length >= 10) return;
          list.push('#888888');
          patch({ colors: list });
        }}
          ?disabled=${palette.length >= 10}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
          ${msg(str`Add stop`)}
        </sp-action-button>
        <div class="row-head">
          <sp-switch
            size="s"
            ?checked=${!!h.useEngineTime}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          patch({ useEngineTime: checked });
        }}
            >${msg(str`Engine time (animate)`)}</sp-switch
          >
        </div>
        ${h.useEngineTime
          ? html`<span class="hint"
              >${msg(
            str`Time uniform follows the app clock each frame (heat map).`,
          )}</span
            >`
          : html`
        <sp-slider
          size="s"
          label=${msg(str`Time`)}
          min="0"
          max="100"
          step="0.1"
          .value=${h.time}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = parseFloat(e.target.value);
              patch({ time: Number.isFinite(v) ? v : h.time });
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isGemSmokeEffect(effect)) {
      const h = effect as unknown as GemSmokeEffect;
      const patch = (partial: Partial<GemSmokeEffect>) => {
        const next = [...this.effects];
        next[index] = {
          ...h,
          ...partial,
          type: 'gemSmoke',
        } as unknown as Effect;
        this.commit(next);
      };
      const smPalette = h.colors?.length
        ? h.colors
        : [...GEM_SMOKE_DEFAULTS.colors];
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Inner distortion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.innerDistortion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({
            innerDistortion: Number.isFinite(v) ? v : h.innerDistortion,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Outer distortion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.outerDistortion}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({
            outerDistortion: Number.isFinite(v) ? v : h.outerDistortion,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Outer glow`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.outerGlow}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ outerGlow: Number.isFinite(v) ? v : h.outerGlow });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Inner glow`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.innerGlow}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ innerGlow: Number.isFinite(v) ? v : h.innerGlow });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Offset`)}
          min="-1"
          max="1"
          step="0.01"
          .value=${h.offset}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ offset: Number.isFinite(v) ? v : h.offset });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle (°)`)}
          min="-180"
          max="180"
          step="1"
          .value=${h.angle}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ angle: Number.isFinite(v) ? v : h.angle });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Size`)}
          min="0"
          max="2"
          step="0.01"
          .value=${h.size}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({ size: Number.isFinite(v) ? v : h.size });
        }}
        ></sp-slider>
        <sp-picker
          size="s"
          label=${msg(str`Shape (no image)`)}
          .value=${String(h.shape)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseInt(e.target.value, 10);
          patch({
            shape: Math.max(0, Math.min(4, Number.isFinite(v) ? v : h.shape)),
          });
        }}
        >
          <sp-menu-item value="0"
            >${msg(str`Full canvas`)}</sp-menu-item
          >
          <sp-menu-item value="1">${msg(str`Circle`)}</sp-menu-item>
          <sp-menu-item value="2">${msg(str`Daisy`)}</sp-menu-item>
          <sp-menu-item value="3">${msg(str`Diamond`)}</sp-menu-item>
          <sp-menu-item value="4">${msg(str`Metaballs`)}</sp-menu-item>
        </sp-picker>
        <sp-switch
          size="s"
          ?checked=${h.useImage}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ useImage: checked });
        }}
        >${msg(str`Use layer as mask`)}</sp-switch
        >
        ${h.useImage
          ? html`<sp-switch
            size="s"
            ?checked=${h.usePoisson !== false}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const checked = (e.target as { checked?: boolean }).checked === true;
              patch({ usePoisson: checked });
            }}
            >${msg(str`CPU Poisson (WebGL; R/G like liquid metal)`)}</sp-switch
            >`
          : ''}
        <div class="effect-color-field-row">
          <sp-field-label
            size="s"
            for="ic-ef-gs-b-${index}"
            side-aligned="start"
            >${msg(str`Background`)}</sp-field-label
          >
          ${this.renderEffectSolidPopover(
            `ic-ef-gs-b-${index}`,
            h.colorBack,
            (e) => {
              solidColorToPatch(e, (v) => patch({ colorBack: v }));
            },
          )}
        </div>
        <div class="effect-color-field-row">
          <sp-field-label
            size="s"
            for="ic-ef-gs-i-${index}"
            side-aligned="start"
            >${msg(str`Inner color`)}</sp-field-label
          >
          ${this.renderEffectSolidPopover(
            `ic-ef-gs-i-${index}`,
            h.colorInner,
            (e) => {
              solidColorToPatch(e, (v) => patch({ colorInner: v }));
            },
          )}
        </div>
        <sp-field-label size="s" side-top
          >${msg(str`Smoke colors (max 6)`)}</sp-field-label
        >
        ${smPalette.map(
            (c, ci) => html`
            <div class="color-ctrl-row">
              ${this.renderEffectSolidPopover(
              `ic-ef-gs-s-${index}-${ci}`,
              c,
              (e) => {
                solidColorToPatch(e, (v) => {
                  const list = [...smPalette];
                  list[ci] = v;
                  patch({ colors: list });
                });
              },
            )}
              <sp-action-button
                quiet
                size="s"
                label=${msg(str`Remove`)}
                ?disabled=${smPalette.length <= 1}
                @click=${() => {
                const list = smPalette.filter((_, j) => j !== ci);
                patch({
                  colors: list.length > 0 ? list : [...GEM_SMOKE_DEFAULTS.colors],
                });
              }}
              >
                <sp-icon-delete slot="icon"></sp-icon-delete>
              </sp-action-button>
            </div>
          `,
          )}
        <sp-action-button
          quiet
          size="m"
          label=${msg(str`Add smoke color`)}
          @click=${() => {
          const list = [...smPalette];
          if (list.length >= 6) return;
          list.push('#888888');
          patch({ colors: list });
        }}
          ?disabled=${smPalette.length >= 6}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
          ${msg(str`Add color`)}
        </sp-action-button>
        <div class="row-head">
          <sp-switch
            size="s"
            ?checked=${!!h.useEngineTime}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          patch({ useEngineTime: checked });
        }}
            >${msg(str`Engine time (animate)`)}</sp-switch
          >
        </div>
        ${h.useEngineTime
          ? html`<span class="hint"
              >${msg(
            str`Time uniform follows the app clock each frame (gem smoke).`,
          )}</span
            >`
          : html`
        <sp-slider
          size="s"
          label=${msg(str`Time`)}
          min="0"
          max="100"
          step="0.1"
          .value=${h.time}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = parseFloat(e.target.value);
              patch({ time: Number.isFinite(v) ? v : h.time });
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isCrtEffect(effect)) {
      const h = effect as unknown as CrtEffect;
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Curvature`)}
          min="0"
          max="4"
          step="0.05"
          .value=${h.curvature}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            curvature: Number.isFinite(v) ? v : h.curvature,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Line width`)}
          min="0"
          max="10"
          step="0.1"
          .value=${h.lineWidth}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            lineWidth: Number.isFinite(v) ? v : h.lineWidth,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Line contrast`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.lineContrast}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            lineContrast: Number.isFinite(v) ? v : h.lineContrast,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Vertical scanlines`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.verticalLine}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            verticalLine: Number.isFinite(v) ? v : h.verticalLine,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <div class="row-head">
          <sp-switch
            size="s"
            ?checked=${!!h.useEngineTime}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          const next = [...this.effects];
          next[index] = {
            ...h,
            useEngineTime: checked,
          } as unknown as Effect;
          this.commit(next);
        }}
            >${msg(str`Engine time (animate)`)}</sp-switch
          >
        </div>
        ${h.useEngineTime
          ? html``
          : html`
        <sp-slider
          size="s"
          label=${msg(str`Time`)}
          min="0"
          max="100"
          step="0.1"
          .value=${h.time}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = parseFloat(e.target.value);
              const next = [...this.effects];
              next[index] = {
                ...h,
                time: Number.isFinite(v) ? v : h.time,
              } as unknown as Effect;
              this.commit(next);
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isGlitchEffect(effect)) {
      const h = effect as unknown as GlitchEffect;
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Jitter`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.jitter}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            jitter: Number.isFinite(v) ? v : h.jitter,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Blocks`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.blocks}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            blocks: Number.isFinite(v) ? v : h.blocks,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`RGB split`)}
          min="0"
          max="0.5"
          step="0.05"
          .value=${h.rgbSplit}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            rgbSplit: Number.isFinite(v) ? v : h.rgbSplit,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <div class="row-head">
          <sp-switch
            size="s"
            ?checked=${!!h.useEngineTime}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          const next = [...this.effects];
          next[index] = {
            ...h,
            useEngineTime: checked,
          } as unknown as Effect;
          this.commit(next);
        }}
            >${msg(str`Engine time (animate)`)}</sp-switch
          >
        </div>
        ${h.useEngineTime
          ? html``
          : html`
        <sp-slider
          size="s"
          label=${msg(str`Time`)}
          min="0"
          max="100"
          step="0.1"
          .value=${h.time}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = parseFloat(e.target.value);
              const next = [...this.effects];
              next[index] = {
                ...h,
                time: Number.isFinite(v) ? v : h.time,
              } as unknown as Effect;
              this.commit(next);
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isLiquidGlassEffect(effect)) {
      const h = effect as unknown as LiquidGlassEffect;
      const patch = (partial: Partial<LiquidGlassEffect>) => {
        const next = [...this.effects];
        next[index] = { ...h, ...partial } as unknown as Effect;
        this.commit(next);
      };
      const num = (
        e: Event & { target: HTMLInputElement },
        cur: number,
        fn: (v: number) => Partial<LiquidGlassEffect>,
      ) => {
        const v = parseFloat(e.target.value);
        patch(Number.isFinite(v) ? fn(v) : fn(cur));
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Superellipse power`)}
          min="2"
          max="16"
          step="0.1"
          .value=${h.powerFactor}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.powerFactor, (v) => ({ powerFactor: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Ellipse size X`)}
          min="0.2"
          max="3"
          step="0.02"
          .value=${h.ellipseSizeX ?? 1}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.ellipseSizeX ?? 1, (v) => ({ ellipseSizeX: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Ellipse size Y`)}
          min="0.2"
          max="3"
          step="0.02"
          .value=${h.ellipseSizeY ?? 1}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.ellipseSizeY ?? 1, (v) => ({ ellipseSizeY: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Refraction power`)}
          min="0.5"
          max="8"
          step="0.05"
          .value=${h.fPower}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.fPower, (v) => ({ fPower: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Grain`)}
          min="0"
          max="0.5"
          step="0.01"
          .value=${h.noise}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.noise, (v) => ({ noise: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Glow weight`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.glowWeight}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.glowWeight, (v) => ({ glowWeight: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Glow bias`)}
          min="-0.5"
          max="0.5"
          step="0.01"
          .value=${h.glowBias}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.glowBias, (v) => ({ glowBias: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Glow edge start`)}
          min="0"
          max="0.2"
          step="0.005"
          .value=${h.glowEdge0}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.glowEdge0, (v) => ({ glowEdge0: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Glow edge end`)}
          min="0"
          max="0.2"
          step="0.005"
          .value=${h.glowEdge1}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.glowEdge1, (v) => ({ glowEdge1: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Center X`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.centerX}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.centerX, (v) => ({ centerX: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Center Y`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.centerY}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.centerY, (v) => ({ centerY: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Scale X`)}
          min="0.25"
          max="2"
          step="0.01"
          .value=${h.scaleX}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.scaleX, (v) => ({ scaleX: v }))}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Scale Y`)}
          min="0.25"
          max="2"
          step="0.01"
          .value=${h.scaleY}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) =>
          num(e, h.scaleY, (v) => ({ scaleY: v }))}
        ></sp-slider>
        <span class="hint"
          >${msg(
            str`f(dist) coefficients a–d use defaults; edit the filter string to tune them.`,
          )}</span
        >
      `;
    }
    if (isVignetteEffect(effect)) {
      const h = effect as unknown as VignetteEffect;
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Size`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.size}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            size: Number.isFinite(v) ? v : h.size,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Amount`)}
          min="0"
          max="1"
          step="0.01"
          .value=${h.amount}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            amount: Number.isFinite(v) ? v : h.amount,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (isAsciiEffect(effect)) {
      const h = effect as unknown as AsciiEffect;
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Cell size (px)`)}
          min="1"
          max="32"
          step="1"
          .value=${h.size}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          next[index] = {
            ...h,
            size: Number.isFinite(v) ? Math.round(v) : h.size,
          } as unknown as Effect;
          this.commit(next);
        }}
        ></sp-slider>
        <div class="row-head">
          <sp-switch
            size="s"
            ?checked=${h.replaceColor}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          const next = [...this.effects];
          next[index] = {
            ...h,
            replaceColor: checked,
          } as unknown as Effect;
          this.commit(next);
        }}
            >${msg(str`Solid glyph color`)}</sp-switch
          >
        </div>
        ${h.replaceColor
          ? html`<sp-textfield
              size="s"
              label=${msg(str`Color`)}
              .value=${h.color}
              @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = e.target.value.trim();
              const next = [...this.effects];
              next[index] = { ...h, color: v || h.color } as unknown as Effect;
              this.commit(next);
            }}
            ></sp-textfield>`
          : null}
      `;
    }
    if (isLutEffect(effect)) {
      const h = effect as unknown as {
        type: 'lut';
        lutKey: string;
        strength: number;
      };
      const patch = (partial: Partial<{ lutKey: string; strength: number }>) => {
        const next = [...this.effects];
        next[index] = { ...h, ...partial, type: 'lut' } as unknown as Effect;
        this.commit(next);
      };
      const keyOptions = this.lutKeyPickerOptions(h.lutKey);
      const pickerValue = keyOptions.includes(h.lutKey)
        ? h.lutKey
        : keyOptions[0]!;
      return html`
        <sp-picker
          size="s"
          label=${msg(str`LUT key`)}
          .value=${pickerValue}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = e.target.value.trim();
          if (v.length) {
            patch({ lutKey: v });
          }
        }}
        >
          ${map(
        keyOptions,
        (key) =>
          html`<sp-menu-item value=${key}>${key}</sp-menu-item>`,
      )}
        </sp-picker>
        <sp-slider
          size="s"
          label=${msg(str`Strength`)}
          label-visibility="none"
          min="0"
          max="1"
          step="0.01"
          .value=${h.strength}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          patch({
            strength: Number.isFinite(v)
              ? Math.max(0, Math.min(1, v))
              : h.strength,
          });
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'adjustment') {
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Saturation`)}
          label-visibility="none"
          min="0"
          max="3"
          step="0.01"
          .value=${effect.saturation}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = parseFloat(e.target.value);
          const next = [...this.effects];
          const cur = next[index];
          if (cur.type !== 'adjustment') return;
          next[index] = { ...cur, saturation: v };
          this.commit(next);
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'fxaa') {
      return html`<span class="hint">${msg(str`No parameters.`)}</span>`;
    }
    return null;
  }

  render() {
    if (!this.node) {
      return null;
    }

    return html`
      ${map(this.effects, (effect, index) =>
      this.renderEffectRow(effect, index),
    )}
      <div class="add-row">
        <sp-action-menu
          size="s"
          label=${msg(str`Add filter`)}
          @change=${this.handleAddFilter}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
          <sp-menu-item value="brightness"
            >${msg(str`Brightness`)}</sp-menu-item
          >
          <sp-menu-item value="contrast">${msg(str`Contrast`)}</sp-menu-item>
          <sp-menu-item value="saturate"
            >${msg(str`Saturation`)}</sp-menu-item
          >
          <sp-menu-item value="noise">${msg(str`Noise`)}</sp-menu-item>
          <sp-menu-item value="fxaa"
            >${msg(str`Smoothing (FXAA)`)}</sp-menu-item
          >
          <sp-menu-item value="blur">${msg(str`Blur`)}</sp-menu-item>
          <sp-menu-item value="pixelate"
            >${msg(str`Pixelate`)}</sp-menu-item
          >
          <sp-menu-item value="dot">${msg(str`Dot screen`)}</sp-menu-item>
          <sp-menu-item value="colorHalftone"
            >${msg(str`Color halftone`)}</sp-menu-item
          >
          <sp-menu-item value="halftoneDots"
            >${msg(str`Halftone dots`)}</sp-menu-item
          >
          <sp-menu-item value="flutedGlass"
            >${msg(str`Fluted glass`)}</sp-menu-item
          >
          <sp-menu-item value="crt">${msg(str`CRT`)}</sp-menu-item>
          <sp-menu-item value="vignette">${msg(str`Vignette`)}</sp-menu-item>
          <sp-menu-item value="ascii">${msg(str`ASCII`)}</sp-menu-item>
          <sp-menu-item value="glitch">${msg(str`Glitch`)}</sp-menu-item>
          <sp-menu-item value="liquidGlass"
            >${msg(str`Liquid glass`)}</sp-menu-item
          >
          <sp-menu-item value="tsunami">${msg(str`Tsunami`)}</sp-menu-item>
          <sp-menu-item value="burn">${msg(str`Burn`)}</sp-menu-item>
          <sp-menu-item value="liquidMetal"
            >${msg(str`Liquid metal`)}</sp-menu-item
          >
          <sp-menu-item value="heatmap">${msg(str`Heat map`)}</sp-menu-item>
          <sp-menu-item value="gemSmoke">${msg(str`Gem smoke`)}</sp-menu-item>
          <sp-menu-item value="lut">${msg(str`LUT`)}</sp-menu-item>
        </sp-action-menu>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-effects-panel': EffectsPanel;
  }
}
