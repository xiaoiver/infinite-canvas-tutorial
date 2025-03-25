import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

import '@spectrum-web-components/textfield/sp-textfield.js';

@customElement('ic-spectrum-layer-name')
export class LayerName extends LitElement {
  @property()
  node: SerializedNode;

  @state()
  editing = false;

  render() {
    return html`
      ${when(
        this.editing,
        () => html`<sp-textfield quiet size="s"></sp-textfield>`,
        () => html`<span>Layer ${this.node.id}</span>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-name': LayerName;
  }
}
