import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import '@spectrum-web-components/icons-workflow/icons/sp-icon-layers.js';

@customElement('ic-spectrum-taskbar')
export class Taskbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      background-color: white;
      border-radius: var(--spectrum-corner-radius-200);
      justify-content: center;
      pointer-events: auto;

      padding: var(--spectrum-global-dimension-size-100);
      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }
  `;

  private toggleLayersPanel() {
    this.dispatchEvent(new CustomEvent('toggle-layers-panel'));
  }

  render() {
    return html`
      <sp-action-button
        quiet
        toggles
        id="toggles-layers"
        @change=${this.toggleLayersPanel}
      >
        <sp-icon-layers slot="icon"></sp-icon-layers>
        <sp-tooltip self-managed placement="left">
          Show layers panel
        </sp-tooltip>
      </sp-action-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-taskbar': Taskbar;
  }
}
