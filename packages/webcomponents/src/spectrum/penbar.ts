import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { consume } from '@lit/context';
import { Pen } from '@infinite-canvas-tutorial/ecs';
import { AppState, appStateContext } from '../context';
import { Event } from '../event';

const PenMap = {
  [Pen.HAND]: {
    icon: html`<sp-icon-hand slot="icon"></sp-icon-hand>`,
    label: 'Hand (Panning tool)',
  },
  [Pen.SELECT]: {
    icon: html`<sp-icon-select slot="icon"></sp-icon-select>`,
    label: 'Select',
  },
  [Pen.DRAW_RECT]: {
    icon: html`<sp-icon-shapes slot="icon"></sp-icon-shapes>`,
    label: 'Shapes',
  },
};

@customElement('ic-spectrum-penbar')
export class Penbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      justify-content: center;

      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      padding: var(--spectrum-global-dimension-size-100);
      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  private handlePenChanged(e: CustomEvent) {
    const event = new CustomEvent(Event.PEN_CHANGED, {
      detail: { selected: (e.target as any).selected },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    const { all, selected } = this.appState.penbar;
    return html`
      <sp-action-group
        vertical
        selects="single"
        .selected=${selected}
        @change=${this.handlePenChanged}
        emphasized
        quiet
      >
        ${map(all, (pen) => {
          const { icon, label } = PenMap[pen];
          return html`<sp-action-button value="${pen}">
            ${icon}
            <sp-tooltip self-managed placement="right"> ${label} </sp-tooltip>
          </sp-action-button>`;
        })}
      </sp-action-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar': Penbar;
  }
}
