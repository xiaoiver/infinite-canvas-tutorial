import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { live } from 'lit/directives/live.js';
import { editEffects, effectRows, type EffectCommand } from './effect-command';
import { consume } from '@lit/context';
import * as d3 from 'd3-color';
import {
  AppState,
  parseColor,
  GPUResource,
  listRegisteredCubeLutKeys,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import {
  isSaturateOnlyAdjustment,
  BLUR_DEFAULTS,
  HEATMAP_DEFAULTS,
  GEM_SMOKE_DEFAULTS,
  RAINDROPS_WATER_DEFAULTS,
  RAINDROPS_SIM_DEFAULTS,
  RAINDROP_FX_RENDER_DEFAULTS,
  RAINDROP_FX_COMPOSE_DEFAULTS,
  RAINDROP_FX_SIM_DEFAULTS,
  RAIN_DROPDROP_TEXTURE_DEFAULT,
  isRainFxEffect,
  isRainCodropsRainEffect,
  type Effect,
  type DefaultEffectKind,
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
  type RainEffect,
  type RainCodropsWaterParams,
  type RainCodropsSimParams,
  type BlurEffect,
  type RaindropFxBackgroundWrapMode,
  type RainFxParams,
  type RainFxSimParams,
} from '@infinite-canvas-tutorial/filter';
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

/** 与原先菜单首项一致：一键添加时使用该类型 */
const DEFAULT_NEW_EFFECT_KIND: DefaultEffectKind = 'brightness';

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
  if (effect.type === 'rain') {
    return 'rain';
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
    effect.type === 'colorHalftone' ||
    effect.type === 'colorPencil'
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

    /* 与 ic-spectrum-fill-section「Add fill layer」一致的全宽 CTA */
    .add-layer-cta {
      margin-top: 4px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
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

  protected willUpdate(_changed: PropertyValues<this>): void {
    // Also refresh after cancelled edits, even when the serialized node is mutable.
    this.effects =
      this.filtersMixed || !this.node || !this.api
        ? []
        : effectRows(this.api, this.api.getNodeById(this.node.id) ?? this.node);
  }

  private async commit(command: EffectCommand, effect?: Effect) {
    const api = this.api;
    const id = this.node?.id;
    const ids = this.targetNodeIds?.length
      ? [...this.targetNodeIds]
      : id
      ? [id]
      : [];
    try {
      await editEffects(api, ids, command, effect, this.filtersMixed);
    } finally {
      if (this.isConnected && this.api === api && this.node?.id === id)
        this.requestUpdate();
    }
  }

  private patchEffect(effect: Effect, patch: object) {
    void this.commit({ kind: 'patch', patch }, effect);
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
                .value=${live(value)}
                @color-change=${onColorChange}
              ></ic-spectrum-input-solid>
            </div>
          </sp-popover>
        </sp-overlay>
      </div>
    `;
  }

  private handleAddDefaultEffect() {
    void this.commit({ kind: 'add', effectKind: DEFAULT_NEW_EFFECT_KIND });
  }

  private handleRemove(effect: Effect) {
    void this.commit({ kind: 'remove' }, effect);
  }

  private handleMove(effect: Effect, delta: -1 | 1) {
    void this.commit({ kind: 'move', delta }, effect);
  }

  private handleKindChanged(
    effect: Effect,
    e: Event & { target: HTMLInputElement },
  ) {
    void this.commit({ kind: 'replace', effectKind: e.target.value }, effect);
  }

  private renderEffectRow(effect: Effect, index: number) {
    const kind = effectKind(effect);
    const canEditKind =
      kind !== 'fxaa' &&
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
                  .value=${live(kind)}
                  @change=${(e: Event & { target: HTMLInputElement }) =>
            this.handleKindChanged(effect, e)}
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
                  <sp-menu-item value="blur">${msg(str`Blur`)}</sp-menu-item>
                  <sp-menu-item value="pixelate"
                    >${msg(str`Pixelate`)}</sp-menu-item
                  >
                  <sp-menu-item value="dot">${msg(str`Dot screen`)}</sp-menu-item>
                  <sp-menu-item value="colorPencil"
                    >${msg(str`Color pencil`)}</sp-menu-item
                  >
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
                  <sp-menu-item value="rain"
                    >${msg(str`Rain`)}</sp-menu-item
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
              @click=${() => this.handleMove(effect, -1)}
            >
              <sp-icon-arrow-up slot="icon"></sp-icon-arrow-up>
            </sp-action-button>
            <sp-action-button
              quiet
              size="s"
              label=${msg(str`Move down`)}
              ?disabled=${index >= this.effects.length - 1}
              @click=${() => this.handleMove(effect, 1)}
            >
              <sp-icon-arrow-down slot="icon"></sp-icon-arrow-down>
            </sp-action-button>
            <sp-action-button
              quiet
              size="s"
              label=${msg(str`Remove`)}
              @click=${() => this.handleRemove(effect)}
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
          .value=${live(effect.value)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            value: v,
          });
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
          .value=${live(effect.value)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { value: v });
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'blur') {
      const h = effect as BlurEffect;
      const quality =
        h.quality !== undefined && Number.isFinite(h.quality)
          ? h.quality
          : BLUR_DEFAULTS.quality;
      const clamp = h.clamp !== false;
      const patch = (partial: Partial<BlurEffect>) => {
        this.patchEffect(effect, { ...partial, type: 'blur' });
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Radius`)}
          label-visibility="none"
          min="0"
          max="64"
          step="0.5"
          .value=${live(h.value)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({
            value: Number.isFinite(v)
              ? Math.max(0, Math.min(64, v))
              : h.value,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Quality`)}
          label-visibility="none"
          min="1"
          max="8"
          step="1"
          .value=${live(quality)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({
            quality: Number.isFinite(v)
              ? Math.max(1, Math.min(8, Math.round(v)))
              : quality,
          });
        }}
        ></sp-slider>
        <sp-switch
          size="s"
          .checked=${live(clamp)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          patch({ clamp: e.target.checked });
        }}
          >${msg(str`Clamp edges`)}</sp-switch
        >
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
          .value=${live(effect.size)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { size: v });
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
          .value=${live(effect.scale)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { scale: v });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle`)}
          min="0"
          max="10"
          step="0.05"
          .value=${live(effect.angle)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { angle: v });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Grayscale`)}
          min="0"
          max="1"
          step="1"
          .value=${live(effect.grayscale)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            grayscale: v > 0.5 ? 1 : 0,
          });
        }}
        ></sp-slider>
      `;
    }
    if (effect.type === 'colorPencil') {
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Line length (ks)`)}
          min="2"
          max="16"
          step="1"
          .value=${live(effect.ks)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { ks: v });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Stroke width`)}
          min="0"
          max="4"
          step="1"
          .value=${live(effect.strokeWidth)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { strokeWidth: v });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Directions`)}
          min="2"
          max="16"
          step="1"
          .value=${live(effect.dirNum)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { dirNum: v });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Stroke gamma`)}
          min="0.2"
          max="3"
          step="0.05"
          .value=${live(effect.gammaS)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { gammaS: v });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Tone gamma`)}
          min="0.2"
          max="3"
          step="0.05"
          .value=${live(effect.gammaI)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { gammaI: v });
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
          .value=${live(effect.size)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { size: v });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle`)}
          min="0"
          max="6.283"
          step="0.02"
          .value=${live(effect.angle)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { angle: v });
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
          .value=${live(h.size)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            size: Number.isFinite(v) ? v : h.size,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Radius`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.radius)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            radius: Number.isFinite(v) ? v : h.radius,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Contrast`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.contrast)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            contrast: Number.isFinite(v) ? v : h.contrast,
          });
        }}
        ></sp-slider>
        <sp-picker
          size="s"
          label=${msg(str`Grid`)}
          .value=${live(String(h.grid))}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = Number(e.target.value);
          if (!['0','1','2','3','4'].includes(e.target.value)) { this.requestUpdate(); return; }
          this.patchEffect(effect, {
            grid: v === 1 ? 1 : 0,
          });
        }}
        >
          <sp-menu-item value="0">${msg(str`Square`)}</sp-menu-item>
          <sp-menu-item value="1">${msg(str`Hex`)}</sp-menu-item>
        </sp-picker>
        <sp-picker
          size="s"
          label=${msg(str`Dot style`)}
          .value=${live(String(h.dotStyle))}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = Number(e.target.value);
          if (!['0','1','2','3','4'].includes(e.target.value)) { this.requestUpdate(); return; }
          this.patchEffect(effect, {
            dotStyle: Math.max(0, Math.min(3, v)),
          });
        }}
        >
          <sp-menu-item value="0">${msg(str`Classic`)}</sp-menu-item>
          <sp-menu-item value="1">${msg(str`Gooey`)}</sp-menu-item>
          <sp-menu-item value="2">${msg(str`Holes`)}</sp-menu-item>
          <sp-menu-item value="3">${msg(str`Soft`)}</sp-menu-item>
        </sp-picker>
        <sp-switch
          size="s"
          .checked=${live(h.originalColors !== false)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          this.patchEffect(effect, {
            originalColors: checked,
          });
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
          .value=${live(h.size)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            size: Number.isFinite(v) ? v : h.size,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle`)}
          min="0"
          max="180"
          step="1"
          .value=${live(h.angle)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            angle: Number.isFinite(v) ? v : h.angle,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Distortion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.distortion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            distortion: Number.isFinite(v) ? v : h.distortion,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Blur`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.blur)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            blur: Number.isFinite(v) ? v : h.blur,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Edges`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.edges)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            edges: Number.isFinite(v) ? v : h.edges,
          });
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
        this.patchEffect(effect, {
          [key]: v,
        });
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Stripe count`)}
          min="4"
          max="128"
          step="1"
          .value=${live(h.stripeCount)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('stripeCount', Number.isFinite(v) ? v : h.stripeCount);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Stripe angle`)}
          min="-180"
          max="180"
          step="1"
          .value=${live(h.stripeAngle)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('stripeAngle', Number.isFinite(v) ? v : h.stripeAngle);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Distortion`)}
          min="0"
          max="4"
          step="0.01"
          .value=${live(h.distortion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('distortion', Number.isFinite(v) ? v : h.distortion);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Reflection`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.reflection)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('reflection', Number.isFinite(v) ? v : h.reflection);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Disturbance`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.disturbance)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('disturbance', Number.isFinite(v) ? v : h.disturbance);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Contortion`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.contortion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('contortion', Number.isFinite(v) ? v : h.contortion);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Dispersion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.dispersion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('dispersion', Number.isFinite(v) ? v : h.dispersion);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Drift`)}
          min="-1"
          max="1"
          step="0.01"
          .value=${live(h.drift)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('drift', Number.isFinite(v) ? v : h.drift);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Shadow`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.shadowIntensity)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('shadowIntensity', Number.isFinite(v) ? v : h.shadowIntensity);
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Offset`)}
          min="-0.5"
          max="0.5"
          step="0.001"
          .value=${live(h.offset)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          num('offset', Number.isFinite(v) ? v : h.offset);
        }}
        ></sp-slider>
        <sp-switch
          size="s"
          .checked=${live(h.blend > 0.5)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          this.patchEffect(effect, {
            blend: checked ? 1 : 0,
          });
        }}
        >${msg(str`Luminance blend (reflection)`)}
        </sp-switch>
      `;
    }
    if (effect.type === 'rain') {
      const h = effect as RainEffect;
      const patch = (partial: Partial<RainEffect>) => {
        this.patchEffect(effect, {
          ...partial,
          type: 'rain',
        });
      };

      if (isRainFxEffect(h)) {
        const RD = RAINDROP_FX_RENDER_DEFAULTS;
        const RC = RAINDROP_FX_COMPOSE_DEFAULTS;
        const fx = {
          backgroundBlurSteps:
            h.rainFx?.backgroundBlurSteps ?? RD.backgroundBlurSteps,
          mist: h.rainFx?.mist ?? RD.mist,
          mistBlurStep: h.rainFx?.mistBlurStep ?? RD.mistBlurStep,
          mistTime: h.rainFx?.mistTime ?? RD.mistTime,
          dropletsPerSecond:
            h.rainFx?.dropletsPerSecond ?? RD.dropletsPerSecond,
          dropletSize: h.rainFx?.dropletSize ?? [...RD.dropletSize],
          smoothRaindrop: h.rainFx?.smoothRaindrop ?? [...RC.smoothRaindrop],
          refractBase: h.rainFx?.refractBase ?? RC.refractBase,
          refractScale: h.rainFx?.refractScale ?? RC.refractScale,
          raindropCompose: h.rainFx?.raindropCompose ?? RD.raindropCompose,
          backgroundWrapMode:
            h.rainFx?.backgroundWrapMode ?? RD.backgroundWrapMode,
          mistColor: h.rainFx?.mistColor ?? [...RD.mistColor],
          raindropEraserSize:
            h.rainFx?.raindropEraserSize ?? [...RD.raindropEraserSize],
          raindropLightPos: h.rainFx?.raindropLightPos ?? [...RC.raindropLightPos],
          raindropDiffuseLight:
            h.rainFx?.raindropDiffuseLight ?? [...RC.raindropDiffuseLight],
          raindropShadowOffset:
            h.rainFx?.raindropShadowOffset ?? RC.raindropShadowOffset,
          raindropSpecularLight:
            h.rainFx?.raindropSpecularLight ?? [...RC.raindropSpecularLight],
          raindropSpecularShininess:
            h.rainFx?.raindropSpecularShininess ?? RC.raindropSpecularShininess,
          raindropLightBump: h.rainFx?.raindropLightBump ?? RC.raindropLightBump,
        };
        const RS = RAINDROP_FX_SIM_DEFAULTS;
        const sim = {
          trailDistance: h.rainFxSim?.trailDistance ?? [...RS.trailDistance],
          gravity: h.rainFxSim?.gravity ?? RS.gravity,
          spawnLimit: h.rainFxSim?.spawnLimit ?? RS.spawnLimit,
          trailDropDensity: h.rainFxSim?.trailDropDensity ?? RS.trailDropDensity,
          trailSpread: h.rainFxSim?.trailSpread ?? RS.trailSpread,
          xShifting: h.rainFxSim?.xShifting ?? [...RS.xShifting],
          slipRate: h.rainFxSim?.slipRate ?? RS.slipRate,
        };
        const patchFx = (partial: RainFxParams) => {
          patch({ rainFx: partial });
        };
        const patchSim = (partial: RainFxSimParams) => {
          patch({ rainFxSim: partial });
        };
        const dropUrl =
          h.dropTextureUrl?.trim() || RAIN_DROPDROP_TEXTURE_DEFAULT;
        return html`
          <sp-textfield
            size="s"
            label=${msg(str`Drop sprite URL`)}
            .value=${live(dropUrl)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = e.target.value.trim();
              patch({
                dropTextureUrl: v || RAIN_DROPDROP_TEXTURE_DEFAULT,
              });
            }}
          ></sp-textfield>
          <sp-slider
            size="s"
            label=${msg(str`Background blur steps`)}
            min="0"
            max="6"
            step="1"
            .value=${live(fx.backgroundBlurSteps)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                backgroundBlurSteps: Number.isFinite(v)
                  ? Math.max(0, Math.round(v))
                  : fx.backgroundBlurSteps,
              });
            }}
          ></sp-slider>
          <sp-switch
            size="s"
            .checked=${live(fx.mist)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const checked =
                (e.target as { checked?: boolean }).checked === true;
              patchFx({ mist: checked });
            }}
            >${msg(str`Mist`)}</sp-switch
          >
          <sp-slider
            size="s"
            label=${msg(str`Mist blur step`)}
            min="1"
            max="8"
            step="1"
            .value=${live(fx.mistBlurStep)}
            editable
            ?disabled=${!fx.mist}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                mistBlurStep: Number.isFinite(v)
                  ? Math.max(1, Math.round(v))
                  : fx.mistBlurStep,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Mist fade time (s)`)}
            min="1"
            max="30"
            step="0.5"
            .value=${live(fx.mistTime)}
            editable
            ?disabled=${!fx.mist}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                mistTime: Number.isFinite(v)
                  ? Math.max(0.1, v)
                  : fx.mistTime,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Mist color R`)}
            min="0"
            max="1"
            step="0.001"
            .value=${live(fx.mistColor[0])}
            editable
            ?disabled=${!fx.mist}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'mistColor',
                  index: 0,
                  value: v,
                  fallback: fx.mistColor,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Mist color G`)}
            min="0"
            max="1"
            step="0.001"
            .value=${live(fx.mistColor[1])}
            editable
            ?disabled=${!fx.mist}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'mistColor',
                  index: 1,
                  value: v,
                  fallback: fx.mistColor,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Mist color B`)}
            min="0"
            max="1"
            step="0.001"
            .value=${live(fx.mistColor[2])}
            editable
            ?disabled=${!fx.mist}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'mistColor',
                  index: 2,
                  value: v,
                  fallback: fx.mistColor,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Mist color A`)}
            min="0"
            max="1"
            step="0.001"
            .value=${live(fx.mistColor[3])}
            editable
            ?disabled=${!fx.mist}
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'mistColor',
                  index: 3,
                  value: v,
                  fallback: fx.mistColor,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Droplets per second`)}
            min="0"
            max="1500"
            step="10"
            .value=${live(fx.dropletsPerSecond)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                dropletsPerSecond: Number.isFinite(v)
                  ? Math.max(0, v)
                  : fx.dropletsPerSecond,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Droplet size min`)}
            min="1"
            max="60"
            step="1"
            .value=${live(fx.dropletSize[0])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'dropletSize',
                  index: 0,
                  value: v,
                  fallback: fx.dropletSize,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Droplet size max`)}
            min="1"
            max="60"
            step="1"
            .value=${live(fx.dropletSize[1])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'dropletSize',
                  index: 1,
                  value: v,
                  fallback: fx.dropletSize,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Smooth raindrop min`)}
            min="0.9"
            max="1"
            step="0.001"
            .value=${live(fx.smoothRaindrop[0])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'smoothRaindrop',
                  index: 0,
                  value: v,
                  fallback: fx.smoothRaindrop,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Smooth raindrop max`)}
            min="0.9"
            max="1"
            step="0.001"
            .value=${live(fx.smoothRaindrop[1])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'smoothRaindrop',
                  index: 1,
                  value: v,
                  fallback: fx.smoothRaindrop,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Refraction base`)}
            min="0"
            max="1"
            step="0.01"
            .value=${live(fx.refractBase)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                refractBase: Number.isFinite(v) ? v : fx.refractBase,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Refraction scale`)}
            min="0"
            max="2"
            step="0.01"
            .value=${live(fx.refractScale)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                refractScale: Number.isFinite(v) ? v : fx.refractScale,
              });
            }}
          ></sp-slider>
          <sp-field-label size="s">${msg(str`Background wrap`)}</sp-field-label>
          <sp-picker
            size="s"
            .value=${live(fx.backgroundWrapMode)}
            @change=${(e: Event & { target: { value: string } }) => {
              const mode = e.target.value;
              if (mode === 'clamp' || mode === 'repeat' || mode === 'mirror') {
                patchFx({ backgroundWrapMode: mode as RaindropFxBackgroundWrapMode });
              }
            }}
          >
            <sp-menu-item value="clamp">${msg(str`Clamp`)}</sp-menu-item>
            <sp-menu-item value="repeat">${msg(str`Repeat`)}</sp-menu-item>
            <sp-menu-item value="mirror">${msg(str`Mirror`)}</sp-menu-item>
          </sp-picker>
          <sp-slider
            size="s"
            label=${msg(str`Eraser size min`)}
            min="0.85"
            max="1"
            step="0.001"
            .value=${live(fx.raindropEraserSize[0])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'raindropEraserSize',
                  index: 0,
                  value: v,
                  fallback: fx.raindropEraserSize,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Eraser size max`)}
            min="0.85"
            max="1"
            step="0.001"
            .value=${live(fx.raindropEraserSize[1])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'raindropEraserSize',
                  index: 1,
                  value: v,
                  fallback: fx.raindropEraserSize,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-field-label size="s">${msg(str`Compose mode`)}</sp-field-label>
          <sp-picker
            size="s"
            .value=${live(fx.raindropCompose)}
            @change=${(e: Event & { target: { value: string } }) => {
              const mode = e.target.value;
              if (mode === 'smoother' || mode === 'harder') {
                patchFx({ raindropCompose: mode });
              }
            }}
          >
            <sp-menu-item value="smoother">${msg(str`Smoother`)}</sp-menu-item>
            <sp-menu-item value="harder">${msg(str`Harder`)}</sp-menu-item>
          </sp-picker>
          <sp-field-label size="s">${msg(str`Lighting`)}</sp-field-label>
          <sp-slider
            size="s"
            label=${msg(str`Light X`)}
            min="-3"
            max="3"
            step="0.01"
            .value=${live(fx.raindropLightPos[0])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'raindropLightPos',
                  index: 0,
                  value: v,
                  fallback: fx.raindropLightPos,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Light Y`)}
            min="-3"
            max="3"
            step="0.01"
            .value=${live(fx.raindropLightPos[1])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'raindropLightPos',
                  index: 1,
                  value: v,
                  fallback: fx.raindropLightPos,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Light Z`)}
            min="-3"
            max="8"
            step="0.01"
            .value=${live(fx.raindropLightPos[2])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'raindropLightPos',
                  index: 2,
                  value: v,
                  fallback: fx.raindropLightPos,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Diffuse`)}
            min="0"
            max="1"
            step="0.01"
            .value=${live(fx.raindropDiffuseLight[0])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFx',
                  key: 'raindropDiffuseLight',
                  index: 0,
                  value: v,
                  fallback: fx.raindropDiffuseLight,
                  range: false,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Shadow offset`)}
            min="0"
            max="2"
            step="0.01"
            .value=${live(fx.raindropShadowOffset)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                raindropShadowOffset: Number.isFinite(v)
                  ? v
                  : fx.raindropShadowOffset,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Specular shininess`)}
            min="1"
            max="512"
            step="1"
            .value=${live(fx.raindropSpecularShininess)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                raindropSpecularShininess: Number.isFinite(v)
                  ? Math.max(1, Math.round(v))
                  : fx.raindropSpecularShininess,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Light bump`)}
            min="0"
            max="4"
            step="0.01"
            .value=${live(fx.raindropLightBump)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchFx({
                raindropLightBump: Number.isFinite(v) ? v : fx.raindropLightBump,
              });
            }}
          ></sp-slider>
          <sp-field-label size="s">${msg(str`Simulation`)}</sp-field-label>
          <sp-slider
            size="s"
            label=${msg(str`Trail distance min`)}
            min="5"
            max="80"
            step="1"
            .value=${live(sim.trailDistance[0])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFxSim',
                  key: 'trailDistance',
                  index: 0,
                  value: v,
                  fallback: sim.trailDistance,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Trail distance max`)}
            min="5"
            max="80"
            step="1"
            .value=${live(sim.trailDistance[1])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFxSim',
                  key: 'trailDistance',
                  index: 1,
                  value: v,
                  fallback: sim.trailDistance,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Gravity`)}
            min="500"
            max="5000"
            step="50"
            .value=${live(sim.gravity)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchSim({
                gravity: Number.isFinite(v) ? v : sim.gravity,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Wind drift min`)}
            min="0"
            max="0.5"
            step="0.01"
            .value=${live(sim.xShifting[0])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFxSim',
                  key: 'xShifting',
                  index: 0,
                  value: v,
                  fallback: sim.xShifting,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Wind drift max`)}
            min="0"
            max="0.5"
            step="0.01"
            .value=${live(sim.xShifting[1])}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              void this.commit(
                {
                  kind: 'tuple',
                  group: 'rainFxSim',
                  key: 'xShifting',
                  index: 1,
                  value: v,
                  fallback: sim.xShifting,
                  range: true,
                },
                effect,
              );
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Slip rate`)}
            min="0"
            max="1"
            step="0.01"
            .value=${live(sim.slipRate)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchSim({
                slipRate: Number.isFinite(v) ? v : sim.slipRate,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Spawn limit`)}
            min="100"
            max="5000"
            step="50"
            .value=${live(sim.spawnLimit)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchSim({
                spawnLimit: Number.isFinite(v)
                  ? Math.max(1, Math.round(v))
                  : sim.spawnLimit,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Trail drop density`)}
            min="0"
            max="1"
            step="0.01"
            .value=${live(sim.trailDropDensity)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchSim({
                trailDropDensity: Number.isFinite(v)
                  ? v
                  : sim.trailDropDensity,
              });
            }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Trail spread`)}
            min="0"
            max="1"
            step="0.01"
            .value=${live(sim.trailSpread)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patchSim({
                trailSpread: Number.isFinite(v) ? v : sim.trailSpread,
              });
            }}
          ></sp-slider>
        `;
      }

      if (!isRainCodropsRainEffect(h)) {
        return html``;
      }

      const D = RAINDROPS_WATER_DEFAULTS;
      const cw = {
        minRefraction: h.codropsWater?.minRefraction ?? D.minRefraction,
        maxRefraction: h.codropsWater?.maxRefraction ?? D.maxRefraction,
        brightness: h.codropsWater?.brightness ?? D.brightness,
        alphaMultiply: h.codropsWater?.alphaMultiply ?? D.alphaMultiply,
        alphaSubtract: h.codropsWater?.alphaSubtract ?? D.alphaSubtract,
        renderShadow: h.codropsWater?.renderShadow ?? D.renderShadow,
        renderShine: h.codropsWater?.renderShine ?? D.renderShine,
      };
      const patchCw = (partial: RainCodropsWaterParams) => {
        patch({ codropsWater: partial });
      };
      const SD = RAINDROPS_SIM_DEFAULTS;
      const cs = {
        rainChance: h.codropsSim?.rainChance ?? SD.rainChance,
        rainLimit: h.codropsSim?.rainLimit ?? SD.rainLimit,
        maxDrops: h.codropsSim?.maxDrops ?? SD.maxDrops,
        dropletsRate: h.codropsSim?.dropletsRate ?? SD.dropletsRate,
      };
      const patchCs = (partial: RainCodropsSimParams) => {
        patch({ codropsSim: partial });
      };
      return html`
          <sp-slider
            size="s"
            label=${msg(str`Min refraction`)}
            min="0"
            max="2000"
            step="1"
            .value=${live(cw.minRefraction)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCw({
            minRefraction: Number.isFinite(v) ? v : cw.minRefraction,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Max refraction`)}
            min="0"
            max="2000"
            step="1"
            .value=${live(cw.maxRefraction)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCw({
            maxRefraction: Number.isFinite(v) ? v : cw.maxRefraction,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Brightness`)}
            min="0"
            max="4"
            step="0.01"
            .value=${live(cw.brightness)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCw({ brightness: Number.isFinite(v) ? v : cw.brightness });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Alpha multiply`)}
            min="0"
            max="80"
            step="0.5"
            .value=${live(cw.alphaMultiply)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCw({
            alphaMultiply: Number.isFinite(v) ? v : cw.alphaMultiply,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Alpha subtract`)}
            min="0"
            max="40"
            step="0.5"
            .value=${live(cw.alphaSubtract)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCw({
            alphaSubtract: Number.isFinite(v) ? v : cw.alphaSubtract,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Sim scale`)}
            min="0.25"
            max="4"
            step="0.05"
            .value=${live(h.rainSimScale ?? 1)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({
            rainSimScale: Number.isFinite(v) ? Math.max(0.05, v) : 1,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Rain chance`)}
            min="0"
            max="1"
            step="0.01"
            .value=${live(cs.rainChance)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCs({
            rainChance: Number.isFinite(v)
              ? Math.max(0, Math.min(1, v))
              : cs.rainChance,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Rain limit (per frame)`)}
            min="0"
            max="20"
            step="1"
            .value=${live(cs.rainLimit)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCs({
            rainLimit: Number.isFinite(v) ? Math.max(0, v) : cs.rainLimit,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Max drops`)}
            min="50"
            max="3000"
            step="50"
            .value=${live(cs.maxDrops)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCs({
            maxDrops: Number.isFinite(v)
              ? Math.max(1, Math.round(v))
              : cs.maxDrops,
          });
        }}
          ></sp-slider>
          <sp-slider
            size="s"
            label=${msg(str`Droplets rate`)}
            min="0"
            max="200"
            step="1"
            .value=${live(cs.dropletsRate)}
            editable
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patchCs({
            dropletsRate: Number.isFinite(v)
              ? Math.max(0, v)
              : cs.dropletsRate,
          });
        }}
          ></sp-slider>
          <sp-switch
            size="s"
            .checked=${live(cw.renderShadow)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patchCw({ renderShadow: checked });
        }}
            >${msg(str`Render shadow`)}</sp-switch
          >
          <sp-switch
            size="s"
            .checked=${live(cw.renderShine)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patchCw({ renderShine: checked });
        }}
            >${msg(str`Render shine`)}</sp-switch
          >
        `;
    }
    if (isBurnEffect(effect)) {
      const h = effect as unknown as BurnEffect;
      const patch = (partial: Partial<BurnEffect>) => {
        this.patchEffect(effect, { ...partial, type: 'burn' });
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Burn amount`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.burn)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ burn: Number.isFinite(v) ? v : h.burn });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Density`)}
          min="0.01"
          max="4"
          step="0.01"
          .value=${live(h.density)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ density: Number.isFinite(v) ? v : h.density });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Softness`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.softness)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ softness: Number.isFinite(v) ? v : h.softness });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Dispersion`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.dispersion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ dispersion: Number.isFinite(v) ? v : h.dispersion });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`UV distortion`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.distortion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
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
          .checked=${live(h.invertMask)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ invertMask: checked });
        }}
        >${msg(str`Invert mask`)}</sp-switch
        >
        <sp-switch
          size="s"
          .checked=${live(h.transparent)}
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
        this.patchEffect(effect, { ...partial, type: 'liquidMetal' });
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Repetition`)}
          min="1"
          max="10"
          step="0.1"
          .value=${live(h.repetition)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
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
          .value=${live(h.softness)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ softness: Number.isFinite(v) ? v : h.softness });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Shift red`)}
          min="-30"
          max="30"
          step="0.5"
          .value=${live(h.shiftRed)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ shiftRed: Number.isFinite(v) ? v : h.shiftRed });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Shift blue`)}
          min="-30"
          max="30"
          step="0.5"
          .value=${live(h.shiftBlue)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ shiftBlue: Number.isFinite(v) ? v : h.shiftBlue });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Distortion`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.distortion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ distortion: Number.isFinite(v) ? v : h.distortion });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Contour`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.contour)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ contour: Number.isFinite(v) ? v : h.contour });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle (°)`)}
          min="-180"
          max="180"
          step="1"
          .value=${live(h.angle)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ angle: Number.isFinite(v) ? v : h.angle });
        }}
        ></sp-slider>
        <sp-picker
          size="s"
          label=${msg(str`Shape (no image)`)}
          .value=${live(String(h.shape))}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = Number(e.target.value);
          if (!['0','1','2','3','4'].includes(e.target.value)) { this.requestUpdate(); return; }
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
          .checked=${live(h.useImage)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ useImage: checked });
        }}
        >${msg(str`Use layer as mask`)}</sp-switch
        >
        ${h.useImage
          ? html`<sp-switch
            size="s"
            .checked=${live(h.usePoisson !== false)}
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
            .checked=${live(!!h.useEngineTime)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          patch({ useEngineTime: checked });
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
          .value=${live(h.time)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patch({ time: Number.isFinite(v) ? v : h.time });
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isHeatmapEffect(effect)) {
      const h = effect as unknown as HeatmapEffect;
      const patch = (partial: Partial<HeatmapEffect>) => {
        this.patchEffect(effect, {
          ...partial,
          type: 'heatmap',
        });
      };
      const palette = h.colors?.length ? h.colors : [...HEATMAP_DEFAULTS.colors];
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Contour`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.contour)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ contour: Number.isFinite(v) ? v : h.contour });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle (°)`)}
          min="-180"
          max="180"
          step="1"
          .value=${live(h.angle)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ angle: Number.isFinite(v) ? v : h.angle });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Noise`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.noise)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ noise: Number.isFinite(v) ? v : h.noise });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Inner glow`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.innerGlow)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ innerGlow: Number.isFinite(v) ? v : h.innerGlow });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Outer glow`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.outerGlow)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ outerGlow: Number.isFinite(v) ? v : h.outerGlow });
        }}
        ></sp-slider>
        <sp-switch
          size="s"
          .checked=${live(h.useImage)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ useImage: checked });
        }}
        >${msg(str`Use layer as mask`)}</sp-switch
        >
        ${h.useImage
          ? html`<sp-switch
            size="s"
            .checked=${live(h.usePreprocess !== false)}
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
                  void this.commit({ kind: 'color-stop', action: 'set', index: ci, value: v }, effect);
                });
              },
            )}
              <sp-action-button
                quiet
                size="s"
                label=${msg(str`Remove`)}
                ?disabled=${palette.length <= 1}
                @click=${() => {
                void this.commit({ kind: 'color-stop', action: 'remove', index: ci }, effect);
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
          void this.commit({ kind: 'color-stop', action: 'add' }, effect);
        }}
          ?disabled=${palette.length >= 10}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
          ${msg(str`Add stop`)}
        </sp-action-button>
        <div class="row-head">
          <sp-switch
            size="s"
            .checked=${live(!!h.useEngineTime)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          patch({ useEngineTime: checked });
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
          .value=${live(h.time)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              patch({ time: Number.isFinite(v) ? v : h.time });
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isGemSmokeEffect(effect)) {
      const h = effect as unknown as GemSmokeEffect;
      const patch = (partial: Partial<GemSmokeEffect>) => {
        this.patchEffect(effect, {
          ...partial,
          type: 'gemSmoke',
        });
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
          .value=${live(h.innerDistortion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
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
          .value=${live(h.outerDistortion)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
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
          .value=${live(h.outerGlow)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ outerGlow: Number.isFinite(v) ? v : h.outerGlow });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Inner glow`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.innerGlow)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ innerGlow: Number.isFinite(v) ? v : h.innerGlow });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Offset`)}
          min="-1"
          max="1"
          step="0.01"
          .value=${live(h.offset)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ offset: Number.isFinite(v) ? v : h.offset });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Angle (°)`)}
          min="-180"
          max="180"
          step="1"
          .value=${live(h.angle)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ angle: Number.isFinite(v) ? v : h.angle });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Size`)}
          min="0"
          max="2"
          step="0.01"
          .value=${live(h.size)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          patch({ size: Number.isFinite(v) ? v : h.size });
        }}
        ></sp-slider>
        <sp-picker
          size="s"
          label=${msg(str`Shape (no image)`)}
          .value=${live(String(h.shape))}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = Number(e.target.value);
          if (!['0','1','2','3','4'].includes(e.target.value)) { this.requestUpdate(); return; }
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
          .checked=${live(h.useImage)}
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as { checked?: boolean }).checked === true;
          patch({ useImage: checked });
        }}
        >${msg(str`Use layer as mask`)}</sp-switch
        >
        ${h.useImage
          ? html`<sp-switch
            size="s"
            .checked=${live(h.usePoisson !== false)}
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
                  void this.commit({ kind: 'color-stop', action: 'set', index: ci, value: v }, effect);
                });
              },
            )}
              <sp-action-button
                quiet
                size="s"
                label=${msg(str`Remove`)}
                ?disabled=${smPalette.length <= 1}
                @click=${() => {
                void this.commit({ kind: 'color-stop', action: 'remove', index: ci }, effect);
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
          void this.commit({ kind: 'color-stop', action: 'add' }, effect);
        }}
          ?disabled=${smPalette.length >= 6}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
          ${msg(str`Add color`)}
        </sp-action-button>
        <div class="row-head">
          <sp-switch
            size="s"
            .checked=${live(!!h.useEngineTime)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          patch({ useEngineTime: checked });
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
          .value=${live(h.time)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
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
          .value=${live(h.curvature)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            curvature: Number.isFinite(v) ? v : h.curvature,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Line width`)}
          min="0"
          max="10"
          step="0.1"
          .value=${live(h.lineWidth)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            lineWidth: Number.isFinite(v) ? v : h.lineWidth,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Line contrast`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.lineContrast)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            lineContrast: Number.isFinite(v) ? v : h.lineContrast,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Vertical scanlines`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.verticalLine)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            verticalLine: Number.isFinite(v) ? v : h.verticalLine,
          });
        }}
        ></sp-slider>
        <div class="row-head">
          <sp-switch
            size="s"
            .checked=${live(!!h.useEngineTime)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          this.patchEffect(effect, {
            useEngineTime: checked,
          });
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
          .value=${live(h.time)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              this.patchEffect(effect, {
                time: Number.isFinite(v) ? v : h.time,
              });
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
          .value=${live(h.jitter)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            jitter: Number.isFinite(v) ? v : h.jitter,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Blocks`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.blocks)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            blocks: Number.isFinite(v) ? v : h.blocks,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`RGB split`)}
          min="0"
          max="0.5"
          step="0.05"
          .value=${live(h.rgbSplit)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            rgbSplit: Number.isFinite(v) ? v : h.rgbSplit,
          });
        }}
        ></sp-slider>
        <div class="row-head">
          <sp-switch
            size="s"
            .checked=${live(!!h.useEngineTime)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          this.patchEffect(effect, {
            useEngineTime: checked,
          });
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
          .value=${live(h.time)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
              if (!Number.isFinite(v)) {
                this.requestUpdate();
                return;
              }
              this.patchEffect(effect, {
                time: Number.isFinite(v) ? v : h.time,
              });
            }}
        ></sp-slider>
      `}
      `;
    }
    if (isLiquidGlassEffect(effect)) {
      const h = effect as unknown as LiquidGlassEffect;
      const patch = (partial: Partial<LiquidGlassEffect>) => {
        this.patchEffect(effect, { ...partial });
      };
      const num = (
        e: Event & { target: HTMLInputElement },
        cur: number,
        fn: (v: number) => Partial<LiquidGlassEffect>,
      ) => {
        const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
        if (!Number.isFinite(v)) {
          this.requestUpdate();
          return;
        }
        patch(Number.isFinite(v) ? fn(v) : fn(cur));
      };
      return html`
        <sp-slider
          size="s"
          label=${msg(str`Superellipse power`)}
          min="2"
          max="16"
          step="0.1"
          .value=${live(h.powerFactor)}
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
          .value=${live(h.ellipseSizeX ?? 1)}
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
          .value=${live(h.ellipseSizeY ?? 1)}
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
          .value=${live(h.fPower)}
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
          .value=${live(h.noise)}
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
          .value=${live(h.glowWeight)}
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
          .value=${live(h.glowBias)}
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
          .value=${live(h.glowEdge0)}
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
          .value=${live(h.glowEdge1)}
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
          .value=${live(h.centerX)}
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
          .value=${live(h.centerY)}
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
          .value=${live(h.scaleX)}
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
          .value=${live(h.scaleY)}
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
          .value=${live(h.size)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            size: Number.isFinite(v) ? v : h.size,
          });
        }}
        ></sp-slider>
        <sp-slider
          size="s"
          label=${msg(str`Amount`)}
          min="0"
          max="1"
          step="0.01"
          .value=${live(h.amount)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            amount: Number.isFinite(v) ? v : h.amount,
          });
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
          .value=${live(h.size)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, {
            size: Number.isFinite(v) ? Math.round(v) : h.size,
          });
        }}
        ></sp-slider>
        <div class="row-head">
          <sp-switch
            size="s"
            .checked=${live(h.replaceColor)}
            @change=${(e: Event & { target: HTMLInputElement }) => {
          const checked = (e.target as HTMLInputElement).checked;
          this.patchEffect(effect, {
            replaceColor: checked,
          });
        }}
            >${msg(str`Solid glyph color`)}</sp-switch
          >
        </div>
        ${h.replaceColor
          ? html`<sp-textfield
              size="s"
              label=${msg(str`Color`)}
              .value=${live(h.color)}
              @change=${(e: Event & { target: HTMLInputElement }) => {
              const v = e.target.value.trim();
              this.patchEffect(effect, { color: v || h.color });
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
        this.patchEffect(effect, { ...partial, type: 'lut' });
      };
      const keyOptions = this.lutKeyPickerOptions(h.lutKey);
      const pickerValue = keyOptions.includes(h.lutKey)
        ? h.lutKey
        : keyOptions[0]!;
      return html`
        <sp-picker
          size="s"
          label=${msg(str`LUT key`)}
          .value=${live(pickerValue)}
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
          .value=${live(h.strength)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
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
          .value=${live(effect.saturation)}
          editable
          @change=${(e: Event & { target: HTMLInputElement }) => {
          const v = String(e.target.value).trim() ? Number(e.target.value) : NaN;
          if (!Number.isFinite(v)) {
            this.requestUpdate();
            return;
          }
          this.patchEffect(effect, { saturation: v });
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
      <sp-action-button
        class="add-layer-cta"
        size="s"
        @click=${this.handleAddDefaultEffect}
      >
        ${msg(str`Add filter`)}
      </sp-action-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-effects-panel': EffectsPanel;
  }
}
