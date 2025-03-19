import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { map } from 'lit/directives/map.js';

import '@shoelace-style/shoelace/dist/components/button-group/button-group.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';

const PEN_LIST = [
  { name: Pen.HAND, label: 'Move', icon: 'arrows-move' },
  { name: Pen.SELECT, label: 'Select', icon: 'cursor' },
  { name: Pen.DRAW_RECT, label: 'Draw rectangle', icon: 'square' },
];

@customElement('ic-shoelace-pen-toolbar')
export class PenToolbar extends LitElement {
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

    .active {
      background: var(--sl-color-neutral-200);
    }
  `;

  @property()
  pen: Pen;

  @property({ type: Array })
  pens: Pen[];

  private changePen(pen: Pen) {
    const detail = { pen };
    const event = new CustomEvent(Event.PEN_CHANGED, {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    const pens = this.pens.map((name) =>
      PEN_LIST.find((item) => item.name === name),
    );
    return html`
      <sl-button-group label="Zoom toolbar">
        ${map(pens, ({ name, label, icon }) => {
          const classes = { active: this.pen === name };
          return html`<sl-tooltip content=${label}>
            <sl-icon-button
              class=${classMap(classes)}
              name=${icon}
              label=${label}
              @click="${() => this.changePen(name)}"
            ></sl-icon-button>
          </sl-tooltip>`;
        })}
      </sl-button-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-shoelace-pen-toolbar': PenToolbar;
  }
}
