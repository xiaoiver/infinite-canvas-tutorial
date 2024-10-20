import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import type { Canvas } from '@infinite-canvas-tutorial/core';

@customElement('ic-pen-toolbar')
export class PenToolbar extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
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

  render() {
    return html`
      <sl-button-group label="Zoom toolbar">
        <sl-tooltip content="Zoom out">
          <sl-icon-button name="dash-lg" label="Zoom out"></sl-icon-button>
        </sl-tooltip>
        <sl-tooltip content="Zoom in">
          <sl-icon-button name="plus-lg" label="Zoom in"></sl-icon-button>
        </sl-tooltip>
      </sl-button-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-pen-toolbar': PenToolbar;
  }
}
