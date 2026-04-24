import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { ExportFormat, SerializedNode, AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { type ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';

@customElement('ic-spectrum-export-panel')
@localized()
export class ExportPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .export-block {
      display: flex;
      flex-direction: column;
      gap: var(--spectrum-global-dimension-size-50);
    }

    .export-row {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: flex-end;
      gap: var(--spectrum-global-dimension-size-50);
    }

    .export-picker {
      flex: 1 1 0;
      min-width: 0;
    }

    .export-picker sp-picker {
      display: block;
      width: 100%;
    }

    .export-cta {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @state()
  private exportFormat: ExportFormat = ExportFormat.PNG;

  @state()
  private exportScaleKey = '1';

  private getNodesForExport(): SerializedNode[] {
    if (!this.api) {
      return [];
    }
    const { layersSelected } = this.appState;
    if (layersSelected.length === 0) {
      return [];
    }
    const nodes = layersSelected
      .map((id) => this.api.getNodeById(id))
      .filter((n): n is SerializedNode => n != null);
    return nodes.flatMap((node) => [node, ...this.api.getChildrenRecursively(node)]);
  }

  private handleExportClick = () => {
    if (!this.api) {
      return;
    }
    const scale = Math.max(
      0.25,
      Math.min(8, parseFloat(this.exportScaleKey) || 1),
    );
    const nodes = this.getNodesForExport();
    this.api.export({ format: this.exportFormat, nodes, scale });
  };

  private handleExportFormatChange = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    if (v) {
      this.exportFormat = v as ExportFormat;
    }
  };

  private handleExportScaleChange = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    if (v) {
      this.exportScaleKey = v;
    }
  };

  render() {
    const n = this.appState.layersSelected.length;
    const label =
      n === 0
        ? msg(str`Export canvas`)
        : n === 1
          ? msg(str`Export layer (1)`)
          : msg(str`Export layers (${n})`);
    return html`
      <div class="export-block">
        <div class="export-row">
          <div class="export-picker">
            <sp-picker
              size="s"
              label=${msg(str`Scale`)}
              .value=${this.exportScaleKey}
              @change=${this.handleExportScaleChange}
            >
              <sp-menu-item value="0.5">0.5x</sp-menu-item>
              <sp-menu-item value="1">1x</sp-menu-item>
              <sp-menu-item value="2">2x</sp-menu-item>
              <sp-menu-item value="3">3x</sp-menu-item>
              <sp-menu-item value="4">4x</sp-menu-item>
            </sp-picker>
          </div>
          <div class="export-picker">
            <sp-picker
              size="s"
              label=${msg(str`Format`)}
              .value=${this.exportFormat}
              @change=${this.handleExportFormatChange}
            >
              <sp-menu-item value=${ExportFormat.SVG}>SVG</sp-menu-item>
              <sp-menu-item value=${ExportFormat.PNG}>PNG</sp-menu-item>
              <sp-menu-item value=${ExportFormat.JPEG}>JPEG</sp-menu-item>
            </sp-picker>
          </div>
        </div>
        <sp-action-button
          class="export-cta"
          size="s"
          @click=${this.handleExportClick}
        >
          ${label}
        </sp-action-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-export-panel': ExportPanel;
  }
}
