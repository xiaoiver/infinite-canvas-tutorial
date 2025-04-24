import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  SerializedNode,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

@customElement('ic-spectrum-fill-action-button')
export class FillActionButton extends LitElement {
  static styles = css`
    ic-spectrum-fill-icon {
      width: 30px;
      height: 30px;
    }

    sp-popover {
      padding: 0;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  private handleFillChanged(e: CustomEvent) {
    const { type, value } = e.detail;
    this.api.updateNode(this.node, {
      fill:
        type === 'solid'
          ? value.startsWith('#')
            ? value
            : `#${value}`
          : value,
    });
    this.api.record();
  }

  render() {
    const { fill } = this.node as TextSerializedNode;

    return html`<sp-action-button quiet size="m" id="fill">
        <ic-spectrum-fill-icon
          value=${fill}
          .node=${this.node}
          slot="icon"
        ></ic-spectrum-fill-icon>
        <sp-tooltip self-managed placement="bottom"> Fill </sp-tooltip>
      </sp-action-button>
      <sp-overlay trigger="fill@click" placement="bottom" type="auto">
        <sp-popover dialog>
          <ic-spectrum-color-picker
            value=${fill}
            @color-change=${this.handleFillChanged}
          ></ic-spectrum-color-picker>
        </sp-popover>
      </sp-overlay>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-fill-action-button': FillActionButton;
  }
}
