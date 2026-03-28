import { html, css, LitElement, type PropertyValues } from 'lit';
import { consume } from '@lit/context';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { classMap } from 'lit/directives/class-map.js';
import { customElement } from 'lit/decorators.js';
import Sortable from 'sortablejs';
import {
  SerializedNode,
  Task,
  AppState,
  sortByFractionalIndex,
  SIBLINGS_MAX_Z_INDEX,
  SIBLINGS_MIN_Z_INDEX,
  UI,
  ZIndex,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { Event } from '../event';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';

@customElement('ic-spectrum-layers-panel')
@localized()
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
      color: canvastext;
    }

    .actions {
      padding: 4px;
      padding-top: 0;
    }

    .container {
      height: 300px;
      overflow: hidden;
      overflow-y: auto;
      scroll-behavior: smooth;
      scroll-padding: 8px;
    }

    .layer-siblings {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .layer-branch {
      flex: 0 0 auto;
    }

    .layer-branch.sortable-ghost {
      opacity: 0.45;
    }

    .layer-branch.sortable-drag {
      cursor: grabbing;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: nodesContext, subscribe: true })
  nodes: SerializedNode[];

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  private sortableInstances: Sortable[] = [];

  private sortableInitRaf = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.api.element.addEventListener(Event.SELECTED_NODES_CHANGED, (e) => {
      const { selected } = e.detail;

      // Scroll to the selected layer
      if (selected.length > 0) {
        const scrollToId = this.generateLayersPanelItemId(selected[0]);
        const scrollToElement = this.shadowRoot.querySelector(`#${scrollToId}`);
        const container = this.shadowRoot.querySelector('.container');

        if (scrollToElement && container) {
          // 计算元素相对于容器的位置
          const elementTop = (scrollToElement as HTMLElement).offsetTop;
          const elementHeight = (scrollToElement as HTMLElement).offsetHeight;
          const containerHeight = container.clientHeight;

          // 如果元素不在视口内，则滚动到合适位置
          const currentScrollTop = container.scrollTop;
          const elementBottom = elementTop + elementHeight;
          const visibleTop = currentScrollTop;
          const visibleBottom = currentScrollTop + containerHeight;

          if (elementTop < visibleTop || elementBottom > visibleBottom) {
            // 计算目标滚动位置，让元素在视口中央
            const targetScrollTop =
              elementTop - (containerHeight - elementHeight) / 2;

            container.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth',
            });
          }
        }
      }
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    cancelAnimationFrame(this.sortableInitRaf);
    this.destroySortables();
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    if (!this.appState.taskbarSelected.includes(Task.SHOW_LAYERS_PANEL)) {
      this.destroySortables();
      return;
    }
    cancelAnimationFrame(this.sortableInitRaf);
    this.sortableInitRaf = requestAnimationFrame(() => {
      this.destroySortables();
      this.initSortables();
    });
  }

  private destroySortables() {
    this.sortableInstances.forEach((s) => s.destroy());
    this.sortableInstances = [];
  }

  private initSortables() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const lists = root.querySelectorAll<HTMLElement>('.layer-siblings');
    lists.forEach((el) => {
      const sortable = Sortable.create(el, {
        animation: 150,
        draggable: '.layer-branch',
        filter: '.layer-branch--locked',
        preventOnFilter: false,
        group: {
          name: 'layers',
          pull: true,
          put: true,
        },
        onEnd: (evt) => this.handleSortableEnd(evt),
      });
      this.sortableInstances.push(sortable);
    });
  }

  /**
   * Translation-only world position of a node's local origin (consistent with group / ungroup).
   */
  private layerNodeWorldTranslation(node: SerializedNode): {
    x: number;
    y: number;
  } {
    let x = node.x ?? 0;
    let y = node.y ?? 0;
    let id = node.parentId;
    while (id) {
      const p = this.api.getNodeById(id);
      if (!p) {
        break;
      }
      x += p.x ?? 0;
      y += p.y ?? 0;
      id = p.parentId;
    }
    return { x, y };
  }

  /**
   * World position of parent node's local origin (0,0).
   */
  private layerParentOriginWorld(parent: SerializedNode): { x: number; y: number } {
    let x = parent.x ?? 0;
    let y = parent.y ?? 0;
    let id = parent.parentId;
    while (id) {
      const p = this.api.getNodeById(id);
      if (!p) {
        break;
      }
      x += p.x ?? 0;
      y += p.y ?? 0;
      id = p.parentId;
    }
    return { x, y };
  }

  private isUnderAncestor(ancestorId: string, node: SerializedNode): boolean {
    let id: string | undefined = node.parentId;
    while (id) {
      if (id === ancestorId) {
        return true;
      }
      const p = this.api.getNodeById(id);
      id = p?.parentId;
    }
    return false;
  }

  /**
   * Reparent for layers panel: keep visual placement (translation stack only).
   */
  private reparentLayerNodeMaintainingWorldPosition(
    node: SerializedNode,
    newParent: SerializedNode | undefined,
  ) {
    const world = this.layerNodeWorldTranslation(node);
    if (newParent === undefined) {
      this.api.updateNode(node, {
        parentId: undefined,
        x: world.x,
        y: world.y,
      });
      return;
    }
    const origin = this.layerParentOriginWorld(newParent);
    this.api.updateNode(node, {
      parentId: newParent.id,
      x: world.x - origin.x,
      y: world.y - origin.y,
    });
  }

  private collectBranchIds(container: HTMLElement): string[] {
    return Array.from(container.children)
      .filter((c): c is HTMLElement => c.classList.contains('layer-branch'))
      .map((c) => c.dataset.nodeId)
      .filter((id): id is string => !!id);
  }

  private handleSortableEnd(evt: Sortable.SortableEvent) {
    const from = evt.from as HTMLElement;
    const to = evt.to as HTMLElement;
    const toPid = to.dataset.layerParentId ?? '';

    const item = evt.item as HTMLElement;
    const movedId = item.dataset.nodeId;
    if (!movedId) {
      return;
    }

    const movedNode = this.api.getNodeById(movedId);
    if (!movedNode) {
      this.requestUpdate();
      return;
    }

    const orderedIds = this.collectBranchIds(to);

    if (from !== to) {
      const newParent =
        toPid === '' ? undefined : this.api.getNodeById(toPid);
      if (toPid !== '' && !newParent) {
        this.requestUpdate();
        return;
      }
      if (
        newParent &&
        (newParent.id === movedNode.id ||
          this.isUnderAncestor(movedNode.id, newParent))
      ) {
        this.requestUpdate();
        return;
      }
      this.reparentLayerNodeMaintainingWorldPosition(movedNode, newParent);
    } else if (evt.oldIndex === evt.newIndex) {
      return;
    }

    this.applyLayerSiblingOrder(toPid, orderedIds);
  }

  /**
   * Reassign sibling z-index order to match the layers panel (expects all ids to share parent toPid).
   */
  private applyLayerSiblingOrder(parentIdAttr: string, orderedIds: string[]) {
    if (orderedIds.length === 0) {
      return;
    }

    const parentId =
      parentIdAttr === '' ? undefined : parentIdAttr;

    const nodes = orderedIds
      .map((id) => this.api.getNodeById(id))
      .filter((n): n is SerializedNode => !!n);

    if (nodes.length !== orderedIds.length) {
      this.requestUpdate();
      return;
    }

    for (const node of nodes) {
      const pid = node.parentId ?? undefined;
      if (pid !== parentId) {
        this.requestUpdate();
        return;
      }
    }

    const n = nodes.length;
    if (n >= 2) {
      const span = SIBLINGS_MAX_Z_INDEX - SIBLINGS_MIN_Z_INDEX;
      nodes.forEach((node, i) => {
        const z =
          SIBLINGS_MIN_Z_INDEX + ((i + 1) / (n + 1)) * span;
        this.api.updateNode(node, { zIndex: z });
      });
    }
    this.api.record();
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

    if (!node.locked) {
      this.api.selectNodes([node], e.shiftKey);
      this.api.record();
    }
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
    const { layersSelected, taskbarSelected } = this.appState;

    const sortedNodes = this.nodes
      .filter((node) => node.parentId === undefined)
      .map((node) => {
        return this.api.getEntity(node);
      })
      .sort(sortByFractionalIndex)
      .map((entity) => {
        return this.api.getNodeByEntity(entity);
      });

    const isSelectedEmpty = layersSelected.length === 0;
    let bringForwardDisabled = false;
    let sendBackwardDisabled = false;

    if (layersSelected.length === 1) {
      const node = this.api.getNodeById(layersSelected[0]);

      if (node) {
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
    }

    return taskbarSelected.includes(Task.SHOW_LAYERS_PANEL)
      ? html`<section>
          <h4>
            ${msg(str`Layers`)}
            <sp-action-button quiet size="s" @click=${this.handleClose}>
              <sp-icon-close slot="icon"></sp-icon-close>
            </sp-action-button>
          </h4>
          <sp-action-group class="actions">
            <sp-action-button quiet size="s" disabled @click=${this.handleAdd}>
              <sp-tooltip self-managed placement="bottom">
                ${msg(str`Add new layer`)}
              </sp-tooltip>
              <sp-icon-add slot="icon"></sp-icon-add>
            </sp-action-button>

            <sp-action-menu
              label=${msg(str`Arrange layers`)}
              quiet
              size="s"
              .disabled=${layersSelected.length === 0}
            >
              <sp-icon-show-all-layers slot="icon"></sp-icon-show-all-layers>
              <sp-menu-group>
                <span slot="header">${msg(str`Arrange layers`)}</span>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || bringForwardDisabled}
                  @click=${this.handleBringToFront}
                >
                  <sp-icon-layers-bring-to-front
                    slot="icon"
                  ></sp-icon-layers-bring-to-front>
                  ${msg(str`Bring to front`)}
                </sp-menu-item>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || bringForwardDisabled}
                  @click=${this.handleBringForward}
                >
                  <sp-icon-layers-forward slot="icon"></sp-icon-layers-forward>
                  ${msg(str`Bring forward`)}
                </sp-menu-item>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || sendBackwardDisabled}
                  @click=${this.handleSendBackward}
                >
                  <sp-icon-layers-backward
                    slot="icon"
                  ></sp-icon-layers-backward>
                  ${msg(str`Send backward`)}
                </sp-menu-item>
                <sp-menu-item
                  ?disabled=${isSelectedEmpty || sendBackwardDisabled}
                  @click=${this.handleSendToBack}
                >
                  <sp-icon-layers-send-to-back
                    slot="icon"
                  ></sp-icon-layers-send-to-back>
                  ${msg(str`Send to back`)}
                </sp-menu-item>
              </sp-menu-group>
            </sp-action-menu>

            <sp-action-button
              quiet
              size="s"
              @click=${this.handleDelete}
              .disabled=${layersSelected.length === 0}
            >
              <sp-tooltip self-managed placement="bottom">
                ${msg(str`Delete`)}
              </sp-tooltip>
              <sp-icon-delete slot="icon"></sp-icon-delete>
            </sp-action-button>
          </sp-action-group>
          <div class="container">
            <div class="layer-siblings" data-layer-parent-id="">
              ${map(sortedNodes, (node) => {
                return this.renderLayerBranch(node, 0);
              })}
            </div>
          </div>
        </section>`
      : null;
  }

  private renderLayerBranch(node: SerializedNode, depth: number) {
    const children = this.api.getChildren(node);
    const sortedNodes = children.sort(sortByFractionalIndex).map((entity) => {
      return this.api.getNodeByEntity(entity);
    });

    const { layersSelected, layersHighlighted, layersExpanded } = this.appState;
    const hasChildren = sortedNodes.length > 0;
    const isExpanded = layersExpanded.includes(node.id);

    return html`<div
        class=${classMap({
          'layer-branch': true,
          'layer-branch--locked': !!node.locked,
        })}
        data-node-id=${node.id}
      >
        <ic-spectrum-layers-panel-item
          id=${this.generateLayersPanelItemId(node)}
          .node=${node}
          .depth=${depth}
          .hasChildren=${hasChildren}
          @click=${(e: MouseEvent) => this.handleSelect(e, node.id)}
          ?selected=${layersSelected.includes(node.id)}
          ?highlighted=${layersHighlighted.includes(node.id)}
        ></ic-spectrum-layers-panel-item>
        ${when(
          hasChildren && isExpanded,
          () => html`
            <div class="layer-siblings" data-layer-parent-id=${node.id}>
              ${map(sortedNodes, (child) => {
                return this.renderLayerBranch(child, depth + 1);
              })}
            </div>
          `,
        )}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel': LayersPanel;
  }
}
