import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  SerializedNode,
  AppState,
  FillAttributes,
} from '@infinite-canvas-tutorial/ecs';
import { when } from 'lit/directives/when.js';
import { RAD_TO_DEG } from '@pixi/math';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
@customElement('ic-spectrum-properties-panel-content')
@localized()
export class PropertiesPanelContent extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;

      --system-accordion-size-s-item-header-font-size: 14px;
      --mod-accordion-item-header-font-size: 14px;
    }

    sp-popover {
      padding: 0;
    }

    sp-accordion {
      overflow-y: overlay;
      overflow: hidden auto;
      max-height: 400px;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }

    .style-group {
      .line {
        sp-field-label {
          width: 100px;
        }
      }
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      sp-field-label {
        width: 30px;
      }

      sp-number-field {
        width: 80px;
      }

      > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }

    .lock {
      width: 20px;
      height: 20px;

      svg {
        height: 100%;
        width: 100%;
        vertical-align: top;
        color: inherit;
      }
    }

    .lock-button {
      position: absolute;
      left: 128px;
      top: 22px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  @state()
  lockAspectRatio: boolean = true;

  private handleFillOpacityChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNode(this.node, {
      fillOpacity: parseFloat(e.target.value),
    });
    this.api.record();
  }

  private handleWidthChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        width: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleHeightChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        height: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleXChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        x: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleYChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        y: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleLockAspectRatioChanged() {
    this.lockAspectRatio = !this.lockAspectRatio;
  }

  private transformTemplate() {
    const { width, height, x, y, rotation } = this.node;
    const angle = rotation * RAD_TO_DEG;

    return html`<sp-accordion-item label=${msg(str`Transform`)} open>
      <div class="content">
        <div class="line">
          <div>
            <sp-field-label for="w" side-aligned="start">W</sp-field-label>
            <sp-number-field
              id="w"
              value=${width}
              @change=${this.handleWidthChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
            ></sp-number-field>
            <sp-icon class="lock">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 4.5">
                <defs>
                  <style>
                    .lock {
                      fill: none;
                      stroke: var(--spectrum-gray-500);
                      stroke-miterlimit: 10;
                    }
                  </style>
                </defs>
                <line class="lock" y1="0.5" x2="16.5" y2="0.5"></line>
                <line class="lock" x1="16.5" x2="16.5" y2="4.5"></line>
              </svg>
            </sp-icon>
          </div>

          <div>
            <sp-field-label for="x" side-aligned="end">X</sp-field-label>
            <sp-number-field
              id="x"
              value=${x}
              @change=${this.handleXChanged}
              hide-stepper
              autocomplete="off"
              format-options='{
                    "style": "unit",
                    "unit": "px"
                  }'
            ></sp-number-field>
          </div>
        </div>

        <div class="line">
          <div>
            <sp-field-label for="h" side-aligned="start">H</sp-field-label>
            <sp-number-field
              id="h"
              value=${height}
              @change=${this.handleHeightChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              format-options='{
                    "style": "unit",
                    "unit": "px"
                  }'
            ></sp-number-field>
            <sp-icon class="lock">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 7">
                <defs>
                  <style>
                    .lock {
                      fill: none;
                      stroke: var(--spectrum-gray-500);
                      stroke-miterlimit: 10;
                    }
                  </style>
                </defs>
                <line class="lock" y1="4.5" x2="17" y2="4.5"></line>
                <line class="lock" x1="16.5" x2="16.5" y2="4.5"></line>
              </svg>
            </sp-icon>
          </div>

          <div>
            <sp-field-label for="y" side-aligned="end">Y</sp-field-label>
            <sp-number-field
              id="y"
              value=${y}
              @change=${this.handleYChanged}
              hide-stepper
              autocomplete="off"
              format-options='{
                    "style": "unit",
                    "unit": "px"
                  }'
            ></sp-number-field>
          </div>
        </div>

        <sp-action-button
          quiet
          size="s"
          class="lock-button"
          @click=${this.handleLockAspectRatioChanged}
        >
          <sp-tooltip self-managed placement="bottom">
            ${when(
              this.lockAspectRatio,
              () => msg(str`Constrain aspect ratio`),
              () => msg(str`Do not constrain aspect ratio`),
            )}
          </sp-tooltip>
          ${when(
            this.lockAspectRatio,
            () => html`<sp-icon-lock-closed slot="icon"></sp-icon-lock-closed>`,
            () => html`<sp-icon-lock-open slot="icon"></sp-icon-lock-open>`,
          )}
        </sp-action-button>

        <div class="line">
          <div>
            <sp-field-label
              for="angle"
              side-aligned="start"
              format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
              >Angle</sp-field-label
            >
            <sp-number-field
              id="angle"
              value=${angle}
              hide-stepper
              autocomplete="off"
              format-options='{
                  "style": "unit",
                  "unit": "deg"
                }'
            ></sp-number-field>
          </div>
        </div>
      </div>
    </sp-accordion-item>`;
  }

  render() {
    if (!this.node) {
      return;
    }

    const { type } = this.node;
    const isGroup = type === 'g';
    const isText = type === 'text';

    // const { fontSize } = this.node as TextSerializedNode;

    return html`
      <sp-accordion allow-multiple size="s">
        ${!isGroup
          ? html`
              <sp-accordion-item label=${'Shape ' + this.node.type} open>
                <div class="content style-group">
                  <div class="line">
                    <sp-field-label for="style" side-aligned="start"
                      >${msg(str`Style`)}</sp-field-label
                    >
                    <div>
                      <ic-spectrum-fill-action-button
                        .node=${this.node}
                      ></ic-spectrum-fill-action-button>
                      ${when(
                        !isText,
                        () => html` <ic-spectrum-stroke-action-button
                          .node=${this.node}
                        ></ic-spectrum-stroke-action-button>`,
                      )}
                    </div>
                  </div>

                  <div class="line">
                    <sp-slider
                      style="flex: 1;"
                      label=${msg(str`Fill opacity`)}
                      size="s"
                      max="1"
                      min="0"
                      value=${(this.node as FillAttributes).fillOpacity ?? 1}
                      step="0.01"
                      editable
                      @change=${this.handleFillOpacityChanged}
                    ></sp-slider>
                  </div>

                  ${when(
                    !isText,
                    () => html`<ic-spectrum-stroke-content
                      .node=${this.node}
                    ></ic-spectrum-stroke-content>`,
                    () => html`<ic-spectrum-text-content
                      .node=${this.node}
                    ></ic-spectrum-text-content>`,
                  )}
                </div>
              </sp-accordion-item>
            `
          : ''}
        ${this.transformTemplate()}
      </sp-accordion>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-properties-panel-content': PropertiesPanelContent;
  }
}
