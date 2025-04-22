import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { map } from 'lit/directives/map.js';
import { customElement } from 'lit/decorators.js';
import { SerializedNode, Task, AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { Event } from '../event';
import { ExtendedAPI } from '../API';
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

    .actions {
      padding: 4px;
      padding-top: 0;
    }

    .container {
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
  api: ExtendedAPI;

  connectedCallback(): void {
    super.connectedCallback();

    this.api.element.addEventListener(Event.SELECTED_NODES_CHANGED, (e) => {
      const { selected } = e.detail;

      // Scroll to the selected layer
      if (selected.length > 0) {
        const scrollToId = `layers-panel-item-${selected[0]}`;
        const scrollToElement = this.shadowRoot.querySelector(`#${scrollToId}`);
        if (scrollToElement) {
          scrollToElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  private handleClose() {
    this.api.setTaskbars(
      this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_LAYERS_PANEL,
      ),
    );
  }

  private handleDelete() {
    const { layersSelected } = this.api.getAppState();
    this.api.deleteNodesById(layersSelected);

    // Try to select the next layer
    const nextLayer = this.nodes.find(
      (node) => !layersSelected.includes(node.id),
    );
    if (nextLayer) {
      this.api.selectNodes([nextLayer.id]);
    }
    this.api.record();
  }

  private handleAdd() {
    // this.api.addNodes(this.nodes);
  }

  private handleSelect(e: MouseEvent, id: SerializedNode['id']) {
    const { layersSelected } = this.api.getAppState();

    if (layersSelected.length === 1 && layersSelected.includes(id)) {
      return;
    }

    this.api.selectNodes([id], e.shiftKey);
    this.api.record();
  }

  render() {
    const { layersSelected, taskbarSelected } = this.appState;

    return taskbarSelected.includes(Task.SHOW_LAYERS_PANEL)
      ? html`<section>
          <h4>
            Layers
            <sp-action-button quiet size="s" @click=${this.handleClose}>
              <sp-icon-close slot="icon"></sp-icon-close>
            </sp-action-button>
          </h4>
          <sp-action-group class="actions">
            <sp-action-button quiet size="s" @click=${this.handleAdd}>
              <sp-tooltip self-managed placement="bottom">
                Add new layer
              </sp-tooltip>
              <sp-icon-add slot="icon"></sp-icon-add>
            </sp-action-button>
            <sp-action-button
              quiet
              size="s"
              @click=${this.handleDelete}
              .disabled=${layersSelected.length === 0}
            >
              <sp-tooltip self-managed placement="bottom"> Delete </sp-tooltip>
              <sp-icon-delete slot="icon"></sp-icon-delete>
            </sp-action-button>
          </sp-action-group>
          <div class="container">
            ${map(this.nodes, (node) => {
              // TODO: hierarchy
              // TODO: virtual scroll for better performance
              return html`<ic-spectrum-layers-panel-item
                id="layers-panel-item-${node.id}"
                .node=${node}
                draggable
                @click=${(e: MouseEvent) => this.handleSelect(e, node.id)}
                ?selected=${layersSelected.includes(node.id)}
                ?child=${!!node.parentId}
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
