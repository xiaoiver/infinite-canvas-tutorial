import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { consume } from '@lit/context';
import { apiContext, AppState, appStateContext, Task } from '../context';
import { API } from '../API';

const TaskMap = {
  [Task.SHOW_LAYERS_PANEL]: {
    icon: html`<sp-icon-layers slot="icon"></sp-icon-layers>`,
    label: 'Show layers panel',
  },
  [Task.SHOW_PROPERTIES_PANEL]: {
    icon: html`<sp-icon-properties slot="icon"></sp-icon-properties>`,
    label: 'Show properties panel',
  },
};

@customElement('ic-spectrum-taskbar')
export class Taskbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);
      justify-content: center;

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

  private handleTaskChanged(e: CustomEvent) {
    this.api.setTaskbars((e.target as any).selected);
  }

  render() {
    const { taskbarAll, taskbarSelected } = this.appState;
    return html`
      <sp-action-group
        vertical
        quiet
        selects="multiple"
        .selected=${taskbarSelected}
        @change=${this.handleTaskChanged}
      >
        ${map(taskbarAll, (task) => {
          const { icon, label } = TaskMap[task];
          return html`<sp-action-button value="${task}">
            ${icon}
            <sp-tooltip self-managed placement="left"> ${label} </sp-tooltip>
          </sp-action-button>`;
        })}
      </sp-action-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-taskbar': Taskbar;
  }
}
