import { localized, msg, str } from '@lit/localize';
import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  CheckboardStyle,
  AppState,
  readSystemClipboard,
  effectiveThemePreference,
  resolveThemeModeFromPreference,
  type ThemePreference,
  ExportFormat,
  downloadIcDocument,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { openIcDocument } from '../utils';
import { executeCopy, executeCut, executePaste } from './context-menu';

@customElement('ic-spectrum-top-navbar')
@localized()
export class TopNavbar extends LitElement {
  static styles = css`
    .top-navbar {
      position: relative;
      display: flex;
      justify-content: space-between;
      padding: var(--spectrum-global-dimension-size-100);
      background: var(--spectrum-gray-100);
    }

    sp-menu-item {
      width: 200px;
    }

    kbd {
      font-family: var(--spectrum-alias-body-text-font-family);
      letter-spacing: 0.1em;
      white-space: nowrap;
      border: none;
      padding: none;
      padding: 0;
      line-height: normal;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-100);
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @state()
  private isClipboardEmpty = true;

  @query('sp-action-menu', true)
  private actionMenu: LitElement;

  private binded = false;

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this.actionMenu?.addEventListener('sp-opened', this.handleOpen);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Canvas is focused
    if (!this.api || document.activeElement !== this.api.element) {
      return;
    }

    if (e.key === 'z' && e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        this.handleRedo();
      } else {
        this.handleUndo();
      }
    }
  };

  private async handleExport(event: CustomEvent) {
    const format = (event.target as any).value as ExportFormat | 'ic' | 'figma';
    if (format === 'ic') {
      const doc = this.api.exportIcDocument(window.location.origin);
      downloadIcDocument(doc, 'my-scene.ic');
    } else if (format === 'figma') {
      await this.handleExportFigma();
    } else {
      this.api.export({ format });
    }
  }

  /**
   * Export the scene as a Figma scene payload (`.json`). The Figma REST API is
   * read-only, so the JSON is replayed into Figma via the companion
   * "Infinite Canvas Import" plugin (see `@infinite-canvas-tutorial/figma`).
   */
  private async handleExportFigma() {
    try {
      // Dynamic import keeps the figma plugin out of the core bundle and
      // mirrors the mermaid integration (avoids stale build artifacts).
      const { serializedNodesToFigmaScene } = await import(
        '@infinite-canvas-tutorial/figma'
      );
      const doc = this.api.exportIcDocument(window.location.origin);
      const scene = serializedNodesToFigmaScene(doc.elements, doc.source);
      const json = JSON.stringify(scene, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-scene.figma.json';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn(e);
    }
  }

  private async handleImport(event: CustomEvent) {
    const format = (event.target as any).value as 'ic' | 'figma';
    if (format === 'figma') {
      await this.handleImportFigma();
      return;
    }
    if (format !== 'ic') {
      return;
    }
    try {
      const { contents } = await openIcDocument();
      this.api.importIcDocument(contents);
    } catch (e) {
      // The user canceled the file picker or selected an invalid document.
      console.warn(e);
    }
  }

  /**
   * Import from Figma via the read-only REST API. Prompts for the file key
   * (or URL) and a personal access token, fetches the document, and applies it
   * as an `.ic` scene.
   */
  private async handleImportFigma() {
    const fileKey = window.prompt(
      'Figma file key or URL (https://www.figma.com/file/<key>/…)',
    );
    if (!fileKey) {
      return;
    }
    const token = window.prompt('Figma personal access token');
    if (!token) {
      return;
    }
    try {
      const { FigmaRestClient, parseFigmaFileToSerializedNodes } = await import(
        '@infinite-canvas-tutorial/figma'
      );
      const client = new FigmaRestClient({ token });
      const file = await client.getFile(fileKey);
      let imageRefUrls: Record<string, string> = {};
      try {
        imageRefUrls = await client.getImageFills(fileKey);
      } catch {
        // Image fills are optional; continue without them.
      }
      const doc = parseFigmaFileToSerializedNodes(file, {
        imageRefUrls,
        source: 'https://www.figma.com',
      });
      this.api.importIcDocument(doc);
    } catch (e) {
      console.warn(e);
    }
  }

  private handleEdit(event: CustomEvent) {
    const value = (event.target as any).value;
    if (value === 'undo') {
      this.handleUndo();
    } else if (value === 'redo') {
      this.handleRedo();
    } else if (value === 'cut') {
      this.handleCut();
    } else if (value === 'copy') {
      this.handleCopy();
    } else if (value === 'paste') {
      this.handlePaste();
    }
  }

  private handleConfigView(event: CustomEvent) {
    const value = (event.target as any).value;
    if (value === 'grid') {
      this.api.setAppState({
        checkboardStyle: CheckboardStyle.GRID,
      });
    } else {
      this.api.setAppState({
        checkboardStyle: CheckboardStyle.NONE,
      });
    }
  }

  private handleConfigPreferences(event: CustomEvent) {
    const selected = (event.target as any).selected;
    this.api.setAppState({
      snapToPixelGridEnabled: selected.includes('snapToPixelGrid'),
      snapToObjectsEnabled: selected.includes('snapToObjects'),
    });
  }

  private handleConfigTheme(event: CustomEvent) {
    const raw = (event.target as any).selected[0] as string;
    const themePreference: ThemePreference =
      raw === 'light' || raw === 'dark' || raw === 'system'
        ? raw
        : 'system';
    const themeMode = resolveThemeModeFromPreference(themePreference);
    this.api.setAppState({
      themePreference,
      themeMode,
    });
  }

  private handleUndo() {
    this.api.undo();
  }

  private handleRedo() {
    this.api.redo();
  }

  private handleCut() {
    executeCut(this.api, this.appState);
  }

  private handleCopy() {
    executeCopy(this.api, this.appState);
  }

  private handlePaste() {
    executePaste(this.api, this.appState);
  }

  private handleOpen() {
    readSystemClipboard().then((clipboard) => {
      this.isClipboardEmpty = Object.keys(clipboard).length === 0;
    });
  }

  private handleConfigLanguage(event: CustomEvent) {
    const selected = (event.target as any).selected[0];
    this.api.setAppState({
      language: selected,
    });
    this.api.setLocale(selected);
  }

  render() {
    // FIXME: wait for the element to be ready.
    if (this.api?.element && !this.binded) {
      this.api.element.addEventListener('keydown', this.handleKeyDown);
      this.binded = true;
    }

    const isSelectedEmpty = this.appState.layersSelected.length === 0;

    return when(
      this.appState.topbarVisible,
      () =>
        html`
          <div class="top-navbar">
            <sp-action-menu size="m" label="Main menu" quiet>
              <sp-tooltip slot="tooltip" self-managed placement="bottom">
                ${msg(str`Main menu`)}
              </sp-tooltip>
              <sp-icon-show-menu slot="icon" size="l"></sp-icon-show-menu>
              <sp-menu-item>
                ${msg(str`Edit`)}
                <sp-menu slot="submenu" @change=${this.handleEdit}>
                  <sp-menu-item
                    value="undo"
                    ?disabled=${this.api?.isUndoStackEmpty()}
                  >
                    ${msg(str`Undo`)}
                    <kbd slot="value">⌘Z</kbd>
                  </sp-menu-item>
                  <sp-menu-item
                    value="redo"
                    ?disabled=${this.api?.isRedoStackEmpty()}
                  >
                    ${msg(str`Redo`)}
                    <kbd slot="value">⇧⌘Z</kbd>
                  </sp-menu-item>
                  <sp-menu-divider></sp-menu-divider>
                  <sp-menu-item value="cut" ?disabled=${isSelectedEmpty}>
                    ${msg(str`Cut`)}
                    <kbd slot="value">⌘X</kbd>
                  </sp-menu-item>
                  <sp-menu-item value="copy" ?disabled=${isSelectedEmpty}>
                    ${msg(str`Copy`)}
                    <kbd slot="value">⌘C</kbd>
                  </sp-menu-item>
                  <sp-menu-item
                    value="paste"
                    ?disabled=${this.isClipboardEmpty}
                  >
                    ${msg(str`Paste`)}
                    <kbd slot="value">⌘V</kbd>
                  </sp-menu-item>
                </sp-menu>
              </sp-menu-item>
              <sp-menu-item>
                ${msg(str`View`)}
                <sp-menu
                  slot="submenu"
                  selects="multiple"
                  .selected=${this.appState.checkboardStyle ===
            CheckboardStyle.GRID
            ? ['grid']
            : []}
                  @change=${this.handleConfigView}
                >
                  <sp-menu-item value="grid"> ${msg(str`Grid`)} </sp-menu-item>
                </sp-menu>
              </sp-menu-item>
              <sp-menu-item>
                ${msg(str`Preferences`)}
                <sp-menu
                  slot="submenu"
                  selects="multiple"
                  .selected=${[
            this.appState.snapToPixelGridEnabled
              ? 'snapToPixelGrid'
              : undefined,
            this.appState.snapToObjectsEnabled
              ? 'snapToObjects'
              : undefined,
          ].filter(Boolean)}
                  @change=${this.handleConfigPreferences}
                >
                  <sp-menu-item value="snapToPixelGrid">
                    ${msg(str`Snap to pixel grid`)}
                  </sp-menu-item>
                  <sp-menu-item value="snapToObjects">
                    ${msg(str`Snap to objects`)}
                  </sp-menu-item>
                  <sp-menu-divider></sp-menu-divider>
                  <sp-menu-item>
                    ${msg(str`Theme`)}
                    <sp-menu
                      slot="submenu"
                      selects="single"
                      .selected=${[
            effectiveThemePreference(this.appState),
          ]}
                      @change=${this.handleConfigTheme}
                    >
                      <sp-menu-item value="light">
                        ${msg(str`Light`)}
                      </sp-menu-item>
                      <sp-menu-item value="dark">
                        ${msg(str`Dark`)}
                      </sp-menu-item>
                      <sp-menu-item value="system">
                        ${msg(str`System`)}
                      </sp-menu-item>
                    </sp-menu>
                  </sp-menu-item>
                  <sp-menu-item>
                    ${msg(str`Language`)}
                    <sp-menu
                      slot="submenu"
                      selects="single"
                      .selected=${[this.appState.language]}
                      @change=${this.handleConfigLanguage}
                    >
                      <sp-menu-item value="en"> English </sp-menu-item>
                      <sp-menu-item value="es-419"> Español </sp-menu-item>
                      <sp-menu-item value="zh-Hans"> 中文 (简体) </sp-menu-item>
                    </sp-menu>
                  </sp-menu-item>
                </sp-menu>
              </sp-menu-item>
              <sp-menu-divider></sp-menu-divider>
              <sp-menu-item>
                ${msg(str`Export as...`)}
                <sp-menu slot="submenu" @change=${this.handleExport}>
                  <sp-menu-item value=${ExportFormat.SVG}>SVG</sp-menu-item>
                  <sp-menu-item value=${ExportFormat.PNG}>PNG</sp-menu-item>
                  <sp-menu-item value=${ExportFormat.JPEG}>JPEG</sp-menu-item>
                  <sp-menu-item value=${ExportFormat.WEBM}>WebM</sp-menu-item>
                  <sp-menu-item value=${ExportFormat.GIF}>GIF</sp-menu-item>
                  <sp-menu-item value=${'ic'}>.ic</sp-menu-item>
                  <sp-menu-item value=${'figma'}>Figma (.json)</sp-menu-item>
                </sp-menu>
              </sp-menu-item>
              <sp-menu-item>
                ${msg(str`Import from...`)}
                <sp-menu slot="submenu" @change=${this.handleImport}>
                  <sp-menu-item value=${'ic'}>.ic</sp-menu-item>
                  <sp-menu-item value=${'figma'}>Figma</sp-menu-item>
                </sp-menu>
              </sp-menu-item>
            </sp-action-menu>
            <div class="actions">
              <sp-action-button
                quiet
                @click=${this.handleUndo}
                ?disabled=${this.api?.isUndoStackEmpty()}
              >
                <sp-icon-undo slot="icon"></sp-icon-undo>
                <sp-tooltip self-managed placement="bottom">
                  ${msg(str`Undo`)}
                </sp-tooltip>
              </sp-action-button>
              <sp-action-button
                quiet
                @click=${this.handleRedo}
                ?disabled=${this.api?.isRedoStackEmpty()}
              >
                <sp-icon-redo slot="icon"></sp-icon-redo>
                <sp-tooltip self-managed placement="bottom">
                  ${msg(str`Redo`)}
                </sp-tooltip>
              </sp-action-button>
              <ic-spectrum-zoom-toolbar />
            </div>
          </div>
        `,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-top-navbar': TopNavbar;
  }
}
