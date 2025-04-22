import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { consume } from '@lit/context';
import { Pen, AppState, API } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';

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

  @consume({ context: apiContext, subscribe: true })
  api: API;

  private handlePenChanged(e: CustomEvent) {
    this.api.setPen((e.target as any).selected[0]);
  }

  render() {
    const { penbarAll, penbarSelected } = this.appState;
    return html`
      <sp-action-group
        vertical
        selects="single"
        .selected=${penbarSelected}
        @change=${this.handlePenChanged}
        emphasized
        quiet
      >
        ${map(penbarAll, (pen) => {
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
