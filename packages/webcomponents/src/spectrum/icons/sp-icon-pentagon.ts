import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('sp-icon-pentagon')
export class SpIconPentagon extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      width: 18px;
      height: 18px;
      color: currentColor;
    }

    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }
  `;

  render() {
    return html`
      <svg viewBox="0 0 36 36" aria-hidden="true" height="24" width="24" role="img" fill="currentColor">
        <polygon points="18,4.5 30.3,13.5 25.65,27.75 10.35,27.75 5.7,13.5"></polygon>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-icon-pentagon': SpIconPentagon;
  }
}
