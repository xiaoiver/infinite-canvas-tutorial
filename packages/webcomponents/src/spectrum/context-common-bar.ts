import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

@customElement('ic-spectrum-context-common-bar')
export class ContextCommonBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
    }

    sp-popover {
      padding: 0;
    }

    h4 {
      margin: 0;
      padding: 8px;
      padding-bottom: 0;
    }

    ic-spectrum-stroke-content {
      padding: 8px;
    }
  `;

  @property()
  node: SerializedNode;

  render() {
    const isText = this.node?.type === 'text';

    return html`<ic-spectrum-fill-action-button
        .node=${this.node}
      ></ic-spectrum-fill-action-button>
      ${when(
        !isText,
        () => html`<ic-spectrum-stroke-action-button
            .node=${this.node}
          ></ic-spectrum-stroke-action-button>
          <sp-action-button quiet size="m" id="stroke-options">
            <sp-tooltip self-managed placement="bottom">
              Stroke options
            </sp-tooltip>
            <sp-icon-stroke-width slot="icon"></sp-icon-stroke-width>
          </sp-action-button>
          <sp-overlay
            trigger="stroke-options@click"
            placement="bottom"
            type="auto"
          >
            <sp-popover dialog>
              <h4>Stroke options</h4>
              <ic-spectrum-stroke-content
                .node=${this.node}
              ></ic-spectrum-stroke-content>
            </sp-popover>
          </sp-overlay>`,
      )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-common-bar': ContextCommonBar;
  }
}
