import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement } from 'lit/decorators.js';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

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

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

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
    if (document.activeElement !== this.api.element) {
      return;
    }

    if ((e.key === '+' || e.key === '=') && e.metaKey) {
      e.preventDefault();
      this.zoomIn();
    } else if ((e.key === '-' || e.key === '_') && e.metaKey) {
      e.preventDefault();
      this.zoomOut();
    } else if (e.key === '1' && e.metaKey) {
      e.preventDefault();
      this.zoomTo100();
    } else if (e.key === '2' && e.metaKey) {
      e.preventDefault();
      this.zoomTo200();
    } else if (e.key === '0' && e.metaKey) {
      e.preventDefault();
      // TODO: fit to screen
    } else if (e.key === 'f') {
      e.preventDefault();
      // TODO: full screen mode
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
    this.api.zoomTo(findZoomFloor(this.api.getAppState().cameraZoom));
  }

  private zoomIn() {
    this.api.zoomTo(findZoomCeil(this.api.getAppState().cameraZoom));
  }

  private zoomTo100() {
    this.api.zoomTo(1);
  }

  private zoomTo200() {
    this.api.zoomTo(2);
  }

  render() {
    return html`
      <sp-action-menu size="m" label="Zoom level">
        <sp-tooltip slot="tooltip" self-managed placement="bottom">
          Zoom level
        </sp-tooltip>
        <span slot="label">
          <span>${Math.round(this.appState.cameraZoom * 100)}</span>%</span
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
