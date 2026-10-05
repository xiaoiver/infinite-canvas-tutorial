import { css, html, LitElement, type PropertyValues } from 'lit';
import { consume } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { query } from 'lit/decorators/query.js';
import { SerializedNode, API } from '@infinite-canvas-tutorial/ecs';
import { apiContext } from '../context';
import { editLayer } from './layer-command';

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

  private session?: { api: API; id: string };

  disconnectedCallback() {
    this.cancelEditing();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    if (
      this.session &&
      (this.session.api !== this.api || this.session.id !== this.node?.id)
    ) {
      this.cancelEditing();
    }
  }

  /** Start a draft owned by this canvas and layer. */
  beginEditing() {
    const current = this.api.getNodeById(this.node.id);
    if (!current || current.isDeleted || current.locked) return;
    if (!this.editing) {
      this.session = { api: this.api, id: current.id };
      this.editing = true;
    }
    void this.updateComplete.then(() => {
      if (this.editing && this.isConnected) this.focusTextfield();
    });
  }

  private cancelEditing() {
    this.session = undefined;
    this.editing = false;
  }

  private focusTextfield() {
    const el = this.textfield as
      | (LitElement & { focus?: (o?: FocusOptions) => void })
      | undefined;
    el?.focus?.();
  }

  private handleKeydown(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelEditing();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.textfield.blur();
    }
  }

  private handleBlur() {
    const session = this.session;
    if (!this.editing || !session) return;
    const name = (this.textfield as LitElement & { value: string }).value;
    this.cancelEditing();
    // Removing or recycling a row can blur its input. Discard that draft before
    // submitting; an accepted command remains bound to its original target.
    queueMicrotask(() => {
      if (
        this.isConnected &&
        this.api === session.api &&
        this.node?.id === session.id
      ) {
        void editLayer(session.api, session.id, 'rename', name);
      }
    });
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
