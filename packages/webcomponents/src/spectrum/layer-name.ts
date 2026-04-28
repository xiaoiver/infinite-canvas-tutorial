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
      color: canvastext;
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
      text-overflow: ellipsis;
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

  /**
   * 进入重命名；可由父级（如图层行）在整行 double-click 时调用。
   * 若已在编辑中，则只尝试聚焦输入框。
   */
  beginEditing() {
    if (this.node.locked) {
      return;
    }
    if (this.editing) {
      this.updateComplete.then(() => this.focusTextfield());
      return;
    }
    this.editing = true;
    this.updateComplete.then(() => this.focusTextfield());
  }

  private focusTextfield() {
    const el = this.textfield as
      | (LitElement & { focus?: (o?: FocusOptions) => void })
      | undefined;
    el?.focus?.();
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
      () =>
        html`<span @dblclick=${() => this.beginEditing()}>${name}</span>`,
    )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-name': LayerName;
  }
}
