import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ic-spectrum-fill-icon')
export class FillIcon extends LitElement {
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
        <defs>
          <style>
            .picker {
              fill: ${this.value};
              stroke: var(--spectrum-gray-800);
              stroke-width: var(--spectrum-border-width-100);
            }
          </style>
        </defs>
        <circle cx="50" cy="50" r="48" class="picker"></circle>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-fill-icon': FillIcon;
  }
}
