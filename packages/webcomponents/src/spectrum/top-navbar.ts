import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  DataURLType,
  VectorScreenshotRequest,
  RasterScreenshotRequest,
  CheckboardStyle,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, AppState, appStateContext } from '../context';
import { Event } from '../event';
import { API } from '../API';
@customElement('ic-spectrum-top-navbar')
export class TopNavbar extends LitElement {
  static styles = css`
    :host {
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
  api: API;

  connectedCallback() {
    super.connectedCallback();

    // TODO: bind keyboard shortcuts
  }

  private handleExport(event: CustomEvent) {
    const format = (event.target as any).value;

    let detail: RasterScreenshotRequest | VectorScreenshotRequest;
    if (format === 'png' || format === 'jpeg') {
      detail = new RasterScreenshotRequest();
      (detail as RasterScreenshotRequest).type =
        `image/${format}` as DataURLType;
    } else {
      detail = new VectorScreenshotRequest();
    }

    this.dispatchEvent(
      new CustomEvent(Event.SCREENSHOT_REQUESTED, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleEdit(event: CustomEvent) {
    const value = (event.target as any).value;
    if (value === 'undo') {
      this.handleUndo();
    } else if (value === 'redo') {
      this.handleRedo();
    }
  }

  private handleConfigView(event: CustomEvent) {
    const value = (event.target as any).value;
    if (value === 'grid') {
      this.api.setCheckboardStyle(CheckboardStyle.GRID);
    } else {
      this.api.setCheckboardStyle(CheckboardStyle.NONE);
    }
  }

  private handleUndo() {
    this.api.undo();
  }

  private handleRedo() {
    this.api.redo();
  }

  render() {
    return html`
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
            <sp-menu-item value="cut">
              Cut
              <kbd slot="value">⌘X</kbd>
            </sp-menu-item>
            <sp-menu-item value="copy">
              Copy
              <kbd slot="value">⌘C</kbd>
            </sp-menu-item>
            <sp-menu-item value="paste">
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
            .selected=${this.appState.checkboardStyle === CheckboardStyle.GRID
              ? ['grid']
              : []}
            @change=${this.handleConfigView}
          >
            <sp-menu-item value="grid"> Grid </sp-menu-item>
          </sp-menu>
        </sp-menu-item>
        <sp-menu-divider></sp-menu-divider>
        <sp-menu-item>
          Export as...
          <sp-menu slot="submenu" @change=${this.handleExport}>
            <sp-menu-item value="svg">SVG</sp-menu-item>
            <sp-menu-item value="png">PNG</sp-menu-item>
            <sp-menu-item value="jpeg">JPEG</sp-menu-item>
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-top-navbar': TopNavbar;
  }
}
