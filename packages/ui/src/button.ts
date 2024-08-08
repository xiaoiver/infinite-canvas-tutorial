import { LitElement, html } from 'lit';
import { customElement, eventOptions, property } from 'lit/decorators.js';

@customElement('button-component')
export class Button extends LitElement {
  @property({ type: String })
  title!: string;

  @eventOptions({ passive: true })
  onClick() {
    this.dispatchEvent(new CustomEvent('submit', { detail: 'hello' }));
  }

  render() {
    return html`<button @click=${this.onClick}>${this.title}</button>`;
  }
}
