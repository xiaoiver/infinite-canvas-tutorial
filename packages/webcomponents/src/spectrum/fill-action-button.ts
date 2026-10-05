import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  designVariableRefKeyFromWire,
  isDesignVariableReference,
  resolveDesignVariableValue,
  SerializedFillLayerItem,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import type { ColorPickerChangeDetail } from './color-picker.js';
import { localized, msg, str } from '@lit/localize';
import { when } from 'lit/directives/when.js';
import { choose } from 'lit/directives/choose.js';
import { editPaint, primaryPaint } from './paint-command';
import type { DesignVariablePickDetail } from './design-variable-picker';
import '@spectrum-web-components/action-button/sp-action-button.js';
import './design-variable-picker.js';

function serializedFillPrimaryWire(L: SerializedFillLayerItem): string {
  return L.value;
}

@customElement('ic-spectrum-fill-action-button')
@localized()
export class FillActionButton extends LitElement {
  static styles = css`
    ic-spectrum-fill-icon {
      width: 30px;
      height: 30px;
    }

    sp-popover {
      padding: 0;
    }

    .variable-tab {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      padding: 8px;
    }

    .dv-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .dv-badge {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-purple-900);
      background: var(--spectrum-purple-100);
      border-radius: 4px;
      padding: 2px 6px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .fill-tabs {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .tab-bar {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--spectrum-gray-300);
      padding: 0 8px;
      flex-shrink: 0;
    }

    .tab-bar button {
      appearance: none;
      font: inherit;
      font-size: var(--spectrum-font-size-75);
      line-height: var(--spectrum-line-height-small);
      padding: 8px 12px;
      margin: 0;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--spectrum-gray-700);
      cursor: pointer;
      border-radius: 0;
    }

    .tab-bar button:hover {
      color: var(--spectrum-gray-900);
    }

    .tab-bar button[aria-selected='true'] {
      color: var(--spectrum-gray-900);
      border-bottom-color: var(--spectrum-gray-800);
      font-weight: var(--spectrum-bold-font-weight);
    }

    .tab-panel {
      min-width: 0;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  /** Paint shown before a stroke-only node receives its first fill. */
  @property({ attribute: false })
  defaultFill: SerializedFillLayerItem = {
    type: 'solid', value: '#000000', opacity: 1,
  };

  @state()
  private fillPanelTab: 'color' | 'variable' = 'color';

  private tabSyncNodeId: string | undefined;

  private prevFillWireBound: boolean | undefined;

  private textFillLayer(): SerializedFillLayerItem {
    return primaryPaint(this.node, 'fills', this.defaultFill);
  }

  private fillWireBound(): boolean {
    if (!this.node) {
      return false;
    }
    const v = this.textFillLayer().value;
    return v != null && isDesignVariableReference(v);
  }

  willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    if (!changed.has('node')) {
      return;
    }
    if (this.node) {
      const id = this.node.id;
      if (id !== this.tabSyncNodeId) {
        this.tabSyncNodeId = id;
        const bound = this.fillWireBound();
        this.fillPanelTab = bound ? 'variable' : 'color';
        this.prevFillWireBound = bound;
      }
    } else {
      this.tabSyncNodeId = undefined;
      this.prevFillWireBound = undefined;
    }
  }

  updated() {
    if (!this.node) {
      return;
    }
    const bound = this.fillWireBound();
    if (this.prevFillWireBound === bound) {
      return;
    }
    this.prevFillWireBound = bound;
    this.fillPanelTab = bound ? 'variable' : 'color';
  }

  /** 打开填充浮层时：已绑定变量则优先「变量」Tab */
  private handleFillTriggerClick() {
    if (!this.node) {
      return;
    }
    const bound = this.fillWireBound();
    this.fillPanelTab = bound ? 'variable' : 'color';
    this.prevFillWireBound = bound;
  }

  private submitPaint(command: Parameters<typeof editPaint>[3]) {
    const api = this.api;
    const id = this.node?.id;
    void editPaint(api, id, 'fills', command, this.defaultFill).then(() => {
      if (this.isConnected && this.api === api && this.node?.id === id)
        this.requestUpdate();
    });
  }

  private handleFillChanged(e: CustomEvent<ColorPickerChangeDetail>) {
    this.submitPaint({ ...e.detail, kind: 'color' });
  }

  private handleFillOpacityChanged(e: CustomEvent<{ fillOpacity?: number }>) {
    const value = e.detail.fillOpacity;
    if (value !== undefined) this.submitPaint({ kind: 'opacity', value });
  }

  private handleVariablePick(e: CustomEvent<DesignVariablePickDetail>) {
    this.fillPanelTab = 'variable';
    this.submitPaint({ kind: 'bind', field: 'value', key: e.detail.key });
  }

  private handleUnbind() {
    this.fillPanelTab = 'color';
    this.submitPaint({ kind: 'unbind', field: 'value' });
  }

  private handleFillOpacityVariablePick(
    e: CustomEvent<{ mode: 'fill' | 'stroke'; key: string }>,
  ) {
    if (e.detail.mode === 'fill')
      this.submitPaint({ kind: 'bind', field: 'opacity', key: e.detail.key });
  }

  private handleFillOpacityVariableUnbind(
    e: CustomEvent<{ mode: 'fill' | 'stroke' }>,
  ) {
    if (e.detail.mode === 'fill')
      this.submitPaint({ kind: 'unbind', field: 'opacity' });
  }

  render() {
    if (!this.node) {
      return html``;
    }

    const L = this.textFillLayer();
    const fill = serializedFillPrimaryWire(L);
    const fillOpacity = L.opacity ?? 1;
    const fillResolved = String(
      resolveDesignVariableValue(
        fill,
        this.appState.variables,
        this.appState.themeMode,
      ),
    );
    const bound = isDesignVariableReference(fill);
    const tab = this.fillPanelTab;

    return html`<sp-action-button
        quiet
        size="m"
        id="fill"
        label=${msg(str`Fill color`)}
        @click=${this.handleFillTriggerClick}
      >
        <ic-spectrum-fill-icon
          value=${fill}
          .node=${this.node}
          slot="icon"
        ></ic-spectrum-fill-icon>
        <sp-tooltip self-managed placement="bottom">${msg(str`Fill color`)}</sp-tooltip>
      </sp-action-button>
      <sp-overlay trigger="fill@click" placement="bottom" type="auto">
        <sp-popover dialog>
          <div class="fill-tabs">
            <div class="tab-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected=${tab === 'color' ? 'true' : 'false'}
                @click=${() => {
        this.fillPanelTab = 'color';
      }}
              >
                ${msg(str`Color`)}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected=${tab === 'variable' ? 'true' : 'false'}
                @click=${() => {
        this.fillPanelTab = 'variable';
      }}
              >
                ${msg(str`Variable`)}
              </button>
            </div>
            <div class="tab-panel" role="tabpanel">
              ${choose(
        tab,
        [
          [
            'color',
            () =>
              html`<ic-spectrum-color-picker
                        value=${fillResolved}
                        .fillOpacity=${fillOpacity}
                        .objectFit=${L.type === 'image'
                  ? (L.objectFit ?? 'fill')
                  : 'fill'}
                        .objectPosition=${L.type === 'image'
                  ? (L.objectPosition ?? '')
                  : ''}
                        enable-opacity-variable-binding
                        @color-change=${this.handleFillChanged}
                        @opacity-change=${this.handleFillOpacityChanged}
                        @opacity-variable-pick=${this.handleFillOpacityVariablePick}
                        @opacity-variable-unbind=${this
                  .handleFillOpacityVariableUnbind}
                      ></ic-spectrum-color-picker>`,
          ],
          [
            'variable',
            () =>
              html`<div class="variable-tab">
                        ${when(
                bound,
                () =>
                  html`<div class="dv-row">
                              <span class="dv-badge" title=${fill}
                                >${fill}</span
                              >
                              <sp-action-button
                                quiet
                                size="s"
                                @click=${this.handleUnbind}
                                >
                                <sp-icon-unlink slot="icon"></sp-icon-unlink>
                                <sp-tooltip self-managed placement="right">
                                  ${msg(str`Detach variable`)}
                                </sp-tooltip>
                              </sp-action-button
                              >
                            </div>`,
              )}
                        <ic-spectrum-design-variable-picker
                          match-type="color"
                          selected-key=${designVariableRefKeyFromWire(fill)}
                          @ic-variable-pick=${this.handleVariablePick}
                        ></ic-spectrum-design-variable-picker>
                      </div>`,
          ],
        ],
        () => html``,
      )}
            </div>
          </div>
        </sp-popover>
      </sp-overlay>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-fill-action-button': FillActionButton;
  }
}
