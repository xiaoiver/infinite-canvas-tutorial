import { css, html, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { query } from 'lit/decorators/query.js';
import { SerializedNode, API } from '@infinite-canvas-tutorial/ecs';
import { apiContext } from '../context';

@customElement('ic-spectrum-layer-name')
export class LayerName extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
    }

    sp-textfield {
      width: 100%;
      margin-top: 4px;
    }

    span {
      width: 100%;
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

  @consume({ context: apiContext, subscribe: true })
  api: API;

  private handleDoubleClick() {
    this.editing = true;

    setTimeout(() => {
      this.textfield.focus();
    }, 0);
  }

  private handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.textfield.blur();
    }
  }

  private handleBlur() {
    this.editing = false;

    this.api.updateNode(this.node, {
      name: (this.textfield as any).value,
    });
    this.api.record();
  }

  render() {
    const { name } = this.node;

    return html`
      ${when(
        this.editing,
        () => html`<sp-textfield
          quiet
          size="m"
          @blur=${this.handleBlur}
          @keydown=${this.handleKeydown}
          value=${name}
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
