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
import { normalizeSolidCssValue } from './normalize-solid-css';

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
    const { type, value, fillOpacity } = e.detail;
    this.api.updateNode(this.node, {
      fill: type === 'solid' ? normalizeSolidCssValue(value) : value,
      ...(fillOpacity !== undefined && { fillOpacity }),
    });
    this.api.record();
  }

  /** 外部 `fillOpacity` 模式下仅透明度由 `opacity-change` 更新（不冒泡 `color-change`）。 */
  private handleFillOpacityChanged(e: CustomEvent<{ fillOpacity?: number }>) {
    const { fillOpacity } = e.detail;
    if (fillOpacity === undefined) return;
    this.api.updateNode(this.node, { fillOpacity });
    this.api.record();
  }

  render() {
    if (!this.node) {
      return html``;
    }

    const { fill, fillOpacity = 1 } = this.node as TextSerializedNode;

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
            .fillOpacity=${fillOpacity}
            @color-change=${this.handleFillChanged}
            @opacity-change=${this.handleFillOpacityChanged}
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
