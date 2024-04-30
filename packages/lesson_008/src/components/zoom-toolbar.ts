import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import type { Canvas } from '../Canvas';

@customElement('ic-zoom-toolbar-lesson8')
export class ZoomToolbar extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      right: 16px;
      bottom: 16px;
      box-shadow: var(--sl-shadow-medium);
      background: white;
    }

    span {
      font-size: 12px;
      line-height: 32px;
      width: 32px;
      text-align: center;
      color: var(--sl-color-neutral-600);
    }
  `;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  @property()
  zoom = 100;

  private zoomOut() {
    this.canvas.zoomOut();
  }

  private zoomIn() {
    this.canvas.zoomIn();
  }

  render() {
    return html`
      <sl-button-group label="Zoom toolbar">
        <sl-tooltip content="Zoom out">
          <sl-icon-button
            name="dash-lg"
            label="Zoom out"
            @click="${this.zoomOut}"
          ></sl-icon-button>
        </sl-tooltip>
        <span>${this.zoom}%</span>
        <sl-tooltip content="Zoom in">
          <sl-icon-button
            name="plus-lg"
            label="Zoom in"
            @click="${this.zoomIn}"
          ></sl-icon-button>
        </sl-tooltip>
      </sl-button-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-zoom-toolbar-lesson8': ZoomToolbar;
  }
}
