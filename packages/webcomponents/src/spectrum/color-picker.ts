import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { ColorArea } from '@spectrum-web-components/color-area';

@customElement('ic-spectrum-color-picker')
export class ColorPicker extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      width: 300px;
    }

    h4 {
      margin: 0;
    }
  `;

  @property()
  value: string;

  private handleTypeChanged(e: CustomEvent) {
    const type = (e.target as any).selected[0];
    if (type === 'none') {
      this.dispatchEvent(
        new CustomEvent('color-change', {
          detail: 'none',
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private handleSolidChanged(e: Event & { target: ColorArea }) {
    const value = e.target.color.toString();
    this.dispatchEvent(
      new CustomEvent('color-change', {
        detail: value,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const selected = this.value === 'none' ? 'none' : 'solid';

    return html`
      <h4>Select a color</h4>
      <sp-action-group
        quiet
        compact
        size="m"
        selects="single"
        .selected=${[selected]}
        @change=${this.handleTypeChanged}
      >
        <sp-action-button value="none">
          <sp-tooltip self-managed placement="bottom"> No color </sp-tooltip>
          <sp-swatch nothing slot="icon"> </sp-swatch>
        </sp-action-button>

        <sp-action-button value="solid">
          <sp-tooltip self-managed placement="bottom"> Solid </sp-tooltip>
          <sp-swatch color=${this.value} slot="icon"> </sp-swatch>
        </sp-action-button>

        <sp-action-button value="gradient">
          <sp-tooltip self-managed placement="bottom"> Gradient </sp-tooltip>
          <sp-swatch color=${this.value} slot="icon"> </sp-swatch>
        </sp-action-button>
      </sp-action-group>

      ${when(
        selected === 'solid',
        () => html`
          <sp-color-area
            color=${this.value}
            @input=${this.handleSolidChanged}
          ></sp-color-area>
          <sp-color-slider
            color=${this.value}
            @input=${this.handleSolidChanged}
          ></sp-color-slider>
          <div>
            <sp-field-label for="hex" side-aligned="start">Hex</sp-field-label>
            <sp-color-field
              id="hex"
              size="s"
              value=${this.value}
              @input=${this.handleSolidChanged}
            ></sp-color-field>
          </div>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-color-picker': ColorPicker;
  }
}
