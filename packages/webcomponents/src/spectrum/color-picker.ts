import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { isGradient } from '@infinite-canvas-tutorial/ecs';

export enum ColorType {
  None = 'none',
  Solid = 'solid',
  Gradient = 'gradient',
}

@customElement('ic-spectrum-color-picker')
export class ColorPicker extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      height: 200px;
    }

    h4 {
      margin: 0;
    }
  `;

  @property()
  value: string;

  @property()
  types: ColorType[] = [ColorType.None, ColorType.Solid, ColorType.Gradient];

  @state()
  type: ColorType = ColorType.None;

  @state()
  prevColors: Record<ColorType, string> = {
    [ColorType.None]: 'none',
    [ColorType.Solid]: '#000',
    [ColorType.Gradient]: 'linear-gradient(to right, #000, #fff)',
  };

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('value')) {
      this.type =
        !this.value || this.value === 'none'
          ? ColorType.None
          : isGradient(this.value)
          ? ColorType.Gradient
          : ColorType.Solid;

      this.prevColors[this.type] = this.value;
    }
  }

  private handleTypeChanged(e: CustomEvent) {
    const type = (e.target as any).selected[0] as ColorType;
    this.dispatchEvent(
      new CustomEvent('color-change', {
        detail: {
          type,
          value: this.prevColors[type],
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleColorChanged(e: CustomEvent) {
    const { type, value } = e.detail;
    this.prevColors[type] = value;
  }

  render() {
    return html`
      <h4>Select a color</h4>
      ${when(
        this.types.length > 1,
        () => html`<sp-action-group
          quiet
          compact
          size="m"
          selects="single"
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
                  color=${this.prevColors[ColorType.Solid]}
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
                  style="transform: rotate(90deg);"
                  color=${this.prevColors[ColorType.Gradient]}
                  slot="icon"
                >
                </sp-swatch>
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-color-picker': ColorPicker;
  }
}
