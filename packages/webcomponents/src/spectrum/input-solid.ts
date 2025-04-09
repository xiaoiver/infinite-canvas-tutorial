import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ColorArea } from '@spectrum-web-components/color-area';

@customElement('ic-spectrum-input-solid')
export class InputSolid extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;

      .hex-field {
        display: flex;
        align-items: center;
        gap: 8px;

        sp-field-label {
          width: 32px;
        }

        sp-color-field {
          flex: 1;
        }
      }
    }
  `;

  @property()
  value: string;

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
    return html`<sp-color-area
        color=${this.value}
        @input=${this.handleSolidChanged}
      ></sp-color-area>
      <sp-color-slider
        color=${this.value}
        @input=${this.handleSolidChanged}
      ></sp-color-slider>
      <div class="hex-field">
        <sp-field-label for="hex" side-aligned="start">Hex</sp-field-label>
        <sp-color-field
          id="hex"
          size="s"
          value=${this.value}
          @input=${this.handleSolidChanged}
        ></sp-color-field>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-solid': InputSolid;
  }
}
