import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { AppState, appStateContext } from '../context';

@customElement('ic-spectrum-top-navbar')
export class TopNavbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      background-color: white;
      justify-content: end;

      padding: var(--spectrum-global-dimension-size-100);

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  render() {
    return html`<ic-spectrum-zoom-toolbar /> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-top-navbar': TopNavbar;
  }
}
