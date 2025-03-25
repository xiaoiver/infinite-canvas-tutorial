import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';

import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility-off.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-properties.js';

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
  `;

  @property()
  node: SerializedNode;

  @property({ type: Boolean })
  selected = false;

  private handleToggleVisibility() {
    this.dispatchEvent(
      new CustomEvent(Event.VISIBILITY_CHANGED, {
        detail: {
          // visible: !this.node.visible,
        },
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
  }

  render() {
    return html`<span>
        <sp-action-button quiet size="s" @click=${this.handleToggleVisibility}>
          <sp-icon-visibility slot="icon"></sp-icon-visibility>
          <sp-tooltip self-managed placement="left"> Hide layer </sp-tooltip>
        </sp-action-button>
        <ic-spectrum-layer-thumbnail
          .node=${this.node}
          ?selected=${this.selected}
        ></ic-spectrum-layer-thumbnail>
      </span>
      <ic-spectrum-layer-name
        .node=${this.node}></ic-spectrum-layer-name>
      <div class="layer-actions" style="visibility: ${
        this.selected ? 'visible' : 'hidden'
      };">
        <sp-action-button quiet size="m">
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
