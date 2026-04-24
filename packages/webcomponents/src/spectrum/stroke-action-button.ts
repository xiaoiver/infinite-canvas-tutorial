import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  designVariableRefKeyFromWire,
  isDesignVariableReference,
  resolveDesignVariableValue,
  SerializedNode,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { ColorType } from './color-picker';
import { normalizeSolidCssValue } from './normalize-solid-css';
import { localized, msg, str } from '@lit/localize';
import { when } from 'lit/directives/when.js';
import { choose } from 'lit/directives/choose.js';
import type { DesignVariablePickDetail } from './design-variable-picker';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-unlink.js';
import './design-variable-picker.js';

@customElement('ic-spectrum-stroke-action-button')
@localized()
export class StrokeActionButton extends LitElement {
  static styles = css`
    ic-spectrum-stroke-icon {
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

    .stroke-tabs {
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

  @state()
  private strokePanelTab: 'color' | 'variable' = 'color';

  private tabSyncNodeId: string | undefined;

  private prevStrokeWireBound: boolean | undefined;

  private strokeWireBound(): boolean {
    if (!this.node) {
      return false;
    }
    return isDesignVariableReference((this.node as TextSerializedNode).stroke);
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
        const bound = this.strokeWireBound();
        this.strokePanelTab = bound ? 'variable' : 'color';
        this.prevStrokeWireBound = bound;
      }
    } else {
      this.tabSyncNodeId = undefined;
      this.prevStrokeWireBound = undefined;
    }
  }

  updated() {
    if (!this.node) {
      return;
    }
    const bound = this.strokeWireBound();
    if (this.prevStrokeWireBound === bound) {
      return;
    }
    this.prevStrokeWireBound = bound;
    this.strokePanelTab = bound ? 'variable' : 'color';
  }

  /** 打开描边浮层时：已绑定变量则优先「变量」Tab */
  private handleStrokeTriggerClick() {
    if (!this.node) {
      return;
    }
    const bound = this.strokeWireBound();
    this.strokePanelTab = bound ? 'variable' : 'color';
    this.prevStrokeWireBound = bound;
  }

  private handleStrokeChanged(e: CustomEvent) {
    const { type, value, strokeOpacity } = e.detail;
    this.api.updateNode(this.node, {
      stroke: type === 'solid' ? normalizeSolidCssValue(value) : value,
      ...(strokeOpacity !== undefined && { strokeOpacity }),
    });
    this.api.record();
  }

  private handleStrokeOpacityChanged(
    e: CustomEvent<{ strokeOpacity?: number }>,
  ) {
    const { strokeOpacity } = e.detail;
    if (strokeOpacity === undefined) return;
    this.api.updateNode(this.node, { strokeOpacity });
    this.api.record();
  }

  private handleVariablePick(e: CustomEvent<DesignVariablePickDetail>) {
    const { key } = e.detail;
    this.strokePanelTab = 'variable';
    this.api.updateNode(this.node, { stroke: `$${key}` });
    this.api.record();
  }

  private handleUnbind() {
    this.strokePanelTab = 'color';
    const stroke = (this.node as TextSerializedNode).stroke;
    const resolved = resolveDesignVariableValue(
      stroke,
      this.appState.variables,
      this.appState.themeMode,
    );
    const next =
      typeof resolved === 'string'
        ? resolved
        : String(resolved ?? stroke ?? 'none');
    this.api.updateNode(this.node, {
      stroke: isDesignVariableReference(next)
        ? next
        : normalizeSolidCssValue(next),
    });
    this.api.record();
  }

  private handleStrokeOpacityVariablePick(
    e: CustomEvent<{ mode: 'fill' | 'stroke'; key: string }>,
  ) {
    if (e.detail.mode !== 'stroke') {
      return;
    }
    this.api.updateNode(this.node, {
      strokeOpacity: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleStrokeOpacityVariableUnbind(
    e: CustomEvent<{ mode: 'fill' | 'stroke' }>,
  ) {
    if (e.detail.mode !== 'stroke') {
      return;
    }
    const raw = (this.node as TextSerializedNode).strokeOpacity;
    const resolved = resolveDesignVariableValue(
      raw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      this.api.updateNode(this.node, {
        strokeOpacity: Math.max(0, Math.min(1, n)),
      });
      this.api.record();
    }
  }

  render() {
    if (!this.node) {
      return html``;
    }

    const { stroke, strokeOpacity = 1 } = this.node as TextSerializedNode;
    const strokeResolved = String(
      resolveDesignVariableValue(
        stroke,
        this.appState.variables,
        this.appState.themeMode,
      ),
    );
    const bound = isDesignVariableReference(stroke);
    const tab = this.strokePanelTab;

    return html`<sp-action-button
        quiet
        size="m"
        id="stroke"
        @click=${this.handleStrokeTriggerClick}
      >
        <ic-spectrum-stroke-icon
          value=${stroke}
          slot="icon"
        ></ic-spectrum-stroke-icon>
        <sp-tooltip self-managed placement="bottom"> Stroke </sp-tooltip>
      </sp-action-button>
      <sp-overlay trigger="stroke@click" placement="bottom" type="auto">
        <sp-popover dialog>
          <div class="stroke-tabs">
            <div class="tab-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected=${tab === 'color' ? 'true' : 'false'}
                @click=${() => {
                  this.strokePanelTab = 'color';
                }}
              >
                ${msg(str`颜色`)}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected=${tab === 'variable' ? 'true' : 'false'}
                @click=${() => {
                  this.strokePanelTab = 'variable';
                }}
              >
                ${msg(str`变量`)}
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
                        value=${strokeResolved}
                        .strokeOpacity=${strokeOpacity}
                        .types=${[ColorType.None, ColorType.Solid]}
                        enable-opacity-variable-binding
                        @color-change=${this.handleStrokeChanged}
                        @opacity-change=${this.handleStrokeOpacityChanged}
                        @opacity-variable-pick=${this
                          .handleStrokeOpacityVariablePick}
                        @opacity-variable-unbind=${this
                          .handleStrokeOpacityVariableUnbind}
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
                              <span class="dv-badge" title=${stroke}
                                >${stroke}</span
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
                              </sp-action-button>
                            </div>`,
                        )}
                        <ic-spectrum-design-variable-picker
                          match-type="color"
                          selected-key=${designVariableRefKeyFromWire(stroke)}
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
    'ic-spectrum-stroke-action-button': StrokeActionButton;
  }
}
