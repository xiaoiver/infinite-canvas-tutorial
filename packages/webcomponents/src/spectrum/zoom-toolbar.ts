import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement } from 'lit/decorators.js';
import { Event } from '../event';
import { AppState, appStateContext } from '../context';

import '@spectrum-web-components/action-menu/sp-action-menu.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/menu/sp-menu-divider.js';
import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js';

const ZOOM_STEPS = [
  0.02, 0.05, 0.1, 0.15, 0.2, 0.33, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4,
];
export const findZoomCeil = (zoom: number) => {
  return (
    ZOOM_STEPS.find((step) => step > zoom) || ZOOM_STEPS[ZOOM_STEPS.length - 1]
  );
};
export const findZoomFloor = (zoom: number) => {
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom) || ZOOM_STEPS[0];
};

@customElement('ic-spectrum-zoom-toolbar')
export class ZoomToolbar extends LitElement {
  static styles = css`
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

    sp-action-menu span[slot='label'] > span {
      display: inline-block;
      width: 28px;
      text-align: center;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Canvas is focused
    // console.log(document.activeElement);

    if ((e.key === '+' || e.key === '=') && e.metaKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.zoomIn();
    } else if ((e.key === '-' || e.key === '_') && e.metaKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.zoomOut();
    } else if (e.key === '1' && e.metaKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.zoomTo100();
    } else if (e.key === '2' && e.metaKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.zoomTo200();
    } else if (e.key === '0' && e.metaKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      // this.zoomTo100();
      // TODO: fit to screen
    } else if (e.key === 'f') {
      // TODO: full screen mode
      e.preventDefault();
      e.stopImmediatePropagation();
      this.toggleFullScreen();
    }
  };

  private toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  private zoomOut() {
    const event = new CustomEvent(Event.ZOOM_TO, {
      detail: {
        zoom: findZoomFloor(this.appState.zoom),
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private zoomIn() {
    const event = new CustomEvent(Event.ZOOM_TO, {
      detail: {
        zoom: findZoomCeil(this.appState.zoom),
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private zoomTo100() {
    const event = new CustomEvent(Event.ZOOM_TO, {
      detail: { zoom: 1 },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private zoomTo200() {
    const event = new CustomEvent(Event.ZOOM_TO, {
      detail: { zoom: 2 },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <sp-action-menu size="m" label="Zoom level">
        <sp-tooltip slot="tooltip" self-managed placement="bottom">
          Zoom level
        </sp-tooltip>
        <span slot="label">
          <span>${Math.round(this.appState.zoom * 100)}</span>%</span
        >
        <sp-icon-chevron-down slot="icon" size="l"></sp-icon-chevron-down>
        <sp-menu-item @click=${this.zoomIn}>
          Zoom in
          <kbd slot="value">⌘+</kbd>
        </sp-menu-item>
        <sp-menu-item @click=${this.zoomOut}>
          Zoom out
          <kbd slot="value">⌘-</kbd>
        </sp-menu-item>
        <sp-menu-divider></sp-menu-divider>
        <sp-menu-item @click=${this.zoomTo100}>
          100%
          <kbd slot="value">⌘1</kbd>
        </sp-menu-item>
        <sp-menu-item @click=${this.zoomTo200}>
          200%
          <kbd slot="value">⌘2</kbd>
        </sp-menu-item>
        <sp-menu-item>
          Fit to screen
          <kbd slot="value">⌘0</kbd>
        </sp-menu-item>
        <sp-menu-item> Fill screen </sp-menu-item>
        <sp-menu-divider></sp-menu-divider>
        <sp-menu-item @click=${this.toggleFullScreen}>
          Full screen mode
          <kbd slot="value">F</kbd>
        </sp-menu-item>
      </sp-action-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-zoom-toolbar': ZoomToolbar;
  }
}
