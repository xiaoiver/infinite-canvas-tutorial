import { consume } from '@lit/context';
import {
  AppState,
  VectorNetworkEditMode,
  VectorNetworkSerializedNode,
  requestTransformerRefreshForCanvas,
  setVectorVertexMirroring,
  vectorHandlesAtVertex,
  type HandleMirroring,
  type VectorNetwork,
} from '@infinite-canvas-tutorial/ecs';
import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@spectrum-web-components/action-group/sp-action-group.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/divider/sp-divider.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import type { Picker } from '@spectrum-web-components/picker';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-color-fill.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-move.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-graph-profit-curve.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-cut.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { msg, str } from '@lit/localize';

@customElement('ic-spectrum-context-vector-network-edit-bar')
export class ContextVectorNetworkEditBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      width: max-content;
      flex: none;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-75);
    }

    sp-divider {
      height: 24px;
      flex: none;
    }

    sp-action-group {
      flex: none;
      flex-wrap: nowrap;
      --mod-actionbutton-content-color-default: var(--spectrum-gray-800);
      --mod-actionbutton-background-color-default: transparent;
      --mod-actionbutton-border-color-default: transparent;
    }

    sp-action-group sp-action-button[selected] {
      --mod-actionbutton-background-color-default: var(
        --spectrum-accent-background-color-default
      );
      --mod-actionbutton-content-color-default: white;
    }

    .tool-label {
      margin-inline-start: var(--spectrum-global-dimension-size-50);
      font-size: var(--spectrum-font-size-75);
    }

    .close-button {
      flex: none;
      margin-inline-start: var(--spectrum-global-dimension-size-100);
    }

    sp-picker {
      width: 144px;
      flex: none;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: VectorNetworkSerializedNode;

  private setMode(mode: VectorNetworkEditMode) {
    this.api.setAppState({ vectorNetworkEditMode: mode });
    const canvas = this.api.getCanvas();
    requestTransformerRefreshForCanvas(canvas);
  }

  private exitEditMode() {
    if (!this.node) {
      return;
    }
    this.api.updateNode(this.node, { isEditing: false });
    this.api.setAppState({
      vectorNetworkEditMode: VectorNetworkEditMode.MOVE,
    });
    const canvas = this.api.getCanvas();
    requestTransformerRefreshForCanvas(canvas);
  }

  private setMirroring(event: Event) {
    const selected = this.appState.vectorNetworkSelectedVertex;
    if (!selected || selected.nodeId !== this.node?.id) return;
    const node = this.api.getNodeById(selected.nodeId);
    if (node?.type !== 'vector-network' || !node.isEditing) return;
    const mode = (event.target as Picker).value as HandleMirroring;
    if ((node.vertices?.[selected.index]?.handleMirroring ?? 'NONE') === mode)
      return;
    const geometry = {
      vertices: node.vertices ?? [],
      segments: node.segments ?? [],
      regions: node.regions,
    };
    const next = setVectorVertexMirroring(geometry, selected.index, mode);
    if (next === geometry) return;
    this.api.updateNodeVectorNetwork(node, next as VectorNetwork);
    this.api.record();
    requestTransformerRefreshForCanvas(this.api.getCanvas());
  }

  render() {
    const { vectorNetworkEditMode } = this.appState;
    const selected = this.appState.vectorNetworkSelectedVertex;
    const vertex =
      selected?.nodeId === this.node?.id
        ? this.node?.vertices?.[selected.index]
        : undefined;
    const canCouple =
      !!vertex &&
      vectorHandlesAtVertex(
        {
          vertices: this.node.vertices ?? [],
          segments: this.node.segments ?? [],
        },
        selected.index,
      ).length === 2;

    return html`
      <sp-action-group
        selects="single"
        .selected=${[vectorNetworkEditMode]}
        @change=${(
          e: Event & { target: HTMLElement & { selected: string[] } },
        ) => {
          const next = e.target.selected?.[0] as
            | VectorNetworkEditMode
            | undefined;
          if (next) {
            this.setMode(next);
          }
        }}
        quiet
        size="m"
      >
        <sp-action-button
          value="${VectorNetworkEditMode.MOVE}"
          label=${msg(str`Move`)}
        >
          <sp-tooltip self-managed placement="top">
            ${msg(str`Move`)}
          </sp-tooltip>
          <sp-icon-move slot="icon"></sp-icon-move>
        </sp-action-button>
        <sp-action-button
          value="${VectorNetworkEditMode.BEND}"
          label=${msg(str`Bend`)}
        >
          <sp-tooltip self-managed placement="top">
            ${msg(str`Bend`)}
          </sp-tooltip>
          <sp-icon-graph-profit-curve slot="icon"></sp-icon-graph-profit-curve>
        </sp-action-button>
        <sp-action-button
          value="${VectorNetworkEditMode.CUT}"
          label=${msg(str`Cut`)}
        >
          <sp-tooltip self-managed placement="top">
            ${msg(str`Cut`)}
          </sp-tooltip>
          <sp-icon-cut slot="icon"></sp-icon-cut>
        </sp-action-button>
        <sp-action-button
          value="${VectorNetworkEditMode.FILL}"
          label=${msg(str`Fill region`)}
        >
          <sp-tooltip self-managed placement="top">
            ${msg(str`Click a region to toggle its fill`)}
          </sp-tooltip>
          <sp-icon-color-fill slot="icon"></sp-icon-color-fill>
        </sp-action-button>
      </sp-action-group>
      ${vectorNetworkEditMode === VectorNetworkEditMode.BEND
        ? html`
            <sp-picker
              label=${msg(str`Handle coupling`)}
              size="m"
              title=${msg(
                str`Select a vertex with two handles to change coupling`,
              )}
              ?disabled=${!canCouple}
              .value=${canCouple ? vertex.handleMirroring ?? 'NONE' : 'NONE'}
              @change=${this.setMirroring}
            >
              <sp-menu-item value="NONE">${msg(str`Independent`)}</sp-menu-item>
              <sp-menu-item value="ANGLE"
                >${msg(str`Align angles`)}</sp-menu-item
              >
              <sp-menu-item value="ANGLE_AND_LENGTH">
                ${msg(str`Mirror angle and length`)}
              </sp-menu-item>
            </sp-picker>
          `
        : ''}
      <sp-divider size="s" vertical></sp-divider>
      <sp-action-button
        class="close-button"
        label=${msg(str`Exit vector edit`)}
        quiet
        size="m"
        @click=${this.exitEditMode}
      >
        <sp-tooltip self-managed placement="top">Exit vector edit</sp-tooltip>
        <sp-icon-close slot="icon"></sp-icon-close>
      </sp-action-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-vector-network-edit-bar': ContextVectorNetworkEditBar;
  }
}
