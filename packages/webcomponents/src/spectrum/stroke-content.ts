import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  designVariableRefKeyFromWire,
  isDesignVariableReference,
  Marker,
  PolylineSerializedNode,
  resolveDesignVariableValue,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import { when } from 'lit/directives/when.js';
import type { DesignVariablePickDetail } from './design-variable-picker';
import './design-variable-picker.js';
@customElement('ic-spectrum-stroke-content')
@localized()
export class StrokeContent extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      sp-field-label {
        width: 100px;
      }

      sp-number-field {
        width: 70px;
      }

      > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }

    .dv-badge {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-purple-900);
      background: var(--spectrum-purple-100);
      border-radius: 4px;
      padding: 2px 6px;
    }

    .stroke-width-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      min-width: 0;
    }

    sp-popover {
      padding: 0;
    }

    .dv-popover-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      box-sizing: border-box;
    }

    .dv-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    const strokeWidth = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      strokeWidth,
    });
    this.api.record();
  }

  private handleStrokeOpacityChanged(e: Event & { target: HTMLInputElement }) {
    const strokeOpacity = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      strokeOpacity,
    });
    this.api.record();
  }

  private handleStrokeAlignmentChanged(e: Event) {
    const strokeAlignment = (e.target as any).selected[0];
    this.api.updateNode(this.node, {
      strokeAlignment,
    });
    this.api.record();
  }

  private handleStrokeLinecapChanged(e: Event & { target: HTMLInputElement }) {
    const strokeLinecap = (e.target as any).selected[0] as CanvasLineCap;
    this.api.updateNode(this.node, { strokeLinecap });
    this.api.record();
  }

  private handleStrokeLinejoinChanged(e: Event & { target: HTMLInputElement }) {
    const strokeLinejoin = (e.target as any).selected[0] as CanvasLineJoin;
    this.api.updateNode(this.node, { strokeLinejoin });
    this.api.record();
  }

  private handleMarkerStartChanged(e: Event & { target: HTMLInputElement }) {
    const markerStart = e.target.value as Marker['start'];
    this.api.updateNode(this.node, { markerStart });
    this.api.record();
  }

  private handleMarkerEndChanged(e: Event & { target: HTMLInputElement }) {
    const markerEnd = e.target.value as Marker['end'];
    this.api.updateNode(this.node, { markerEnd });
    this.api.record();
  }

  private handleStrokeWidthVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    this.api.updateNode(this.node, {
      strokeWidth: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleStrokeWidthUnbind() {
    const sw = (this.node as PolylineSerializedNode).strokeWidth;
    const resolved = resolveDesignVariableValue(sw, this.appState.variables);
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      this.api.updateNode(this.node, { strokeWidth: n });
      this.api.record();
    }
  }

  private handleStrokeOpacityVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    this.api.updateNode(this.node, {
      strokeOpacity: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleStrokeOpacityUnbind() {
    const raw = (this.node as PolylineSerializedNode).strokeOpacity;
    const resolved = resolveDesignVariableValue(
      raw,
      this.appState.variables,
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

    const {
      strokeWidth,
      strokeOpacity,
      strokeAlignment = 'center',
      strokeLinecap = 'butt',
      strokeLinejoin = 'miter',
      markerStart = 'none',
      markerEnd = 'none',
    } = this.node as PolylineSerializedNode;

    const strokeWidthResolved = resolveDesignVariableValue(
      strokeWidth,
      this.appState.variables,
    );
    const strokeWidthShow = (() => {
      if (typeof strokeWidthResolved === 'number') {
        return strokeWidthResolved;
      }
      const n = parseFloat(String(strokeWidthResolved ?? ''));
      return Number.isFinite(n) ? n : 0;
    })();
    const strokeWidthBound =
      typeof strokeWidth === 'string' &&
      isDesignVariableReference(strokeWidth);

    const strokeOpacityResolved = resolveDesignVariableValue(
      strokeOpacity,
      this.appState.variables,
    );
    const strokeOpacityShow = (() => {
      if (typeof strokeOpacityResolved === 'number') {
        return strokeOpacityResolved;
      }
      const n = parseFloat(String(strokeOpacityResolved ?? ''));
      return Number.isFinite(n) ? n : 1;
    })();
    const strokeOpacityBound =
      typeof strokeOpacity === 'string' &&
      isDesignVariableReference(strokeOpacity);

    return html`<div class="line">
        <sp-field-label for="stroke-width" side-aligned="start"
          >${msg(str`Stroke width`)}</sp-field-label
        >
        <div class="stroke-width-controls">
          <sp-action-button
            quiet
            size="s"
            id="stroke-width-dv-trigger"
          >
            <sp-icon-link slot="icon"></sp-icon-link>
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Attach a variable`)}
            </sp-tooltip>
          </sp-action-button>
          <sp-number-field
            id="stroke-width"
            size="s"
            value=${strokeWidthShow}
            min="0"
            max="20"
            step="1"
            autocomplete="off"
            @change=${this.handleStrokeWidthChanged}
            format-options='{
              "style": "unit",
              "unit": "px"
            }'
          ></sp-number-field>
          <sp-overlay
            trigger="stroke-width-dv-trigger@click"
            placement="bottom"
            type="auto"
          >
            <sp-popover dialog>
              <div class="dv-popover-body">
                ${when(
      strokeWidthBound,
      () =>
        html`<div class="dv-row">
                      <span class="dv-badge" title=${String(strokeWidth)}
                        >${String(strokeWidth)}</span
                      >
                      <sp-action-button
                        quiet
                        size="s"
                        @click=${this.handleStrokeWidthUnbind}
                      >
                        <sp-icon-unlink slot="icon"></sp-icon-unlink>
                        <sp-tooltip self-managed placement="right">
                          ${msg(str`Detach variable`)}
                        </sp-tooltip>
                      </sp-action-button>
                    </div>`,
    )}
                <ic-spectrum-design-variable-picker
                  match-type="number"
                  selected-key=${designVariableRefKeyFromWire(strokeWidth)}
                  @ic-variable-pick=${this.handleStrokeWidthVariablePick}
                ></ic-spectrum-design-variable-picker>
              </div>
            </sp-popover>
          </sp-overlay>
        </div>
      </div>

      <div class="line">
        <sp-field-label for="stroke-opacity" side-aligned="start"
          >${msg(str`Stroke opacity`)}</sp-field-label
        >
        <div class="stroke-width-controls">
          <sp-action-button
            quiet
            size="s"
            id="stroke-opacity-dv-trigger"
          >
            <sp-icon-link slot="icon"></sp-icon-link>
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Attach a variable`)}
            </sp-tooltip>
          </sp-action-button>
          <sp-number-field
            id="stroke-opacity"
            size="s"
            value=${strokeOpacityShow}
            min="0"
            max="1"
            step="0.01"
            hide-stepper
            autocomplete="off"
            @change=${this.handleStrokeOpacityChanged}
          ></sp-number-field>
          <sp-overlay
            trigger="stroke-opacity-dv-trigger@click"
            placement="bottom"
            type="auto"
          >
            <sp-popover dialog>
              <div class="dv-popover-body">
                ${when(
      strokeOpacityBound,
      () =>
        html`<div class="dv-row">
                      <span class="dv-badge" title=${String(strokeOpacity)}
                        >${String(strokeOpacity)}</span
                      >
                      <sp-action-button
                        quiet
                        size="s"
                        @click=${this.handleStrokeOpacityUnbind}
                      >
                        <sp-icon-unlink slot="icon"></sp-icon-unlink>
                        <sp-tooltip self-managed placement="right">
                          ${msg(str`Detach variable`)}
                        </sp-tooltip>
                      </sp-action-button>
                    </div>`,
    )}
                <ic-spectrum-design-variable-picker
                  match-type="number"
                  selected-key=${designVariableRefKeyFromWire(strokeOpacity)}
                  @ic-variable-pick=${this.handleStrokeOpacityVariablePick}
                ></ic-spectrum-design-variable-picker>
              </div>
            </sp-popover>
          </sp-overlay>
        </div>
      </div>

      <div class="line">
        <sp-field-label for="stroke-alignment" side-aligned="start"
          >Stroke alignment</sp-field-label
        >
        <sp-action-group
          id="stroke-alignment"
          size="s"
          compact
          selects="single"
          .selected=${[strokeAlignment]}
          @change=${this.handleStrokeAlignmentChanged}
        >
          <sp-action-button value="inner">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Inner`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M17.25,8.5h-5c-.41406,0-.75-.33594-.75-.75V2.75c0-.41406.33594-.75.75-.75s.75.33594.75.75v4.25h4.25c.41406,0,.75.33594.75.75s-.33594.75-.75.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M17.25,15.25H5.97534c-.21826-.55859-.66406-.99805-1.22534-1.21094V2.75c0-.41406-.33594-.75-.75-.75s-.75.33594-.75.75v11.28906c-.80212.30396-1.375,1.07349-1.375,1.98193,0,1.17383.95142,2.125,2.125,2.125.91626,0,1.69019-.58301,1.98853-1.396h11.26147c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75Z"
                ></path>
                <path
                  d="M17.25,8.5h-5c-.41406,0-.75-.33594-.75-.75V2.75c0-.41406.33594-.75.75-.75H4c.41406,0,.75.33594.75.75v12.5h12.5c.41406,0,.75.33594.75.75V7.75c0,.41406-.33594.75-.75.75Z"
                  opacity=".2"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
          <sp-action-button value="center">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Center`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M17.25,8.5h-5c-.41406,0-.75-.33594-.75-.75V2.75c0-.41406.33594-.75.75-.75H3.75c.41406,0,.75.33594.75.75v12c0,.41309.33691.75.75.75h12c.41406,0,.75.33594.75.75V7.75c0,.41406-.33594.75-.75.75Z"
                  opacity=".2"
                ></path>
                <path
                  d="M17.25,17H5.25c-1.24023,0-2.25-1.00977-2.25-2.25V2.75c0-.41406.33594-.75.75-.75s.75.33594.75.75v12c0,.41309.33691.75.75.75h12c.41406,0,.75.33594.75.75s-.33594.75-.75.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M17.25,8.5h-5c-.41406,0-.75-.33594-.75-.75V2.75c0-.41406.33594-.75.75-.75s.75.33594.75.75v4.25h4.25c.41406,0,.75.33594.75.75s-.33594.75-.75.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M17.25,11.25h-7.26843c-.21545-.56738-.66418-1.01611-1.23157-1.23145V2.75c0-.41406-.33594-.75-.75-.75s-.75.33594-.75.75v7.26855c-.80139.30444-1.375,1.07446-1.375,1.98145,0,1.17188.95312,2.125,2.125,2.125.90698,0,1.677-.57373,1.98145-1.375h7.26855c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75Z"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
          <sp-action-button value="outer">
            <sp-tooltip self-managed placement="bottom"> Outer </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M17.25,17H5.25c-1.24023,0-2.25-1.00977-2.25-2.25V2.75c0-.41406.33594-.75.75-.75s.75.33594.75.75v12c0,.41309.33691.75.75.75h12c.41406,0,.75.33594.75.75s-.33594.75-.75.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M12,8V2H3.75c.41406,0,.75.33594.75.75v12c0,.41309.33691.75.75.75h12c.41406,0,.75.33594.75.75v-8.25h-6Z"
                  opacity=".2"
                ></path>
                <path
                  d="M17.25,7.25h-3.27466c-.21826-.55859-.66406-.99805-1.22534-1.21094v-3.28906c0-.41406-.33594-.75-.75-.75s-.75.33594-.75.75v3.28906c-.80212.30396-1.375,1.07349-1.375,1.98193,0,1.17383.95142,2.125,2.125,2.125.91626,0,1.69019-.58301,1.98853-1.396h3.26147c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75Z"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
        </sp-action-group>
      </div>

      <div class="line">
        <sp-field-label for="stroke-linecap" side-aligned="start"
          >${msg(str`Stroke linecap`)}</sp-field-label
        >
        <sp-action-group
          id="stroke-linecap"
          size="s"
          compact
          selects="single"
          .selected=${[strokeLinecap]}
          @change=${this.handleStrokeLinecapChanged}
        >
          <sp-action-button value="butt">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Butt`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M18,16h-10c-.41406,0-.75-.33594-.75-.75V4.75c0-.41406.33594-.75.75-.75h10c.41406,0,.75.33594.75.75s-.33594.75-.75.75h-9.25v9h9.25c.41406,0,.75.33594.75.75s-.33594.75-.75.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M18,5.5h-9.25v9h9.25c.41406,0,.75.33594.75.75V4.75c0,.41406-.33594.75-.75.75Z"
                  opacity=".2"
                ></path>
                <path
                  d="M18,9.25h-8.15479c-.302-.72168-1.01416-1.229-1.84521-1.229-1.10449,0-2,.89551-2,2,0,1.10474.89551,2,2,2,.84668,0,1.56641-.52783,1.85815-1.271h8.14185c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75Z"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
          <sp-action-button value="round">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Round`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M18,16.02148h-10c-3.30859,0-6-2.69141-6-6s2.69141-6,6-6h10c.41406,0,.75.33594.75.75s-.33594.75-.75.75h-10c-2.48145,0-4.5,2.01855-4.5,4.5s2.01855,4.5,4.5,4.5h10c.41406,0,.75.33594.75.75s-.33594.75-.75.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M18,5.52148h-10c-2.48145,0-4.5,2.01855-4.5,4.5s2.01855,4.5,4.5,4.5h10c.41394,0,.74976.33569.75.74951h0V4.77148c0,.41406-.33594.75-.75.75Z"
                  opacity=".2"
                ></path>
                <path
                  d="M18,9.25h-8.02466c-.3092-.79126-1.07446-1.354-1.97534-1.354-1.17358,0-2.125.95166-2.125,2.125,0,1.17383.95142,2.125,2.125,2.125.91626,0,1.69019-.58301,1.98853-1.396h8.01147c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75Z"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
          <sp-action-button value="square">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Square`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M18,16H2.75c-.41406,0-.75-.33594-.75-.75V4.75c0-.41406.33594-.75.75-.75h15.25c.41406,0,.75.33594.75.75s-.33594.75-.75.75H3.5v9h14.5c.41406,0,.75.33594.75.75s-.33594.75-.75.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M18,5.5H3.5v9h14.5c.41406,0,.75.33594.75.75V4.75c0,.41406-.33594.75-.75.75Z"
                  opacity=".2"
                ></path>
                <path
                  d="M18,9.25h-8.02466c-.3092-.79126-1.07446-1.354-1.97534-1.354-1.17358,0-2.125.95166-2.125,2.125,0,1.17383.95142,2.125,2.125,2.125.91626,0,1.69019-.58301,1.98853-1.396h8.01147c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75Z"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
        </sp-action-group>
      </div>

      <div class="line">
        <sp-field-label for="stroke-linejoin" side-aligned="start"
          >${msg(str`Stroke linejoin`)}</sp-field-label
        >
        <sp-action-group
          id="stroke-linejoin"
          size="s"
          compact
          selects="single"
          .selected=${[strokeLinejoin]}
          @change=${this.handleStrokeLinejoinChanged}
        >
          <sp-action-button value="miter">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Miter`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M3,2c-.41406,0-.75.33594-.75.75v14.25c0,.41406.33594.75.75.75h14.25c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75H3.75V2.75c0-.41406-.33594-.75-.75-.75Z"
                ></path>
                <path
                  d="M12.25,2c-.41406,0-.75.33594-.75.75v5c0,.41406.33594.75.75.75h5c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75h-4.25V2.75c0-.41406-.33594-.75-.75-.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M4.5,17c-.82837,0-1.5-.67163-1.5-1.5V2h9v.05054c-.28979.10376-.5.37402-.5.69946v5c0,.41406.33594.75.75.75h5c.32544,0,.5957-.21021.69946-.5h.05054v9H4.5Z"
                  opacity=".2"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
          <sp-action-button value="round">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Round`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M3,2c-.41406,0-.75.33594-.75.75v7.25c0,4.27344,3.47656,7.75,7.75,7.75h7.25c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75h-7.25c-3.44629,0-6.25-2.80371-6.25-6.25V2.75c0-.41406-.33594-.75-.75-.75Z"
                ></path>
                <path
                  d="M12.25,2c-.41406,0-.75.33594-.75.75v5c0,.41406.33594.75.75.75h5c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75h-4.25V2.75c0-.41406-.33594-.75-.75-.75Z"
                  opacity=".5"
                ></path>
                <path
                  d="M10,17c-3.86597,0-7-3.13403-7-7V2h9v.05054c-.28979.10376-.5.37402-.5.69946v5c0,.41406.33594.75.75.75h5c.32544,0,.5957-.21021.69946-.5h.05054v9h-8Z"
                  opacity=".2"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
          <sp-action-button value="bevel">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Bevel`)}
            </sp-tooltip>
            <sp-icon slot="icon">
              <svg
                role="img"
                fill="currentColor"
                viewBox="0 0 20 20"
                id="-icon"
                width="16"
                height="16"
                aria-hidden="true"
                aria-label=""
                focusable="false"
              >
                <path
                  d="M3,2c-.41406,0-.75.33594-.75.75v7.25c0,.19922.0791.38965.21973.53027l7,7c.14062.14062.33105.21973.53027.21973h7.25c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75h-6.93945l-6.56055-6.56055V2.75c0-.41406-.33594-.75-.75-.75Z"
                ></path>
                <path
                  d="M12.25,2c-.41406,0-.75.33594-.75.75v5c0,.41406.33594.75.75.75h5c.41406,0,.75-.33594.75-.75s-.33594-.75-.75-.75h-4.25V2.75c0-.41406-.33594-.75-.75-.75Z"
                  opacity=".4"
                ></path>
                <path
                  d="M10,17l-7-7V2h9v.05054c-.28979.10376-.5.37402-.5.69946v5c0,.41406.33594.75.75.75h5c.32544,0,.5957-.21021.69946-.5h.05054v9h-8Z"
                  opacity=".2"
                ></path>
              </svg>
            </sp-icon>
          </sp-action-button>
        </sp-action-group>
      </div>

      <div class="line">
        <sp-field-label for="marker-start" side-aligned="start"
          >${msg(str`Marker start`)}</sp-field-label
        >
        <sp-picker
          size="s"
          style="width: 70px;"
          label=${msg(str`Marker start`)}
          value=${markerStart}
          @change=${this.handleMarkerStartChanged}
          id="marker-start"
        >
          ${['none', 'line', 'triangle', 'diamond'].map(
      (markerType) =>
        html`<sp-menu-item value=${markerType}
                >${markerType}</sp-menu-item
              >`,
    )}
        </sp-picker>
      </div>

      <div class="line">
        <sp-field-label for="marker-end" side-aligned="start"
          >${msg(str`Marker end`)}</sp-field-label
        >
        <sp-picker
          size="s"
          style="width: 70px;"
          label=${msg(str`Marker end`)}
          value=${markerEnd}
          @change=${this.handleMarkerEndChanged}
          id="marker-end"
        >
          ${['none', 'line', 'triangle', 'diamond'].map(
      (markerType) =>
        html`<sp-menu-item value=${markerType}
                >${markerType}</sp-menu-item
              >`,
    )}
        </sp-picker>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-stroke-content': StrokeContent;
  }
}
