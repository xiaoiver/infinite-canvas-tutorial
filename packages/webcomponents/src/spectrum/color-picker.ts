import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { cssColorToHex, isGradient, isUrl, isDataUrl } from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';
import './input-image.js';

export enum ColorType {
  None = 'none',
  Solid = 'solid',
  Gradient = 'gradient',
  Image = 'image',
}

export type ColorPickerChangeDetail = {
  type: ColorType;
  value: string;
  /** 与 `ic-spectrum-input-solid` 一致：由父组件传入并回传。 */
  fillOpacity?: number;
  strokeOpacity?: number;
};

/** Spectrum `sp-action-group` host exposes `selected`. */
interface SpActionGroupElement extends HTMLElement {
  selected: string[];
}

/** Detail from `ic-spectrum-input-solid` / `ic-spectrum-input-gradient`. */
type ChildColorChangeDetail = {
  type: string;
  value: string;
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
};

function isColorType(s: string): s is ColorType {
  return (Object.values(ColorType) as string[]).includes(s);
}

@customElement('ic-spectrum-color-picker')
export class ColorPicker extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      min-height: 200px;
    }

    h4 {
      margin: 0;
    }

    .gradient-swatch {
      transform: rotate(90deg);
    }
  `;

  @property()
  value: string | undefined;

  @property()
  types: ColorType[] = [
    ColorType.None,
    ColorType.Solid,
    ColorType.Gradient,
    ColorType.Image,
  ];

  /** 传给 `ic-spectrum-input-solid`（例如编辑 fill 时）；可为 `$token`。 */
  @property()
  fillOpacity: number | string | undefined;

  /** 传给 `ic-spectrum-input-solid`（例如编辑 stroke 时）；可为 `$token`。 */
  @property()
  strokeOpacity: number | string | undefined;

  /** 与工具条一致：透明度可绑定数字变量 */
  @property({ type: Boolean, attribute: 'enable-opacity-variable-binding' })
  enableOpacityVariableBinding = false;

  @state()
  type: ColorType = ColorType.None;

  @state()
  prevColors: Record<ColorType, string> = {
    [ColorType.None]: 'none',
    [ColorType.Solid]: '#000',
    [ColorType.Gradient]: 'linear-gradient(to right, #000, #fff)',
    [ColorType.Image]: '',
  };

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('value')) {
      const v = this.value;
      this.type =
        !v || v === 'none'
          ? ColorType.None
          : isGradient(v)
            ? ColorType.Gradient
            : isUrl(v) || isDataUrl(v)
              ? ColorType.Image
              : ColorType.Solid;

      this.prevColors = {
        ...this.prevColors,
        [this.type]: v ?? 'none',
      };
    }
  }

  private handleTypeChanged(e: CustomEvent) {
    const target = e.currentTarget as SpActionGroupElement;
    const raw = target.selected[0];
    if (!raw || !isColorType(raw)) return;

    this.type = raw;

    this.dispatchEvent(
      new CustomEvent<ColorPickerChangeDetail>('color-change', {
        detail: {
          type: raw,
          value: this.prevColors[raw],
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleColorChanged(e: CustomEvent<ChildColorChangeDetail>) {
    const { type: rawType, value } = e.detail;
    if (!isColorType(rawType)) return;
    this.prevColors = { ...this.prevColors, [rawType]: value };
  }

  render() {
    const headingId = 'color-picker-heading';
    return html`
      ${when(
      this.types.length > 1,
      () => html`<sp-action-group
          quiet
          compact
          emphasized
          size="m"
          selects="single"
          aria-labelledby=${headingId}
          .selected=${[this.type]}
          @change=${this.handleTypeChanged}
        >
          ${when(
        this.types.includes(ColorType.None),
        () => html`
              <sp-action-button value=${ColorType.None}>
                <sp-tooltip self-managed placement="bottom">
                  No color
                </sp-tooltip>
                <sp-swatch nothing slot="icon"> </sp-swatch>
              </sp-action-button>
            `,
      )}
          ${when(
        this.types.includes(ColorType.Solid),
        () => html`
              <sp-action-button value=${ColorType.Solid}>
                <sp-tooltip self-managed placement="bottom"> Solid </sp-tooltip>
                <sp-swatch
                  color=${cssColorToHex(this.prevColors[ColorType.Solid])}
                  slot="icon"
                >
                </sp-swatch>
              </sp-action-button>
            `,
      )}
          ${when(
        this.types.includes(ColorType.Gradient),
        () => html`
              <sp-action-button value=${ColorType.Gradient}>
                <sp-tooltip self-managed placement="bottom">
                  Gradient
                </sp-tooltip>
                <sp-swatch
                  class="gradient-swatch"
                  color=${this.prevColors[ColorType.Gradient]}
                  slot="icon"
                >
                </sp-swatch>
              </sp-action-button>
            `,
      )}
          ${when(
        this.types.includes(ColorType.Image),
        () => html`
              <sp-action-button value=${ColorType.Image}>
                <sp-tooltip self-managed placement="bottom"> Image </sp-tooltip>
                <sp-icon-image slot="icon"></sp-icon-image>
              </sp-action-button>
            `,
      )}
        </sp-action-group>`,
    )}
      ${when(
      this.type === ColorType.Solid,
      () => html`
          <ic-spectrum-input-solid
            value=${this.prevColors[ColorType.Solid]}
            .fillOpacity=${this.fillOpacity}
            .strokeOpacity=${this.strokeOpacity}
            ?enable-opacity-variable-binding=${this
          .enableOpacityVariableBinding}
            @color-change=${this.handleColorChanged}
          ></ic-spectrum-input-solid>
        `,
    )}
      ${when(
      this.type === ColorType.Gradient,
      () => html`<ic-spectrum-input-gradient
          value=${this.prevColors[ColorType.Gradient]}
          @color-change=${this.handleColorChanged}
        ></ic-spectrum-input-gradient>`,
    )}
      ${when(this.type === ColorType.Image, () => html`
        <ic-spectrum-input-image
          value=${this.prevColors[ColorType.Image]}
          @color-change=${this.handleColorChanged}
        ></ic-spectrum-input-image>
      `)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-color-picker': ColorPicker;
  }
}
