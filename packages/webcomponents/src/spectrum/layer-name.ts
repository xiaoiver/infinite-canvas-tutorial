import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { query } from 'lit/decorators/query.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

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

    span {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
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
    const { id, type } = this.node;
    let name = `Layer ${id}`;
    if (type === 'text') {
      name = this.node.attributes.content;
    }

    return html`
      ${when(
        this.editing,
        () => html`<sp-textfield
          quiet
          size="s"
          @blur=${this.handleBlur}
        ></sp-textfield>`,
        () => html`<span @dblclick=${this.handleDoubleClick}>${name}</span>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-name': LayerName;
  }
}
