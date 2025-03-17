import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/button-group/button-group.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { Event } from './event';

@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {
  static styles = css`
    :host {
      box-shadow: var(--sl-shadow-medium);
      background: var(--sl-panel-background-color);
    }

    span {
      font-size: 12px;
      line-height: 32px;
      width: 32px;
      text-align: center;
      color: var(--sl-color-neutral-600);
    }
  `;

  @property({ type: Number })
  zoom = 1;

  private zoomOut() {
    const event = new CustomEvent(Event.ZOOM_OUT, {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private zoomIn() {
    const event = new CustomEvent(Event.ZOOM_IN, {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <sl-button-group label="Zoom toolbar">
        <sl-tooltip content="Zoom out">
          <sl-icon-button
            name="dash-lg"
            label="Zoom out"
            @click=${this.zoomOut}
          ></sl-icon-button>
        </sl-tooltip>
        <span>${Math.round(this.zoom * 100)}%</span>
        <sl-tooltip content="Zoom in">
          <sl-icon-button
            name="plus-lg"
            label="Zoom in"
            @click=${this.zoomIn}
          ></sl-icon-button>
        </sl-tooltip>
      </sl-button-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-zoom-toolbar': ZoomToolbar;
  }
}
