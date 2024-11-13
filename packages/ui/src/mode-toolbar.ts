import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import { CanvasMode, type Canvas } from '@infinite-canvas-tutorial/core';

@customElement('ic-mode-toolbar')
export class ModeToolbar extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      left: 50%;
      top: 16px;
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

  private setHandMode() {
    // TODO: change canvas cursor to grab
    this.canvas.mode = CanvasMode.HAND;
  }

  private setSelectMode() {
    this.canvas.mode = CanvasMode.SELECT;
  }

  render() {
    return html`
      <sl-button-group label="Zoom toolbar">
        <sl-tooltip content="Move">
          <sl-icon-button
            name="arrows-move"
            label="Move"
            @click="${this.setHandMode}"
          ></sl-icon-button>
        </sl-tooltip>
        <sl-tooltip content="Select">
          <sl-icon-button
            name="cursor"
            label="Select"
            @click="${this.setSelectMode}"
          ></sl-icon-button>
        </sl-tooltip>
      </sl-button-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-mode-toolbar': ModeToolbar;
  }
}
