import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { map } from 'lit/directives/map.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import { CanvasMode, type Canvas } from '@infinite-canvas-tutorial/core';

import '@shoelace-style/shoelace/dist/components/button-group/button-group.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';

const MODE_LIST = [
  { name: CanvasMode.HAND, label: 'Move', icon: 'arrows-move' },
  { name: CanvasMode.SELECT, label: 'Select', icon: 'cursor' },
  { name: CanvasMode.DRAW_RECT, label: 'Draw rectangle', icon: 'square' },
];
@customElement('ic-mode-toolbar')
export class ModeToolbar extends LitElement {
  static styles = css`
    :host {
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

    .active {
      background: var(--sl-color-neutral-200);
    }
  `;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  @property()
  mode: CanvasMode;

  @property({ type: Array })
  modes: CanvasMode[];

  private changeCanvasMode(mode: CanvasMode) {
    const detail = { mode };
    const event = new CustomEvent('modechanged', {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    const modes = this.modes.map((name) =>
      MODE_LIST.find((item) => item.name === name),
    );
    return html`
      <sl-button-group label="Zoom toolbar">
        ${map(modes, ({ name, label, icon }) => {
          const classes = { active: this.mode === name };
          return html`<sl-tooltip content=${label}>
            <sl-icon-button
              class=${classMap(classes)}
              name=${icon}
              label=${label}
              @click="${() => this.changeCanvasMode(name)}"
            ></sl-icon-button>
          </sl-tooltip>`;
        })}
      </sl-button-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-mode-toolbar': ModeToolbar;
  }
}
