import { consume } from '@lit/context';
import {
  AppState,
  VectorNetworkEditMode,
  VectorNetworkSerializedNode,
  requestTransformerRefreshForCanvas,
} from '@infinite-canvas-tutorial/ecs';
import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@spectrum-web-components/action-group/sp-action-group.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/divider/sp-divider.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { msg, str } from '@lit/localize';

@customElement('ic-spectrum-context-vector-network-edit-bar')
export class ContextVectorNetworkEditBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-75);
    }

    sp-divider {
      height: 24px;
    }

    sp-action-group {
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

  render() {
    const { vectorNetworkEditMode } = this.appState;

    return html`
      <sp-action-group
        selects="single"
        .selected=${[vectorNetworkEditMode]}
        @change=${(e: Event & { target: HTMLElement & { selected: string[] } }) => {
        const next = e.target.selected?.[0] as VectorNetworkEditMode | undefined;
        if (next) {
          this.setMode(next);
        }
      }}
        quiet
        size="m"
      >
        <sp-action-button value="${VectorNetworkEditMode.MOVE}">
          <sp-tooltip self-managed placement="top">
            ${msg(str`Move`)}
          </sp-tooltip>
          <sp-icon-move slot="icon"></sp-icon-move>
        </sp-action-button>
        <sp-action-button value="${VectorNetworkEditMode.BEND}">
          <sp-tooltip self-managed placement="top">
            ${msg(str`Bend`)}
          </sp-tooltip>
          <sp-icon-graph-profit-curve slot="icon"></sp-icon-graph-profit-curve>
        </sp-action-button>
        <sp-action-button value="${VectorNetworkEditMode.CUT}">
          <sp-tooltip self-managed placement="top">
            ${msg(str`Cut`)}
          </sp-tooltip>
          <sp-icon-cut slot="icon"></sp-icon-cut>
        </sp-action-button>
      </sp-action-group>
      <sp-divider size="s" vertical></sp-divider>
      <sp-action-button
        class="close-button"
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
