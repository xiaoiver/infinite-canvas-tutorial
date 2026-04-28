import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { ExportFormat, SerializedNode, AppState } from '@infinite-canvas-tutorial/ecs';

/** 与 `ExportOptions.gifQuality` / `AnimationGifQuality` 一致 */
type GifExportQuality = 'high' | 'medium' | 'low';
import { apiContext, appStateContext } from '../context';
import { type ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/number-field/sp-number-field.js';
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

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .line sp-number-field {
      width: 70px;
    }

    .line sp-picker {
      width: 70px;
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

  @state()
  private exportDuration = '1';

  @state()
  private exportFps = '24';

  @state()
  private exportGifQuality: GifExportQuality = 'medium';

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
    if (
      this.exportFormat === ExportFormat.WEBM ||
      this.exportFormat === ExportFormat.GIF
    ) {
      const durationSec = Math.max(
        0.2,
        Math.min(15, parseFloat(this.exportDuration) || 3),
      );
      const fps = Math.max(1, Math.min(30, parseFloat(this.exportFps) || 24));
      this.api.export({
        format: this.exportFormat,
        nodes,
        scale,
        durationSec,
        fps,
        ...(this.exportFormat === ExportFormat.GIF
          ? { gifQuality: this.exportGifQuality }
          : {}),
      });
    } else {
      this.api.export({ format: this.exportFormat, nodes, scale });
    }
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

  private handleExportDurationChange = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    if (v != null) {
      this.exportDuration = v;
    }
  };

  private handleExportFpsChange = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    if (v != null) {
      this.exportFps = v;
    }
  };

  private handleExportGifQualityChange = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    if (v === 'high' || v === 'medium' || v === 'low') {
      this.exportGifQuality = v;
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
              <sp-menu-item value=${ExportFormat.WEBM}>WebM</sp-menu-item>
              <sp-menu-item value=${ExportFormat.GIF}>GIF</sp-menu-item>
            </sp-picker>
          </div>
        </div>
        ${this.exportFormat === ExportFormat.WEBM ||
        this.exportFormat === ExportFormat.GIF
        ? html`
              <div class="line">
                <sp-field-label
                  for="export-duration"
                  side-aligned="start"
                  >${msg(str`Duration (s)`)}</sp-field-label
                >
                <sp-number-field
                  id="export-duration"
                  size="s"
                  label=${msg(str`Duration (s)`)}
                  min="0.2"
                  max="15"
                  step="0.1"
                  .value=${parseFloat(this.exportDuration) || 1}
                  @change=${this.handleExportDurationChange}
                ></sp-number-field>
              </div>
              <div class="line">
                <sp-field-label
                  for="export-fps"
                  side-aligned="start"
                  >${msg(str`FPS`)}</sp-field-label
                >
                <sp-number-field
                  id="export-fps"
                  size="s"
                  label=${msg(str`FPS`)}
                  min="1"
                  max="30"
                  step="1"
                  .value=${parseFloat(this.exportFps) || 24}
                  @change=${this.handleExportFpsChange}
                ></sp-number-field>
              </div>
              ${this.exportFormat === ExportFormat.GIF
            ? html`
                <div class="line">
                  <sp-field-label
                    for="export-gif-quality"
                    side-aligned="start"
                    >${msg(str`Quality`)}</sp-field-label
                  >
                  <sp-picker
                    size="s"
                    id="export-gif-quality"
                    .value=${this.exportGifQuality}
                    @change=${this.handleExportGifQualityChange}
                  >
                    <sp-menu-item value="high"
                      >${msg(str`High`)}</sp-menu-item
                    >
                    <sp-menu-item value="medium"
                      >${msg(str`Medium`)}</sp-menu-item
                    >
                    <sp-menu-item value="low"
                      >${msg(str`Low`)}</sp-menu-item
                    >
                  </sp-picker>
                </div>
              `
            : null}
            `
        : null}
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
