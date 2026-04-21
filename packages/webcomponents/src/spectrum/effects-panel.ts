import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { consume } from '@lit/context';
import {
  AppState,
  parseEffect,
  ADJUSTMENT_DEFAULTS,
  formatFilter,
  isSaturateOnlyAdjustment,
  type Effect,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/switch/sp-switch.js';
import '@spectrum-web-components/textfield/sp-textfield.js';

/** Matches ecs `HalftoneDotsEffect` (filter `halftone-dots`). */
interface HalftoneDotsEffectRow {
  type: 'halftoneDots';
  size: number;
  radius: number;
  contrast: number;
  grid: number;
  dotStyle: number;
  originalColors?: boolean;
}

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

/** Mirrors ecs `CRT_DEFAULTS`. */
const CRT_PANEL_DEFAULTS = {
  curvature: 1,
  lineWidth: 1,
  lineContrast: 0.25,
  verticalLine: 0,
  time: 0,
  useEngineTime: false,
} as const;

type CrtEffectRow = { type: 'crt' } & typeof CRT_PANEL_DEFAULTS;

/** Matches ecs `VIGNETTE_DEFAULTS`. */
const VIGNETTE_PANEL_DEFAULTS = {
  type: 'vignette' as const,
  size: 0.5,
  amount: 0.5,
};

type VignetteEffectRow = typeof VIGNETTE_PANEL_DEFAULTS;

/** Matches ecs `ASCII_DEFAULTS` / Pixi ASCIIFilter. */
const ASCII_PANEL_DEFAULTS = {
  type: 'ascii' as const,
  size: 8,
  replaceColor: false,
  color: '#ffffff',
};

type AsciiEffectRow = typeof ASCII_PANEL_DEFAULTS;

/** Mirrors ecs `GLITCH_DEFAULTS`; `useEngineTime` defaults on so the effect animates. */
const GLITCH_PANEL_DEFAULTS = {
  type: 'glitch' as const,
  jitter: 0.45,
  blocks: 0,
  rgbSplit: 0.004,
  time: 0,
  useEngineTime: true,
} as const;

type GlitchEffectRow = typeof GLITCH_PANEL_DEFAULTS;

/** Mirrors ecs `LIQUID_GLASS_DEFAULTS` / `LiquidGlassEffect`. */
const LIQUID_GLASS_PANEL_DEFAULTS = {
  type: 'liquidGlass' as const,
  powerFactor: 4,
  fPower: 3,
  noise: 0.1,
  glowWeight: 0.3,
  glowBias: 0,
  glowEdge0: 0.06,
  glowEdge1: 0,
  a: 0.7,
  b: 2.3,
  c: 5.2,
  d: 6.9,
  centerX: 0.5,
  centerY: 0.5,
  scaleX: 1,
  scaleY: 1,
  ellipseSizeX: 1,
  ellipseSizeY: 1,
};

type LiquidGlassEffectRow = typeof LIQUID_GLASS_PANEL_DEFAULTS;

/** Mirrors ecs `FlutedGlassEffect` / {@link FLUTED_GLASS_DEFAULTS} for panel defaults. */
const FLUTED_GLASS_PANEL_DEFAULTS = {
  size: 0.5,
  shadows: 0.6,
  angle: 45,
  stretch: 0.2,
  shape: 1,
  distortion: 0.5,
  highlights: 0.4,
  distortionShape: 1,
  shift: 0,
  blur: 0.15,
  edges: 0.3,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  marginBottom: 0,
  grainMixer: 0,
  grainOverlay: 0,
} as const;

type FlutedGlassEffectRow = { type: 'flutedGlass' } & typeof FLUTED_GLASS_PANEL_DEFAULTS;

/** Picker / menu value for an effect row (maps `adjustment` from saturate to `saturate`). */
type EffectKind =
  | 'brightness'
  | 'contrast'
  | 'saturate'
  | 'noise'
  | 'fxaa'
  | 'blur'
  | 'pixelate'
  | 'dot'
  | 'colorHalftone'
  | 'halftoneDots'
  | 'flutedGlass'
  | 'crt'
  | 'vignette'
  | 'ascii'
  | 'glitch'
  | 'liquidGlass';

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

function createDefaultEffect(kind: EffectKind): Effect {
  switch (kind) {
    case 'brightness':
      return { type: 'brightness', value: 0 };
    case 'contrast':
      return { type: 'contrast', value: 0 };
    case 'noise':
      return { type: 'noise', value: 0.1 };
    case 'fxaa':
      return { type: 'fxaa' };
    case 'blur':
      return { type: 'blur', value: 4 };
    case 'pixelate':
      return { type: 'pixelate', size: 8 };
    case 'dot':
      return { type: 'dot', scale: 1, angle: 5, grayscale: 1 };
    case 'colorHalftone':
      return { type: 'colorHalftone', angle: 0, size: 5 };
    case 'halftoneDots':
      return {
        type: 'halftoneDots',
        size: 0.5,
        radius: 0.5,
        contrast: 0.5,
        grid: 0,
        dotStyle: 0,
        originalColors: true,
      } as unknown as Effect;
    case 'flutedGlass':
      return {
        type: 'flutedGlass',
        ...FLUTED_GLASS_PANEL_DEFAULTS,
      } as unknown as Effect;
    case 'crt':
      return {
        type: 'crt',
        ...CRT_PANEL_DEFAULTS,
      } as unknown as Effect;
    case 'vignette':
      return { ...VIGNETTE_PANEL_DEFAULTS } as unknown as Effect;
    case 'ascii':
      return { ...ASCII_PANEL_DEFAULTS } as unknown as Effect;
    case 'glitch':
      return { ...GLITCH_PANEL_DEFAULTS } as unknown as Effect;
    case 'liquidGlass':
      return { ...LIQUID_GLASS_PANEL_DEFAULTS } as unknown as Effect;
    case 'saturate':
      return {
        type: 'adjustment',
        ...ADJUSTMENT_DEFAULTS,
        saturation: 1.25,
      };
    default:
      return { type: 'brightness', value: 0 };
  }
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
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property({ type: Object })
  node: SerializedNode;

  @state()
  private effects: Effect[] = [];

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('node') && this.node) {
      const f = (this.node as { filter?: string }).filter ?? '';
      this.effects = f ? parseEffect(f) : [];
    }
  }

  private commit(next: Effect[]) {
    this.effects = next;
    this.api.updateNode(this.node, { filter: formatFilter(next) });
    this.api.record();
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
      const h = effect as unknown as HalftoneDotsEffectRow;
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
      const h = effect as unknown as FlutedGlassEffectRow;
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
    if (isCrtEffect(effect)) {
      const h = effect as unknown as CrtEffectRow;
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
          ? html`<span class="hint">${msg(str`Time uniform follows the app clock each frame.`)}</span>`
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
      const h = effect as unknown as GlitchEffectRow;
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
          ? html`<span class="hint">${msg(str`Time uniform follows the app clock each frame.`)}</span>`
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
      const h = effect as unknown as LiquidGlassEffectRow;
      const patch = (partial: Partial<LiquidGlassEffectRow>) => {
        const next = [...this.effects];
        next[index] = { ...h, ...partial } as unknown as Effect;
        this.commit(next);
      };
      const num = (
        e: Event & { target: HTMLInputElement },
        cur: number,
        fn: (v: number) => Partial<LiquidGlassEffectRow>,
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
      const h = effect as unknown as VignetteEffectRow;
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
      const h = effect as unknown as AsciiEffectRow;
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
