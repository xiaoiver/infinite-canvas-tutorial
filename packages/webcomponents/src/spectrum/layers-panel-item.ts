import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  SerializedNode,
  AppState,
  Task,
  API,
} from '@infinite-canvas-tutorial/ecs';
import {
  OverlayOpenCloseDetail,
  trigger,
} from '@spectrum-web-components/overlay';
import { apiContext, appStateContext } from '../context';

@customElement('ic-spectrum-layers-panel-item')
export class LayersPanelItem extends LitElement {
  static styles = css`
    :host {
      width: 320px;
      height: 64px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px;
      cursor: pointer;
    }

    :host > span {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    ic-spectrum-layer-name {
      flex: 1;
    }

    :host([selected]) {
      background: var(--spectrum-blue-100);
    }

    :host(:not([selected]):not([disabled]):hover) {
      background-color: var(
        --spectrum-treeview-item-background-color-hover,
        var(--spectrum-alias-background-color-hover-overlay)
      );
    }

    :host([child]) > span {
      padding-left: 24px;
    }

    h4 {
      padding: var(--spectrum-global-dimension-size-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
    }
  `;

  @property()
  node: SerializedNode;

  @property({ type: Boolean })
  selected = false;

  @consume({ context: apiContext, subscribe: true })
  api: API;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  private handleToggleVisibility() {
    const isVisible = this.node.visibility !== 'hidden';
    this.api.updateNode(this.node, {
      visibility: isVisible ? 'hidden' : 'visible',
    });
    this.api.record();
  }

  private renderOverlayContent = () => {
    return html`
      <sp-popover
        @sp-opened=${(event: CustomEvent<OverlayOpenCloseDetail>) => {
          if (event.target !== event.currentTarget) {
            return;
          }

          if (!this.api.getAppState().propertiesOpened.includes(this.node.id)) {
            this.api.setPropertiesOpened([
              ...this.api.getAppState().propertiesOpened,
              this.node.id,
            ]);
          }
        }}
        @sp-closed=${(event: CustomEvent<OverlayOpenCloseDetail>) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          this.api.setPropertiesOpened(
            this.api
              .getAppState()
              .propertiesOpened.filter((id) => id !== this.node.id),
          );
        }}
      >
        <h4>Properties</h4>
        <ic-spectrum-properties-panel-content
          .node=${this.node}
        ></ic-spectrum-properties-panel-content>
      </sp-popover>
    `;
  };

  render() {
    const isVisible = this.node.visibility !== 'hidden';
    const isOpen = this.api
      .getAppState()
      .propertiesOpened.includes(this.node.id);
    const showProperties =
      this.selected &&
      !this.appState.taskbarSelected.includes(Task.SHOW_PROPERTIES_PANEL);

    return html`<span>
        <sp-action-button quiet size="s" @click=${this.handleToggleVisibility}>
          ${when(
            isVisible,
            () => html`<sp-icon-visibility slot="icon"></sp-icon-visibility>`,
            () =>
              html`<sp-icon-visibility-off
                slot="icon"
              ></sp-icon-visibility-off>`,
          )}
          <sp-tooltip self-managed placement="left"> Hide layer </sp-tooltip>
        </sp-action-button>
        <ic-spectrum-layer-thumbnail
          .node=${this.node}
          ?selected=${this.selected}
        ></ic-spectrum-layer-thumbnail>
      </span>
      <ic-spectrum-layer-name
        .node=${this.node}></ic-spectrum-layer-name>
      <div 
        class="layer-actions" style="visibility: ${
          showProperties ? 'visible' : 'hidden'
        };">
        <sp-action-button quiet size="m" .selected=${isOpen} ${trigger(
      this.renderOverlayContent,
      {
        open: isOpen,
        triggerInteraction: 'click',
        overlayOptions: {
          placement: 'bottom',
          offset: 6,
        },
      },
    )}>
          <sp-icon-properties slot="icon"></sp-icon-properties>
          <sp-tooltip self-managed placement="bottom">
            Layer properties</sp-tooltip
          >
        </sp-action-button>
      </div>
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel-item': LayersPanelItem;
  }
}
