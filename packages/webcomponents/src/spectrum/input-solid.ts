import { css, CSSResultArray, html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { when } from 'lit/directives/when.js';
import * as d3 from 'd3-color';
import { ColorArea } from '@spectrum-web-components/color-area';
import {
  parseColor,
  cssColorToHex,
  resolveDesignVariableValue,
  isDesignVariableReference,
  designVariableRefKeyFromWire,
  type AppState,
} from '@infinite-canvas-tutorial/ecs';
import { appStateContext } from '../context';
import opacityCheckerBoardStyles from '@spectrum-web-components/opacity-checkerboard/src/opacity-checkerboard.css.js';
import { localized, msg, str } from '@lit/localize';
import type { DesignVariablePickDetail } from './design-variable-picker';
import './design-variable-picker.js';

import '@spectrum-web-components/action-button/sp-action-button.js';

export type SolidColorFormat = 'hex' | 'rgb' | 'css' | 'hsl' | 'hsb';

/** `opacity-change` 事件的 detail（滑块 / 百分比输入仅改透明度时触发）。 */
export type SolidOpacityChangeDetail = {
  opacity: number;
  fillOpacity?: number;
  strokeOpacity?: number;
};

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** H、S、V 均为 0–100（H 为角度 0–360，S/V 为百分比）。 */
function hsvToRgb(hDeg: number, sPct: number, vPct: number) {
  const h = ((hDeg % 360) + 360) % 360 / 360;
  const s = sPct / 100;
  const v = vPct / 100;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

function rgbToHsv(r255: number, g255: number, b255: number) {
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h: h * 360, s: s * 100, v: v * 100 };
}

/** 用户是否在 CSS 中显式写了 alpha（与仅写 #rgb / 命名色等区分）。 */
function cssStringHasExplicitAlpha(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (s === 'transparent') return true;
  if (/#[0-9a-f]{8}\b/i.test(s)) return true;
  if (/\b(rgba|hsla|hsba|hwba)\s*\(/i.test(s)) return true;
  if (/\b(?:rgb|hsl|hwb|color|lab|lch|oklab|oklch)\s*\([^)]*\/[^)]*\)/i.test(s)) {
    return true;
  }
  return false;
}

@customElement('ic-spectrum-input-solid')
@localized()
export class InputSolid extends LitElement {
  public static override get styles(): CSSResultArray {
    return [opacityCheckerBoardStyles, css`
    :host {
      display: flex;
      align-items: stretch;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
    }

    .format-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    /* 与「Hex / RGB …」文案宽度匹配，避免占满整行 */
    sp-picker.format-picker {
      --spectrum-picker-min-inline-size: 0;
      flex: 0 0 60px;
      width: 60px;
      max-width: 60px;
      min-width: 0;
      box-sizing: border-box;
    }

    .format-input {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .format-input sp-color-field {
      width: 134px;
      min-width: 0;
    }

    .format-input sp-textfield {
      width: 134px;
      min-width: 0;
    }

    .format-input sp-number-field {
      width: 42px;
      min-width: 0;
    }

    .rgb-inline,
    .hsl-inline,
    .hsb-inline {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      min-width: 0;
    }

    .rgb-inline sp-number-field,
    .hsl-inline sp-number-field,
    .hsb-inline sp-number-field {
      flex: 1;
      min-width: 0;
    }

    .opacity-group {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .opacity-group sp-number-field {
      width: 42px;
    }

    .pct-suffix {
      font-size: var(--spectrum-font-size-75, 12px);
      line-height: 1;
      opacity: 0.85;
    }

    sp-color-area {
      width: 265px;
      height: 265px;
      align-self: center;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    }

    .slider-row .color-opacity {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .slider-row sp-color-slider {
      width: 100%
    }

    sp-popover {
      padding: 0;
    }

    .dv-popover-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      box-sizing: border-box;
    }

    .dv-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .dv-badge {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-purple-900);
      background: var(--spectrum-purple-100);
      border-radius: 4px;
      padding: 2px 6px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .opacity-dv-trigger {
      flex: 0 0 auto;
    }

    .eyedropper-btn {
      flex: 0 0 auto;
    }

    .eyedropper-btn svg {
      display: block;
    }
    `];
  }

  @property()
  value: string;

  /**
   * 与 `strokeOpacity` 二选一或单独使用：存在时作为透明度来源（0–1），
   * 可为 `$token` 设计变量引用。不再从 `value` 的 alpha 解析。
   */
  @property()
  fillOpacity: number | string | undefined;

  /**
   * 与 `fillOpacity` 二选一：存在时作为透明度来源（0–1），可为 `$token`。
   * 若同时设置，优先使用 `fillOpacity`。
   */
  @property()
  strokeOpacity: number | string | undefined;

  /** 为 true 时在透明度旁显示「绑定变量」Popover（由填充/描边工具条使用） */
  @property({ type: Boolean, attribute: 'enable-opacity-variable-binding' })
  enableOpacityVariableBinding = false;

  @consume({ context: appStateContext, subscribe: true })
  appState!: AppState;

  @state()
  private format: SolidColorFormat = 'hex';

  /** 滑块 / 百分比框交互中的 0–100 预览，与 props 同步后清空。 */
  @state()
  private opacityPctOverride: number | undefined;

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    if (
      changedProperties.has('value') ||
      changedProperties.has('fillOpacity') ||
      changedProperties.has('strokeOpacity')
    ) {
      this.opacityPctOverride = undefined;
    }
  }

  /** 当前 UI 使用的透明度：优先外部属性（含变量解析），否则从 `value` 解析。 */
  private getEffectiveOpacity(): number {
    const ext = this.fillOpacity ?? this.strokeOpacity;
    if (ext !== undefined && ext !== null && ext !== '') {
      const resolved = resolveDesignVariableValue(
        ext as number | string,
        this.appState?.variables,
      );
      const n =
        typeof resolved === 'number'
          ? resolved
          : parseFloat(String(resolved ?? ''));
      if (Number.isFinite(n)) {
        return clamp01(n);
      }
    }
    return clamp01(parseColor(this.value).opacity);
  }

  private usesExternalOpacity(): boolean {
    return (
      this.fillOpacity !== undefined &&
      this.fillOpacity !== null &&
      this.fillOpacity !== ''
    ) ||
      (this.strokeOpacity !== undefined &&
        this.strokeOpacity !== null &&
        this.strokeOpacity !== '');
  }

  private getOpacityBindMode(): 'fill' | 'stroke' {
    if (
      this.fillOpacity !== undefined &&
      this.fillOpacity !== null &&
      this.fillOpacity !== ''
    ) {
      return 'fill';
    }
    return 'stroke';
  }

  private getOpacityWireRaw(): number | string | undefined {
    return this.fillOpacity ?? this.strokeOpacity;
  }

  private handleOpacityVariablePick(e: CustomEvent<DesignVariablePickDetail>) {
    this.dispatchEvent(
      new CustomEvent<{
        mode: 'fill' | 'stroke';
        key: string;
      }>('opacity-variable-pick', {
        detail: { mode: this.getOpacityBindMode(), key: e.detail.key },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleOpacityVariableUnbind() {
    this.dispatchEvent(
      new CustomEvent<{ mode: 'fill' | 'stroke' }>(
        'opacity-variable-unbind',
        {
          detail: { mode: this.getOpacityBindMode() },
          bubbles: true,
          composed: true,
        },
      ),
    );
  }

  private get eyeDropperSupported(): boolean {
    return typeof window !== 'undefined' && 'EyeDropper' in window;
  }

  private async handleEyedropper() {
    const E = (
      window as unknown as {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (!E) return;
    try {
      const result = await new E().open();
      const rgb = parseColor(result.sRGBHex);
      this.emitSolid(rgb.r, rgb.g, rgb.b, this.getEffectiveOpacity());
    } catch {
      /* 用户取消或权限失败 */
    }
  }

  private emitSolid(r: number, g: number, b: number, a: number) {
    const R = clamp255(r);
    const G = clamp255(g);
    const B = clamp255(b);
    const A = clamp01(a);
    const c = d3.rgb(R, G, B, A);
    const external = this.usesExternalOpacity();
    const out = external
      ? d3.rgb(R, G, B, 1).formatHex()
      : A < 1
        ? c.formatRgb()
        : c.formatHex();
    const detail: {
      type: 'solid';
      value: string;
      fillOpacity?: number;
      strokeOpacity?: number;
    } = {
      type: 'solid',
      value: out,
    };
    if (
      this.fillOpacity !== undefined &&
      this.fillOpacity !== null &&
      this.fillOpacity !== ''
    ) {
      detail.fillOpacity = A;
    }
    if (
      this.strokeOpacity !== undefined &&
      this.strokeOpacity !== null &&
      this.strokeOpacity !== ''
    ) {
      detail.strokeOpacity = A;
    }
    this.dispatchEvent(
      new CustomEvent('color-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitOpacityChange(a: number) {
    const A = clamp01(a);
    const detail: SolidOpacityChangeDetail = { opacity: A };
    if (
      this.fillOpacity !== undefined &&
      this.fillOpacity !== null &&
      this.fillOpacity !== ''
    ) {
      detail.fillOpacity = A;
    }
    if (
      this.strokeOpacity !== undefined &&
      this.strokeOpacity !== null &&
      this.strokeOpacity !== ''
    ) {
      detail.strokeOpacity = A;
    }
    this.dispatchEvent(
      new CustomEvent<SolidOpacityChangeDetail>('opacity-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleFormatChange(e: Event & { target: { value: string } }) {
    e.stopPropagation();
    this.format = e.target.value as SolidColorFormat;
  }

  /** 拾色器 / 滑块 / Hex 只改 RGB，保留当前透明度。 */
  private handlePickerRgbChanged(e: Event) {
    const t = e.target as ColorArea | { color: { toString(): string } };
    const next = parseColor(t.color.toString());
    this.emitSolid(next.r, next.g, next.b, this.getEffectiveOpacity());
  }

  private handleRChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    this.emitSolid(v, p.g, p.b, this.getEffectiveOpacity());
  }

  private handleGChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    this.emitSolid(p.r, v, p.b, this.getEffectiveOpacity());
  }

  private handleBChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    this.emitSolid(p.r, p.g, v, this.getEffectiveOpacity());
  }

  private handleOpacityPercentInput(e: CustomEvent) {
    const raw = Number((e.target as HTMLElement & { value: number }).value);
    if (Number.isNaN(raw)) return;
    this.opacityPctOverride = Math.max(0, Math.min(100, Math.round(raw)));
  }

  private handleOpacityPercentChanged(e: CustomEvent) {
    const pct = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const a = clamp01(pct / 100);
    this.emitOpacityChange(a);
    if (this.usesExternalOpacity()) {
      return;
    }
    this.emitSolid(p.r, p.g, p.b, a);
  }

  private handleCssChanged(e: CustomEvent) {
    const raw = (e.target as HTMLInputElement).value.trim();
    const parsed = parseColor(raw);
    const a =
      this.usesExternalOpacity() && !cssStringHasExplicitAlpha(raw)
        ? this.getEffectiveOpacity()
        : clamp01(parsed.opacity);
    this.emitSolid(parsed.r, parsed.g, parsed.b, a);
  }

  private handleHslHChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const hsl = d3.hsl(d3.rgb(p.r, p.g, p.b));
    const s = Number.isNaN(hsl.s) ? 0 : hsl.s;
    const l = Number.isNaN(hsl.l) ? 0 : hsl.l;
    const c = d3.rgb(d3.hsl(v, s, l));
    this.emitSolid(c.r, c.g, c.b, this.getEffectiveOpacity());
  }

  private handleHslSChanged(e: CustomEvent) {
    const sPct = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const hsl = d3.hsl(d3.rgb(p.r, p.g, p.b));
    const h = Number.isNaN(hsl.h) ? 0 : hsl.h;
    const l = Number.isNaN(hsl.l) ? 0 : hsl.l;
    const c = d3.rgb(d3.hsl(h, clamp01(sPct / 100), l));
    this.emitSolid(c.r, c.g, c.b, this.getEffectiveOpacity());
  }

  private handleHslLChanged(e: CustomEvent) {
    const lPct = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const hsl = d3.hsl(d3.rgb(p.r, p.g, p.b));
    const h = Number.isNaN(hsl.h) ? 0 : hsl.h;
    const s = Number.isNaN(hsl.s) ? 0 : hsl.s;
    const c = d3.rgb(d3.hsl(h, s, clamp01(lPct / 100)));
    this.emitSolid(c.r, c.g, c.b, this.getEffectiveOpacity());
  }

  private handleHsbHChanged(e: CustomEvent) {
    const h = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const { s, v } = rgbToHsv(p.r, p.g, p.b);
    const { r, g, b } = hsvToRgb(h, s, v);
    this.emitSolid(r, g, b, this.getEffectiveOpacity());
  }

  private handleHsbSChanged(e: CustomEvent) {
    const s = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const { h, v } = rgbToHsv(p.r, p.g, p.b);
    const { r, g, b } = hsvToRgb(h, s, v);
    this.emitSolid(r, g, b, this.getEffectiveOpacity());
  }

  private handleHsbVChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const { h, s } = rgbToHsv(p.r, p.g, p.b);
    const rgb = hsvToRgb(h, s, v);
    this.emitSolid(rgb.r, rgb.g, rgb.b, this.getEffectiveOpacity());
  }

  render() {
    const p = parseColor(this.value);
    const r = clamp255(p.r);
    const g = clamp255(p.g);
    const b = clamp255(p.b);
    const a = this.getEffectiveOpacity();
    const opacityPct = Math.round(a * 100);
    const displayOpacityPct =
      this.opacityPctOverride ?? opacityPct;
    const hex6 = d3.rgb(r, g, b, 1).formatHex();
    const pickerColor = cssColorToHex(this.value);

    const hsl = d3.hsl(d3.rgb(r, g, b));
    const hDeg = Number.isNaN(hsl.h) ? 0 : hsl.h;
    const sPct = Number.isNaN(hsl.s) ? 0 : Math.round(hsl.s * 100);
    const lPct = Number.isNaN(hsl.l) ? 0 : Math.round(hsl.l * 100);

    const hsv = rgbToHsv(r, g, b);
    const hsbH = Math.round(hsv.h);
    const hsbS = Math.round(hsv.s);
    const hsbV = Math.round(hsv.v);

    const cssDisplay = d3.rgb(r, g, b, a).formatRgb();

    const wire = this.getOpacityWireRaw();
    const opacityBound =
      typeof wire === 'string' && isDesignVariableReference(wire);

    const fmtRgb = () => html`
      <div class="rgb-inline">
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="255"
          step="1"
          value=${r}
          aria-label="R"
          @change=${this.handleRChanged}
        ></sp-number-field>
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="255"
          step="1"
          value=${g}
          aria-label="G"
          @change=${this.handleGChanged}
        ></sp-number-field>
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="255"
          step="1"
          value=${b}
          aria-label="B"
          @change=${this.handleBChanged}
        ></sp-number-field>
      </div>
    `;

    const fmtHsl = () => html`
      <div class="hsl-inline">
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="360"
          step="1"
          value=${Math.round(hDeg)}
          aria-label="H"
          @change=${this.handleHslHChanged}
        ></sp-number-field>
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="100"
          step="1"
          value=${sPct}
          aria-label="S"
          @change=${this.handleHslSChanged}
        ></sp-number-field>
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="100"
          step="1"
          value=${lPct}
          aria-label="L"
          @change=${this.handleHslLChanged}
        ></sp-number-field>
      </div>
    `;

    const fmtHsb = () => html`
      <div class="hsb-inline">
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="360"
          step="1"
          value=${hsbH}
          aria-label="H"
          @change=${this.handleHsbHChanged}
        ></sp-number-field>
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="100"
          step="1"
          value=${hsbS}
          aria-label="S"
          @change=${this.handleHsbSChanged}
        ></sp-number-field>
        <sp-number-field
          size="s"
          hide-stepper
          min="0"
          max="100"
          step="1"
          value=${hsbV}
          aria-label="B"
          @change=${this.handleHsbVChanged}
        ></sp-number-field>
      </div>
    `;

    return html`<sp-color-area
        color=${pickerColor}
        @input=${this.handlePickerRgbChanged}
      ></sp-color-area>
      <div class="slider-row">
        <div class="color-opacity">
          <sp-color-slider
            color=${pickerColor}
            @input=${this.handlePickerRgbChanged}
          ></sp-color-slider>
        </div>
        ${when(
      this.eyeDropperSupported,
      () => html`
            <sp-action-button
              class="eyedropper-btn"
              quiet
              size="s"
              aria-label="Pick color from screen"
              @click=${this.handleEyedropper}
            >
              <svg 
                slot="icon"
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M15 1c-1.8-1.8-3.7-0.7-4.6 0.1-0.4 0.4-0.7 0.9-0.7 1.5v0c0 1.1-1.1 1.8-2.1 1.5l-0.1-0.1-0.7 0.8 0.7 0.7-6 6-0.8 2.3-0.7 0.7 1.5 1.5 0.8-0.8 2.3-0.8 6-6 0.7 0.7 0.7-0.6-0.1-0.2c-0.3-1 0.4-2.1 1.5-2.1v0c0.6 0 1.1-0.2 1.4-0.6 0.9-0.9 2-2.8 0.2-4.6zM3.9 13.6l-2 0.7-0.2 0.1 0.1-0.2 0.7-2 5.8-5.8 1.5 1.5-5.9 5.7z"></path> 
              </svg>
            </sp-action-button>
          `,
    )}
      </div>
      <div class="format-row">
        <sp-picker
          class="format-picker"
          size="s"
          value=${this.format}
          @change=${this.handleFormatChange}
        >
          <sp-menu-item value="hex">Hex</sp-menu-item>
          <sp-menu-item value="rgb">RGB</sp-menu-item>
          <sp-menu-item value="css">CSS</sp-menu-item>
          <sp-menu-item value="hsl">HSL</sp-menu-item>
          <sp-menu-item value="hsb">HSB</sp-menu-item>
        </sp-picker>
        <div class="format-input">
          ${when(
      this.format === 'hex',
      () => html`
              <sp-color-field
                size="s"
                value=${hex6}
                @input=${this.handlePickerRgbChanged}
              ></sp-color-field>
            `,
    )}
          ${when(this.format === 'rgb', fmtRgb)}
          ${when(
      this.format === 'css',
      () => html`
              <sp-textfield
                size="s"
                value=${cssDisplay}
                @change=${this.handleCssChanged}
              ></sp-textfield>
            `,
    )}
          ${when(this.format === 'hsl', fmtHsl)}
          ${when(this.format === 'hsb', fmtHsb)}
        </div>
        <div class="opacity-group">
          <sp-number-field
            size="s"
            hide-stepper
            min="0"
            max="100"
            step="1"
            value=${displayOpacityPct}
            aria-label="Opacity percent"
            @input=${this.handleOpacityPercentInput}
            @change=${this.handleOpacityPercentChanged}
          ></sp-number-field>
          <span class="pct-suffix">%</span>
        </div>
        ${when(
      this.enableOpacityVariableBinding && this.usesExternalOpacity(),
      () => html`
            <sp-action-button
              class="opacity-dv-trigger"
              quiet
              size="s"
              id="input-solid-opacity-dv-trigger"
            >
              <sp-icon-link slot="icon"></sp-icon-link>
              <sp-tooltip self-managed placement="bottom">
                ${msg(str`绑定透明度变量`)}
              </sp-tooltip>
            </sp-action-button>
            <sp-overlay
              trigger="input-solid-opacity-dv-trigger@click"
              placement="bottom"
              type="auto"
            >
              <sp-popover dialog>
                <div class="dv-popover-body">
                  ${when(
        opacityBound,
        () =>
          html`<div class="dv-row">
                        <span class="dv-badge" title=${String(wire)}
                          >${String(wire)}</span
                        >
                        <sp-action-button
                          quiet
                          size="s"
                          @click=${this.handleOpacityVariableUnbind}
                        >
                          <sp-icon-unlink slot="icon"></sp-icon-unlink>
                          <sp-tooltip self-managed placement="right">
                            ${msg(str`解除绑定`)}
                          </sp-tooltip>
                        </sp-action-button>
                      </div>`,
      )}
                  <ic-spectrum-design-variable-picker
                    match-type="number"
                    selected-key=${designVariableRefKeyFromWire(wire)}
                    @ic-variable-pick=${this.handleOpacityVariablePick}
                  ></ic-spectrum-design-variable-picker>
                </div>
              </sp-popover>
            </sp-overlay>
          `,
    )}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-solid': InputSolid;
  }
}
