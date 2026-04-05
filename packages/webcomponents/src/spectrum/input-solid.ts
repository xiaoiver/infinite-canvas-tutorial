import { css, CSSResultArray, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import * as d3 from 'd3-color';
import { ColorArea } from '@spectrum-web-components/color-area';
import { parseColor, cssColorToHex } from '@infinite-canvas-tutorial/ecs';
import opacityCheckerBoardStyles from '@spectrum-web-components/opacity-checkerboard/src/opacity-checkerboard.css.js';

import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/slider/sp-slider.js';

export type SolidColorFormat = 'hex' | 'rgb' | 'css' | 'hsl' | 'hsb';

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

@customElement('ic-spectrum-input-solid')
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
    }

    .slider-row sp-color-slider {
      width: 100%
    }

    .opacity-slider-stack {
      position: relative;
      flex: 1;
      min-width: 0;
      min-inline-size: 0;
    }

    /* 与 sp-slider 轨道同宽的条带：棋盘格 + 透明→当前 RGB 的渐变 */
    .opacity-slider-stack .opacity-track-band {
      position: absolute;
      z-index: 0;
      /* 与 Spectrum slider 轨道左右缩进一致（手柄半径） */
      left: calc(var(--spectrum-slider-handle-size, 16px) / 2);
      right: calc(var(--spectrum-slider-handle-size, 16px) / 2);
      top: 50%;
      transform: translateY(-50%);
      block-size: var(--spectrum-slider-track-thickness, 10px);
      border-radius: var(--spectrum-slider-track-corner-radius, 999px);
      overflow: hidden;
      pointer-events: none;
    }

    .opacity-slider-stack .opacity-track-band.opacity-track-gradient {
      /* 叠在棋盘格之上：自左向右透明 → 当前 RGB 不透明 */
      background: linear-gradient(
        to right,
        rgb(0 0 0 / 0%),
        rgb(var(--opacity-slider-rgb, 255 255 255) / 100%)
      );
    }

    .opacity-slider-stack sp-slider {
      position: relative;
      z-index: 1;
      inline-size: 100%;
      --spectrum-slider-track-color: transparent;
      --spectrum-slider-track-fill-color: transparent;
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

  @state()
  private format: SolidColorFormat = 'hex';

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
      const prev = parseColor(this.value);
      this.emitSolid(rgb.r, rgb.g, rgb.b, prev.opacity);
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
    const out = A < 1 ? c.formatRgb() : c.formatHex();
    this.dispatchEvent(
      new CustomEvent('color-change', {
        detail: {
          type: 'solid',
          value: out,
        },
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
    const prev = parseColor(this.value);
    this.emitSolid(next.r, next.g, next.b, prev.opacity);
  }

  private handleRChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    this.emitSolid(v, p.g, p.b, p.opacity);
  }

  private handleGChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    this.emitSolid(p.r, v, p.b, p.opacity);
  }

  private handleBChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    this.emitSolid(p.r, p.g, v, p.opacity);
  }

  private handleOpacityPercentChanged(e: CustomEvent) {
    const pct = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    this.emitSolid(p.r, p.g, p.b, clamp01(pct / 100));
  }

  private handleOpacitySliderChanged(e: Event) {
    const t = e.currentTarget as HTMLElement & { value: number };
    const pct = Number(t.value);
    if (Number.isNaN(pct)) return;
    const p = parseColor(this.value);
    this.emitSolid(p.r, p.g, p.b, clamp01(pct / 100));
  }

  private handleCssChanged(e: CustomEvent) {
    const raw = (e.target as HTMLInputElement).value.trim();
    const parsed = parseColor(raw);
    this.emitSolid(parsed.r, parsed.g, parsed.b, parsed.opacity);
  }

  private handleHslHChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const hsl = d3.hsl(d3.rgb(p.r, p.g, p.b));
    const s = Number.isNaN(hsl.s) ? 0 : hsl.s;
    const l = Number.isNaN(hsl.l) ? 0 : hsl.l;
    const c = d3.rgb(d3.hsl(v, s, l));
    this.emitSolid(c.r, c.g, c.b, p.opacity);
  }

  private handleHslSChanged(e: CustomEvent) {
    const sPct = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const hsl = d3.hsl(d3.rgb(p.r, p.g, p.b));
    const h = Number.isNaN(hsl.h) ? 0 : hsl.h;
    const l = Number.isNaN(hsl.l) ? 0 : hsl.l;
    const c = d3.rgb(d3.hsl(h, clamp01(sPct / 100), l));
    this.emitSolid(c.r, c.g, c.b, p.opacity);
  }

  private handleHslLChanged(e: CustomEvent) {
    const lPct = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const hsl = d3.hsl(d3.rgb(p.r, p.g, p.b));
    const h = Number.isNaN(hsl.h) ? 0 : hsl.h;
    const s = Number.isNaN(hsl.s) ? 0 : hsl.s;
    const c = d3.rgb(d3.hsl(h, s, clamp01(lPct / 100)));
    this.emitSolid(c.r, c.g, c.b, p.opacity);
  }

  private handleHsbHChanged(e: CustomEvent) {
    const h = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const { s, v } = rgbToHsv(p.r, p.g, p.b);
    const { r, g, b } = hsvToRgb(h, s, v);
    this.emitSolid(r, g, b, p.opacity);
  }

  private handleHsbSChanged(e: CustomEvent) {
    const s = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const { h, v } = rgbToHsv(p.r, p.g, p.b);
    const { r, g, b } = hsvToRgb(h, s, v);
    this.emitSolid(r, g, b, p.opacity);
  }

  private handleHsbVChanged(e: CustomEvent) {
    const v = Number((e.target as HTMLElement & { value: number }).value);
    const p = parseColor(this.value);
    const { h, s } = rgbToHsv(p.r, p.g, p.b);
    const rgb = hsvToRgb(h, s, v);
    this.emitSolid(rgb.r, rgb.g, rgb.b, p.opacity);
  }

  render() {
    const p = parseColor(this.value);
    const r = clamp255(p.r);
    const g = clamp255(p.g);
    const b = clamp255(p.b);
    const a = clamp01(p.opacity);
    const opacityPct = Math.round(a * 100);
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
          <div
            class="opacity-slider-stack"
            style=${`--opacity-slider-rgb: ${r} ${g} ${b}`}
          >
            <div
              class="opacity-track-band opacity-checkerboard"
              aria-hidden="true"
            ></div>
            <div
              class="opacity-track-band opacity-track-gradient"
              aria-hidden="true"
            ></div>
            <sp-slider
              label-visibility="none"
              size="s"
              min="0"
              max="100"
              step="1"
              value=${opacityPct}
              aria-label="Opacity"
              @change=${this.handleOpacitySliderChanged}
            ></sp-slider>
          </div>
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
            value=${opacityPct}
            aria-label="Opacity percent"
            @change=${this.handleOpacityPercentChanged}
          ></sp-number-field>
          <span class="pct-suffix">%</span>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-solid': InputSolid;
  }
}
