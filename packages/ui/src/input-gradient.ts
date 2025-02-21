import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/input/input.js';

@customElement('ic-input-gradient')
export class InputGradient extends LitElement {
  @property()
  value: string;

  render() {
    return html`${this.value}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-input-gradient': InputGradient;
  }
}
