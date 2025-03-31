import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ic-spectrum-stroke-icon')
export class StrokeIcon extends LitElement {
  @property()
  value: string;

  render() {
    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
      >
        <style>
          .picker {
            fill: ${this.value};
            stroke: var(--spectrum-gray-800);
            stroke-width: var(--spectrum-border-width-100);
          }
        </style>

        <path
          class="picker"
          d="M 50, 50 m 0, -48 a 48, 48, 0, 1, 0, 1, 0 Z m 0 24 a 24, 24, 0, 1, 1, -1, 0 Z"
        ></path>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-stroke-icon': StrokeIcon;
  }
}
