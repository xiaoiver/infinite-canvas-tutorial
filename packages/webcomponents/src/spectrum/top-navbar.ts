import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  DataURLType,
  VectorScreenshotRequest,
  RasterScreenshotRequest,
} from '@infinite-canvas-tutorial/ecs';
import { AppState, appStateContext } from '../context';
import { Event } from '../event';

import '@spectrum-web-components/icons-workflow/icons/sp-icon-show-menu.js';
@customElement('ic-spectrum-top-navbar')
export class TopNavbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      justify-content: space-between;
      padding: var(--spectrum-global-dimension-size-100);
      background: var(--spectrum-gray-100);
    }

    sp-menu-item {
      width: 200px;
    }

    kbd {
      font-family: var(--spectrum-alias-body-text-font-family);
      letter-spacing: 0.1em;
      white-space: nowrap;
      border: none;
      padding: none;
      padding: 0;
      line-height: normal;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  private handleExport(event: CustomEvent) {
    const format = (event.target as any).value;

    let detail: RasterScreenshotRequest | VectorScreenshotRequest;
    if (format === 'png' || format === 'jpeg') {
      detail = new RasterScreenshotRequest();
      (detail as RasterScreenshotRequest).type =
        `image/${format}` as DataURLType;
    } else {
      detail = new VectorScreenshotRequest();
    }

    this.dispatchEvent(
      new CustomEvent(Event.SCREENSHOT_REQUESTED, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <sp-action-menu size="m" label="Main menu" quiet>
        <sp-tooltip slot="tooltip" self-managed placement="bottom">
          Main menu
        </sp-tooltip>
        <sp-icon-show-menu slot="icon" size="l"></sp-icon-show-menu>
        <sp-menu-item>
          Export as...
          <kbd slot="value">⌥⇧⌘W</kbd>
          <sp-menu slot="submenu" @change=${this.handleExport}>
            <sp-menu-item value="svg">SVG</sp-menu-item>
            <sp-menu-item value="png">PNG</sp-menu-item>
            <sp-menu-item value="jpeg">JPEG</sp-menu-item>
          </sp-menu>
        </sp-menu-item>
      </sp-action-menu>
      <ic-spectrum-zoom-toolbar />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-top-navbar': TopNavbar;
  }
}
