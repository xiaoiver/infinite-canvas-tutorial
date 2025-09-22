import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { customElement } from 'lit/decorators.js';
import {
  SerializedNode,
  Task,
  AppState,
  API,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
@customElement('ic-spectrum-properties-panel')
export class PropertiesPanel extends LitElement {
  static styles = css`
    section {
      display: flex;
      flex-direction: column;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    h4 {
      padding: var(--spectrum-global-dimension-size-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
      color: canvastext;
    }

    .container {
      padding: var(--spectrum-global-dimension-size-100);
      padding-top: 0;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: nodesContext, subscribe: true })
  nodes: SerializedNode[];

  @consume({ context: apiContext, subscribe: true })
  api: API;

  private handleClose() {
    this.api.setAppState({
      taskbarSelected: this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_PROPERTIES_PANEL,
      ),
    });
  }

  render() {
    const { layersSelected, taskbarSelected } = this.appState;
    const enabled = taskbarSelected.includes(Task.SHOW_PROPERTIES_PANEL);

    if (!enabled) {
      return null;
    }

    // Display selected panel
    if (layersSelected.length > 1) {
      return html`<section>
        <h4>
          Properties
          <sp-action-button quiet size="s" @click=${this.handleClose}>
            <sp-icon-close slot="icon"></sp-icon-close>
          </sp-action-button>
        </h4>
        <div class="container">${layersSelected.length} selected</div>
      </section>`;
    }

    const node = this.api?.getNodeById(layersSelected[0]);
    return html`<section>
      <h4>
        Properties
        <sp-action-button quiet size="s" @click=${this.handleClose}>
          <sp-icon-close slot="icon"></sp-icon-close>
        </sp-action-button>
      </h4>
      <ic-spectrum-properties-panel-content
        .node=${node}
      ></ic-spectrum-properties-panel-content>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-properties-panel': PropertiesPanel;
  }
}
