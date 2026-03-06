import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import { apiContext, appStateContext } from '../context';
import { Task, API, AppState } from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';

@customElement('ic-spectrum-taskbar')
@localized()
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

  private previousTaskbarVisible: boolean;

  shouldUpdate(changedProperties: PropertyValues) {
    const newTaskbarVisible = this.appState.taskbarVisible;
    if (newTaskbarVisible !== this.previousTaskbarVisible) {
      this.previousTaskbarVisible = newTaskbarVisible;
      return true;
    }
    return super.shouldUpdate(changedProperties);
  }

  private handleTaskChanged(e: CustomEvent) {
    this.api.setAppState({
      taskbarSelected: (e.target as any).selected,
    });
  }

  render() {
    if (!this.api) {
      return;
    }

    const { taskbarSelected, taskbarVisible } =
      this.api.getAppState();

    return when(
      taskbarVisible,
      () => html`
        <sp-action-group
          class="taskbar"
          vertical
          quiet
          selects="multiple"
          .selected=${taskbarSelected}
          @change=${this.handleTaskChanged}
        >
          <sp-action-button value="${Task.SHOW_LAYERS_PANEL}">
            <sp-icon-layers slot="icon"></sp-icon-layers>
            <sp-tooltip self-managed placement="left">
              ${msg(str`Show layers panel`)}
            </sp-tooltip>
          </sp-action-button>
          <sp-action-button value="${Task.SHOW_PROPERTIES_PANEL}">
            <sp-icon-properties slot="icon"></sp-icon-properties>
            <sp-tooltip self-managed placement="left">
              ${msg(str`Show properties panel`)}
            </sp-tooltip>
          </sp-action-button>
          <slot name="taskbar-item"></slot>
        </sp-action-group>
        <div class="panels">
          <ic-spectrum-layers-panel></ic-spectrum-layers-panel>
          <ic-spectrum-properties-panel></ic-spectrum-properties-panel>
          <slot name="taskbar-panel"></slot>
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
