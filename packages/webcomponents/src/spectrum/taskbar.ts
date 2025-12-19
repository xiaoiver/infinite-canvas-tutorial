import { html, css, LitElement, PropertyValues, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import { apiContext, appStateContext } from '../context';
import { Pen, Task, API, AppState } from '@infinite-canvas-tutorial/ecs';

const TaskMap = {
  [Task.SHOW_LAYERS_PANEL]: {
    icon: html`<sp-icon-layers slot="icon"></sp-icon-layers>`,
    label: 'Show layers panel',
    panel: html`<ic-spectrum-layers-panel></ic-spectrum-layers-panel>`,
  },
  [Task.SHOW_PROPERTIES_PANEL]: {
    icon: html`<sp-icon-properties slot="icon"></sp-icon-properties>`,
    label: 'Show properties panel',
    panel: html`<ic-spectrum-properties-panel></ic-spectrum-properties-panel>`,
  },
  [Task.SHOW_CHAT_PANEL]: {
    icon: html`<sp-icon-chat slot="icon"></sp-icon-chat>`,
    label: 'Show chat panel',
    panel: html`<ic-spectrum-chat-panel></ic-spectrum-chat-panel>`,
  },
};

export function registerTask(
  task: Task,
  icon: TemplateResult<1>,
  label: string,
  panel: TemplateResult<1>,
) {
  TaskMap[task] = {
    icon,
    label,
    panel,
  };
}

@customElement('ic-spectrum-taskbar')
export class Taskbar extends LitElement {
  static styles = css`
    .taskbar {
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

    .panels {
      position: absolute;
      top: 0px;
      right: 54px;
      display: flex;
      flex-direction: column;
      z-index: 1;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: API;

  private previousPen: Pen;

  private handleTaskChanged(e: CustomEvent) {
    this.api.setAppState({
      taskbarSelected: (e.target as any).selected,
    });
  }

  shouldUpdate(changedProperties: PropertyValues) {
    for (const prop of changedProperties.keys()) {
      if (prop !== 'appState') return true;
    }

    const newPen = this.appState.penbarSelected;
    if (newPen !== this.previousPen) {
      this.previousPen = newPen;
      return true;
    }

    return false;
  }

  render() {
    if (!this.api) {
      return;
    }

    const { taskbarAll, taskbarSelected, taskbarVisible, penbarSelected } =
      this.api.getAppState();
    return when(
      taskbarVisible && penbarSelected !== Pen.HAND,
      () => html`
        <sp-action-group
          class="taskbar"
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
        <div class="panels">
          ${map(taskbarAll, (task) => {
            const { panel } = TaskMap[task];
            return panel;
          })}
        </div>
      `,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-taskbar': Taskbar;
  }
}
