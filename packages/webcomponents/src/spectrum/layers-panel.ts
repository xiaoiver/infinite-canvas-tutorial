import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { map } from 'lit/directives/map.js';
import { customElement } from 'lit/decorators.js';
import {
  SerializedNode,
  Task,
  AppState,
  sortByFractionalIndex,
  UI,
  ZIndex,
} from '@infinite-canvas-tutorial/ecs';
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
        const scrollToId = this.generateLayersPanelItemId(selected[0]);
        const scrollToElement = this.shadowRoot.querySelector(`#${scrollToId}`);
        if (scrollToElement) {
          scrollToElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    });
  }

  private generateLayersPanelItemId(node: SerializedNode) {
    return `layers-panel-item-${node.id}`;
  }

  private handleClose() {
    this.api.setAppState({
      taskbarSelected: this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_LAYERS_PANEL,
      ),
    });
  }

  private handleDelete() {
    const { layersSelected } = this.api.getAppState();
    this.api.deleteNodesById(layersSelected);

    // Try to select the next layer
    const nextLayer = this.nodes.find(
      (node) => !layersSelected.includes(node.id),
    );
    if (nextLayer) {
      this.api.selectNodes([nextLayer]);
    }
    this.api.record();
  }

  private handleAdd() {
    // TODO: add new layer
    // this.api.addNodes(this.nodes);
  }

  private handleSelect(e: MouseEvent, id: SerializedNode['id']) {
    const { layersSelected } = this.api.getAppState();

    if (layersSelected.length === 1 && layersSelected.includes(id)) {
      return;
    }

    const node = this.api.getNodeById(id);
    this.api.selectNodes([node], e.shiftKey);
    this.api.record();
  }

  private handleBringToFront() {
    const { layersSelected } = this.api.getAppState();
    const node = this.api.getNodeById(layersSelected[0]);
    this.api.bringToFront(node);
    this.api.record();
  }

  private handleBringForward() {
    const { layersSelected } = this.api.getAppState();
    const node = this.api.getNodeById(layersSelected[0]);
    this.api.bringForward(node);
    this.api.record();
  }

  private handleSendBackward() {
    const { layersSelected } = this.api.getAppState();
    const node = this.api.getNodeById(layersSelected[0]);
    this.api.sendBackward(node);
    this.api.record();
  }

  private handleSendToBack() {
    const { layersSelected } = this.api.getAppState();
    const node = this.api.getNodeById(layersSelected[0]);
    this.api.sendToBack(node);
    this.api.record();
  }

  render() {
    const { layersSelected, layersHighlighted, taskbarSelected } =
      this.appState;

    const sortedNodes = this.nodes
      .map((node) => {
        return this.api.getEntity(node);
      })
      .sort(sortByFractionalIndex)
      .map((entity) => {
        return this.api.getNodeByEntity(entity);
      })
      .reverse();

    const isSelectedEmpty = layersSelected.length === 0;
    let bringForwardDisabled = false;
    let sendBackwardDisabled = false;

    if (layersSelected.length === 1) {
      const node = this.api.getNodeById(layersSelected[0]);

      const children = this.api
        .getSiblings(node)
        .filter((child) => !child.has(UI));
      const maxZIndex = Math.max(
        ...children.map((child) => child.read(ZIndex).value),
      );
      const minZIndex = Math.min(
        ...children.map((child) => child.read(ZIndex).value),
      );

      if (node.zIndex === maxZIndex) {
        bringForwardDisabled = true;
      }
      if (node.zIndex === minZIndex) {
        sendBackwardDisabled = true;
      }
    }

    return taskbarSelected.includes(Task.SHOW_LAYERS_PANEL)
      ? html`<section>
          <h4>
            Layers
            <sp-action-button quiet size="s" @click=${this.handleClose}>
              <sp-icon-close slot="icon"></sp-icon-close>
            </sp-action-button>
          </h4>
          <sp-action-group class="actions">
            <sp-action-button quiet size="s" disabled @click=${this.handleAdd}>
              <sp-tooltip self-managed placement="bottom">
                Add new layer
              </sp-tooltip>
              <sp-icon-add slot="icon"></sp-icon-add>
            </sp-action-button>

            <sp-action-menu
              label="Arrange layers"
              quiet
              size="s"
              .disabled=${layersSelected.length === 0}
            >
              <sp-icon-show-all-layers slot="icon"></sp-icon-show-all-layers>
              <sp-menu-group>
                <span slot="header">Arrange layers</span>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || bringForwardDisabled}
                  @click=${this.handleBringToFront}
                >
                  <sp-icon-layers-bring-to-front
                    slot="icon"
                  ></sp-icon-layers-bring-to-front>
                  Bring to front
                </sp-menu-item>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || bringForwardDisabled}
                  @click=${this.handleBringForward}
                >
                  <sp-icon-layers-forward slot="icon"></sp-icon-layers-forward>
                  Bring forward
                </sp-menu-item>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || sendBackwardDisabled}
                  @click=${this.handleSendBackward}
                >
                  <sp-icon-layers-backward
                    slot="icon"
                  ></sp-icon-layers-backward>
                  Send backward
                </sp-menu-item>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || sendBackwardDisabled}
                  @click=${this.handleSendToBack}
                >
                  <sp-icon-layers-send-to-back
                    slot="icon"
                  ></sp-icon-layers-send-to-back>
                  Send to back
                </sp-menu-item>
              </sp-menu-group>
            </sp-action-menu>

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
            ${map(sortedNodes, (node) => {
              // TODO: hierarchy
              // TODO: virtual scroll for better performance
              return html`<ic-spectrum-layers-panel-item
                id=${this.generateLayersPanelItemId(node)}
                .node=${node}
                draggable
                @click=${(e: MouseEvent) => this.handleSelect(e, node.id)}
                ?selected=${layersSelected.includes(node.id)}
                ?highlighted=${layersHighlighted.includes(node.id)}
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
