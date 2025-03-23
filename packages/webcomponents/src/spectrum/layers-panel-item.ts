import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { appStateContext, elementsContext, Task } from '../context';
import { AppState } from '../context';
import { Event } from '../event';
import { consume } from '@lit/context';

import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';

@customElement('ic-spectrum-layers-panel-item')
export class LayersPanelItem extends LitElement {
  static styles = css``;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;
  render() {
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel-item': LayersPanelItem;
  }
}
