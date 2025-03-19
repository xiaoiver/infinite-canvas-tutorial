import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { AppState, appStateContext } from '../context';

@customElement('ic-spectrum-top-navbar')
export class TopNavbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      justify-content: end;
      padding: var(--spectrum-global-dimension-size-100);
      background: var(--spectrum-gray-100);
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  render() {
    return html` <ic-spectrum-zoom-toolbar /> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-top-navbar': TopNavbar;
  }
}
