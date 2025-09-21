import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  CheckboardStyle,
  AppState,
  readSystemClipboard,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { executeCopy, executeCut, executePaste } from './context-menu';

export enum ExportFormat {
  SVG = 'svg',
  PNG = 'png',
  JPEG = 'jpeg',
}

@customElement('ic-spectrum-top-navbar')
export class TopNavbar extends LitElement {
  static styles = css`
    .top-navbar {
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

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this.actionMenu?.addEventListener('sp-opened', this.handleOpen);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
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

  private handleExport(event: CustomEvent) {
    const format = (event.target as any).value as ExportFormat;

    this.api.export(format);
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
    const selected = (event.target as any).selected[0];
    let isDark = false;
    if (selected === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = selected === 'dark';
    }

    this.dispatchEvent(
      new CustomEvent('theme-change', {
        detail: {
          isDark,
        },
        bubbles: true,
        composed: true,
      }),
    );

    this.api.setAppState({
      themeMode: selected,
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

  render() {
    const isSelectedEmpty = this.appState.layersSelected.length === 0;

    return when(
      this.appState.topbarVisible,
      () =>
        html`
          <div class="top-navbar">
            <sp-action-menu size="m" label="Main menu" quiet>
              <sp-tooltip slot="tooltip" self-managed placement="bottom">
                Main menu
              </sp-tooltip>
              <sp-icon-show-menu slot="icon" size="l"></sp-icon-show-menu>
              <sp-menu-item>
                Edit
                <sp-menu slot="submenu" @change=${this.handleEdit}>
                  <sp-menu-item
                    value="undo"
                    ?disabled=${this.api?.isUndoStackEmpty()}
                  >
                    Undo
                    <kbd slot="value">⌘Z</kbd>
                  </sp-menu-item>
                  <sp-menu-item
                    value="redo"
                    ?disabled=${this.api?.isRedoStackEmpty()}
                  >
                    Redo
                    <kbd slot="value">⇧⌘Z</kbd>
                  </sp-menu-item>
                  <sp-menu-divider></sp-menu-divider>
                  <sp-menu-item value="cut" ?disabled=${isSelectedEmpty}>
                    Cut
                    <kbd slot="value">⌘X</kbd>
                  </sp-menu-item>
                  <sp-menu-item value="copy" ?disabled=${isSelectedEmpty}>
                    Copy
                    <kbd slot="value">⌘C</kbd>
                  </sp-menu-item>
                  <sp-menu-item
                    value="paste"
                    ?disabled=${this.isClipboardEmpty}
                  >
                    Paste
                    <kbd slot="value">⌘V</kbd>
                  </sp-menu-item>
                </sp-menu>
              </sp-menu-item>
              <sp-menu-item>
                View
                <sp-menu
                  slot="submenu"
                  selects="multiple"
                  .selected=${this.appState.checkboardStyle ===
                  CheckboardStyle.GRID
                    ? ['grid']
                    : []}
                  @change=${this.handleConfigView}
                >
                  <sp-menu-item value="grid"> Grid </sp-menu-item>
                </sp-menu>
              </sp-menu-item>
              <sp-menu-item>
                Preferences
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
                    Snap to pixel grid
                  </sp-menu-item>
                  <sp-menu-item value="snapToObjects">
                    Snap to objects
                  </sp-menu-item>
                  <sp-menu-divider></sp-menu-divider>
                  <sp-menu-item>
                    Theme
                    <sp-menu
                      slot="submenu"
                      selects="single"
                      .selected=${[this.appState.themeMode]}
                      @change=${this.handleConfigTheme}
                    >
                      <sp-menu-item value="light"> Light </sp-menu-item>
                      <sp-menu-item value="dark"> Dark </sp-menu-item>
                      <sp-menu-item value="system"> System </sp-menu-item>
                    </sp-menu>
                  </sp-menu-item>
                </sp-menu>
              </sp-menu-item>
              <sp-menu-divider></sp-menu-divider>
              <sp-menu-item>
                Export as...
                <sp-menu slot="submenu" @change=${this.handleExport}>
                  <sp-menu-item value=${ExportFormat.SVG}>SVG</sp-menu-item>
                  <sp-menu-item value=${ExportFormat.PNG}>PNG</sp-menu-item>
                  <sp-menu-item value=${ExportFormat.JPEG}>JPEG</sp-menu-item>
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
                <sp-tooltip self-managed placement="bottom"> Undo </sp-tooltip>
              </sp-action-button>
              <sp-action-button
                quiet
                @click=${this.handleRedo}
                ?disabled=${this.api?.isRedoStackEmpty()}
              >
                <sp-icon-redo slot="icon"></sp-icon-redo>
                <sp-tooltip self-managed placement="bottom"> Redo </sp-tooltip>
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
