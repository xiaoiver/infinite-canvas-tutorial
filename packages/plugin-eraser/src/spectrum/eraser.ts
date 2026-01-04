import { html, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement } from 'lit/decorators.js';
import {
  ExtendedAPI,
  apiContext,
} from '@infinite-canvas-tutorial/webcomponents';
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-erase.js';

@customElement('ic-spectrum-penbar-eraser')
@localized()
export class Eraser extends LitElement {
  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  render() {
    return html`<sp-action-button value="${Pen.ERASER}">
      <sp-icon-erase slot="icon"></sp-icon-erase>
      <sp-tooltip self-managed placement="right">
        ${msg(str`Eraser`)}
      </sp-tooltip>
    </sp-action-button>`;
  }

  // @see https://lit.dev/docs/components/shadow-dom/#slots
  protected createRenderRoot() {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar-eraser': Eraser;
  }
}
