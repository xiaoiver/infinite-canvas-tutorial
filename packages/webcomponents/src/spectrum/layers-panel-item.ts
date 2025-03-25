import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { appStateContext, AppState } from '../context';
import { Event } from '../event';

import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-visibility-off.js';

@customElement('ic-spectrum-layers-panel-item')
export class LayersPanelItem extends LitElement {
  static styles = css`
    :host {
      width: 320px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    :host > span {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @property()
  node: SerializedNode;

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
      ></ic-spectrum-layer-thumbnail>
      <ic-spectrum-layer-name .node=${this.node}></ic-spectrum-layer-name>
    </span> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel-item': LayersPanelItem;
  }
}
