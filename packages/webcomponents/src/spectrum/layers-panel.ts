import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { appStateContext, Task } from '../context';
import { AppState } from '../context';
import { consume } from '@lit/context';

import '@spectrum-web-components/accordion/sp-accordion.js';
import '@spectrum-web-components/accordion/sp-accordion-item.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import { Event } from '../event';

@customElement('ic-spectrum-layers-panel')
export class LayersPanel extends LitElement {
  static styles = css`
    section {
      display: flex;
      flex-direction: column;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      padding: var(--spectrum-global-dimension-size-100);
      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    h4 {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  private handleClose() {
    this.dispatchEvent(
      new CustomEvent(Event.TASK_CHANGED, {
        detail: {
          selected: this.appState.taskbar.selected.filter(
            (task) => task !== Task.SHOW_LAYERS_PANEL,
          ),
        },
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
  }

  render() {
    return this.appState.taskbar.selected.includes(Task.SHOW_LAYERS_PANEL)
      ? html`<section>
          <h4>
            Layers
            <sp-action-button quiet @click=${this.handleClose}>
              <sp-icon-close slot="icon" size="s"></sp-icon-close>
            </sp-action-button>
          </h4>
          <sp-accordion allow-multiple size="s">
            <sp-accordion-item label="Transform"> </sp-accordion-item>
          </sp-accordion>
        </section>`
      : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel': LayersPanel;
  }
}
