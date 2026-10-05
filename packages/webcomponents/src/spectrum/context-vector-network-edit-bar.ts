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
import { live } from 'lit/directives/live.js';
import { customElement, property } from 'lit/decorators.js';
import '@spectrum-web-components/action-group/sp-action-group.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/divider/sp-divider.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-color-fill.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-move.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-graph-profit-curve.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-cut.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { msg, str } from '@lit/localize';
import './fill-action-button';
import './vector-topology-controls';

@customElement('ic-spectrum-context-vector-network-edit-bar')
export class ContextVectorNetworkEditBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-75);
      width: max-content;
      flex: none;
    }

    sp-divider {
      height: 24px;
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
      margin-inline-start: var(--spectrum-global-dimension-size-100);
    }

    ic-spectrum-fill-action-button,
    sp-divider,
    .close-button {
      flex: none;
    }

    select {
      margin-inline: 8px;
      padding: 5px;
      color: inherit;
      background: var(--spectrum-gray-100, white);
      border: 1px solid var(--spectrum-gray-400, #ccc);
      border-radius: 4px;
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

  private mirroringEdits = new Set<AbortController>();

  disconnectedCallback() {
    this.mirroringEdits.forEach((controller) => controller.abort());
    this.mirroringEdits.clear();
    super.disconnectedCallback();
  }

  private async setMirroring(event: Event) {
    const api = this.api;
    const selected = api.getAppState().vectorNetworkSelectedVertex;
    const mode = (event.target as HTMLSelectElement).value as HandleMirroring;
    if (
      !selected ||
      selected.nodeId !== this.node?.id ||
      !['NONE', 'ANGLE', 'ANGLE_AND_LENGTH'].includes(mode)
    ) {
      this.requestUpdate();
      return;
    }
    const { nodeId, index } = selected;
    const source = api.getNodeById(nodeId);
    if (source?.type !== 'vector-network') return;
    // Vertex indices remain meaningful only while connectivity is unchanged.
    const vertexCount = source.vertices.length;
    const endpoints = source.segments.map(({ start, end }) => ({ start, end }));
    const controller = new AbortController();
    this.mirroringEdits.add(controller);
    const dispose = api.onDestroy(() => controller.abort());
    try {
      await api.edit(
        (editor) => {
          const node = editor.getNodeById(nodeId);
          const state = editor.getAppState();
          const current = state.vectorNetworkSelectedVertex;
          if (
            !this.isConnected ||
            this.api !== api ||
            node?.type !== 'vector-network' ||
            node.isDeleted ||
            !node.isEditing ||
            node.locked ||
            node.visibility === 'hidden' ||
            !editor.getEntity(node) ||
            state.vectorNetworkEditMode !== VectorNetworkEditMode.BEND ||
            state.layersSelected.length !== 1 ||
            state.layersSelected[0] !== nodeId ||
            current?.nodeId !== nodeId ||
            current.index !== index ||
            node.vertices.length !== vertexCount ||
            node.segments.length !== endpoints.length ||
            endpoints.some(
              ({ start, end }, i) =>
                node.segments[i].start !== start ||
                node.segments[i].end !== end,
            ) ||
            !node.vertices[index] ||
            (node.vertices[index].handleMirroring ?? 'NONE') === mode
          ) {
            controller.abort();
            return;
          }
          const geometry = {
            vertices: node.vertices,
            segments: node.segments,
            regions: node.regions,
          };
          const next = setVectorVertexMirroring(geometry, index, mode);
          if (next === geometry) {
            controller.abort();
            return;
          }
          editor.updateNodeVectorNetwork(node, next as VectorNetwork);
          requestTransformerRefreshForCanvas(editor.getCanvas());
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted) console.error(error);
    } finally {
      dispose();
      this.mirroringEdits.delete(controller);
      this.requestUpdate();
    }
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
      ${vectorNetworkEditMode === VectorNetworkEditMode.MOVE
        ? html`<ic-spectrum-vector-topology-controls
            .api=${this.api} .appState=${this.appState} .node=${this.node}
          ></ic-spectrum-vector-topology-controls>
          <ic-spectrum-vector-topology-controls faces
            .api=${this.api} .appState=${this.appState} .node=${this.node}
          ></ic-spectrum-vector-topology-controls>`
        : ''}
      ${vectorNetworkEditMode === VectorNetworkEditMode.FILL
        ? html`<ic-spectrum-fill-action-button
            .api=${this.api}
            .appState=${this.appState}
            .node=${this.node}
            .defaultFill=${this.appState.penbarVectorNetwork.fills?.find(
              (fill) => fill.enabled !== false && fill.opacity !== 0 &&
                (fill.type !== 'solid' || fill.value !== 'none'),
            ) ?? { type: 'solid', value: '#147af3', opacity: 1 }}
          ></ic-spectrum-fill-action-button>`
        : ''}
      ${vectorNetworkEditMode === VectorNetworkEditMode.BEND
        ? html`
            <select
              aria-label=${msg(str`Handle coupling`)}
              title=${msg(
                str`Select a vertex with two handles to change coupling`,
              )}
              ?disabled=${!canCouple}
              .value=${live(canCouple ? vertex.handleMirroring ?? 'NONE' : 'NONE')}
              @change=${this.setMirroring}
            >
              <option value="NONE">${msg(str`Independent`)}</option>
              <option value="ANGLE">${msg(str`Align angles`)}</option>
              <option value="ANGLE_AND_LENGTH">
                ${msg(str`Mirror angle and length`)}
              </option>
            </select>
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
