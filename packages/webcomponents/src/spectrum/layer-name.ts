import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { query } from 'lit/decorators/query.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

import '@spectrum-web-components/textfield/sp-textfield.js';

@customElement('ic-spectrum-layer-name')
export class LayerName extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
    }

    sp-textfield {
      width: 100%;
    }
  `;

  @property()
  node: SerializedNode;

  @state()
  editing = false;

  @query('sp-textfield')
  textfield: LitElement;

  private handleDoubleClick() {
    this.editing = true;

    setTimeout(() => {
      this.textfield.focus();
    }, 0);
  }

  private handleBlur() {
    this.editing = false;
  }

  render() {
    return html`
      ${when(
        this.editing,
        () => html`<sp-textfield
          quiet
          size="s"
          @blur=${this.handleBlur}
        ></sp-textfield>`,
        () =>
          html`<span @dblclick=${this.handleDoubleClick}
            >Layer ${this.node.id}</span
          >`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-name': LayerName;
  }
}
