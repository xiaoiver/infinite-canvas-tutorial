import { html, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement } from 'lit/decorators.js';
import {
  ExtendedAPI,
  apiContext,
} from '@infinite-canvas-tutorial/webcomponents';
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-events.js';

@customElement('ic-spectrum-penbar-laser-pointer')
@localized()
export class LaserPointer extends LitElement {
  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  render() {
    return html`<sp-action-button value="${Pen.LASER_POINTER}">
      <sp-icon-events slot="icon"></sp-icon-events>
      <sp-tooltip self-managed placement="right">
        ${msg(str`Laser pointer`)}
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
    'ic-spectrum-penbar-laser-pointer': LaserPointer;
  }
}
