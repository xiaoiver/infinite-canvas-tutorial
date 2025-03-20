import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { consume } from '@lit/context';
import { AppState, appStateContext, Task } from '../context';
import { Event } from '../event';

import '@spectrum-web-components/action-group/sp-action-group.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-layers.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-properties.js';

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

  private handleTaskChanged(e: CustomEvent) {
    const event = new CustomEvent(Event.TASK_CHANGED, {
      detail: { selected: (e.target as any).selected },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    const { all, selected } = this.appState.taskbar;
    return html`
      <sp-action-group
        vertical
        quiet
        selects="multiple"
        .selected=${selected}
        @change=${this.handleTaskChanged}
      >
        ${map(all, (task) => {
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
