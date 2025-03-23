import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { appStateContext, elementsContext, Task } from '../context';
import { AppState } from '../context';
import { consume } from '@lit/context';

import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import { Event } from '../event';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

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

  @consume({ context: elementsContext, subscribe: true })
  elements: SerializedNode[];

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
            <sp-action-button quiet size="s" @click=${this.handleClose}>
              <sp-icon-close slot="icon"></sp-icon-close>
            </sp-action-button>
          </h4>
        </section>`
      : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel': LayersPanel;
  }
}
