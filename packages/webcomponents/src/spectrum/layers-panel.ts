import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { map } from 'lit/directives/map.js';
import { customElement } from 'lit/decorators.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext, Task } from '../context';
import { AppState } from '../context';
import { Event } from '../event';
import { API } from '../API';
@customElement('ic-spectrum-layers-panel')
export class LayersPanel extends LitElement {
  static styles = css`
    section {
      display: flex;
      flex-direction: column;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    h4 {
      padding: var(--spectrum-global-dimension-size-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
    }

    .layers-container {
      height: 300px;
      overflow: hidden;
      overflow-y: auto;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: nodesContext, subscribe: true })
  nodes: SerializedNode[];

  @consume({ context: apiContext, subscribe: true })
  api: API;

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

  private handleSelect(e: MouseEvent, id: SerializedNode['id']) {
    this.api.selectNodes([id], e.shiftKey);
  }

  render() {
    const { layers, taskbar } = this.appState;

    return taskbar.selected.includes(Task.SHOW_LAYERS_PANEL)
      ? html`<section>
          <h4>
            Layers
            <sp-action-button quiet size="s" @click=${this.handleClose}>
              <sp-icon-close slot="icon"></sp-icon-close>
            </sp-action-button>
          </h4>
          <div class="layers-container">
            ${map(this.nodes, (node) => {
              // TODO: hierarchy
              // TODO: virtual scroll for better performance
              return html`<ic-spectrum-layers-panel-item
                .node=${node}
                draggable
                @click=${(e) => this.handleSelect(e, node.id)}
                ?selected=${layers.selected.includes(node.id)}
              ></ic-spectrum-layers-panel-item>`;
            })}
          </div>
        </section>`
      : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel': LayersPanel;
  }
}
