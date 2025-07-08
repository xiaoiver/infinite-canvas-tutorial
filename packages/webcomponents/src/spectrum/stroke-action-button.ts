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
import { ColorType } from './color-picker';

@customElement('ic-spectrum-stroke-action-button')
export class StrokeActionButton extends LitElement {
  static styles = css`
    ic-spectrum-stroke-icon {
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

  private handleStrokeChanged(e: CustomEvent) {
    const { type, value } = e.detail;
    this.api.updateNode(this.node, {
      stroke:
        type === 'solid'
          ? value.startsWith('#')
            ? value
            : `#${value}`
          : value,
    });
    this.api.record();
  }

  render() {
    if (!this.node) {
      return html``;
    }

    const { stroke } = this.node as TextSerializedNode;

    return html`<sp-action-button quiet size="m" id="stroke">
        <ic-spectrum-stroke-icon
          value=${stroke}
          slot="icon"
        ></ic-spectrum-stroke-icon>
        <sp-tooltip self-managed placement="bottom"> Stroke </sp-tooltip>
      </sp-action-button>
      <sp-overlay trigger="stroke@click" placement="bottom" type="auto">
        <sp-popover dialog>
          <ic-spectrum-color-picker
            value=${stroke}
            .types=${[ColorType.None, ColorType.Solid]}
            @color-change=${this.handleStrokeChanged}
          ></ic-spectrum-color-picker>
        </sp-popover>
      </sp-overlay>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-stroke-action-button': StrokeActionButton;
  }
}
