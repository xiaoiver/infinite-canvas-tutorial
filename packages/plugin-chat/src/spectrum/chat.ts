import { html, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement } from 'lit/decorators.js';
import { Task } from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-chat.js';
import {
  apiContext,
  ExtendedAPI,
} from '@infinite-canvas-tutorial/webcomponents';

@customElement('ic-spectrum-taskbar-chat')
@localized()
export class Chat extends LitElement {
  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  render() {
    return html` <sp-action-button value="${Task.SHOW_CHAT_PANEL}">
      <sp-icon-chat slot="icon"></sp-icon-chat>
      <sp-tooltip self-managed placement="left">
        ${msg(str`Show chat panel`)}
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
    'ic-spectrum-taskbar-chat': Chat;
  }
}
