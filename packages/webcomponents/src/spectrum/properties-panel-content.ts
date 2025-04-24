import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  SerializedNode,
  TextSerializedNode,
  AppState,
  API,
} from '@infinite-canvas-tutorial/ecs';
import { when } from 'lit/directives/when.js';
import { apiContext, appStateContext } from '../context';

@customElement('ic-spectrum-properties-panel-content')
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
  api: API;

  @property()
  node: SerializedNode;

  @state()
  width: number;

  private handleWidthChanged(e: Event & { target: HTMLInputElement }) {
    const newWidth = parseInt(e.target.value);
    if (this.node.type === 'rect') {
      if (this.node.lockAspectRatio) {
        const { width, height } = this.node;
        const aspectRatio = width / height;
        const newHeight = newWidth / aspectRatio;
        this.api.updateNode(this.node, { width: newWidth, height: newHeight });
        this.api.record();
      } else {
        this.api.updateNode(this.node, {
          width: newWidth,
        });
        this.api.record();
      }
    } else if (this.node.type === 'circle') {
      this.api.updateNode(this.node, {
        r: newWidth / 2,
      });
      this.api.record();
    } else if (this.node.type === 'ellipse') {
      if (this.node.lockAspectRatio) {
        const { rx, ry } = this.node;
        const aspectRatio = rx / ry;
        const newHeight = newWidth / aspectRatio;
        this.api.updateNode(this.node, { rx: newWidth / 2, ry: newHeight / 2 });
        this.api.record();
      } else {
        this.api.updateNode(this.node, {
          rx: newWidth / 2,
        });
        this.api.record();
      }
    }
    // TODO: Polyline, Path, Text
  }

  private handleHeightChanged(e: Event & { target: HTMLInputElement }) {
    const newHeight = parseInt(e.target.value);
    if (this.node.type === 'rect') {
      if (this.node.lockAspectRatio) {
        const { width, height } = this.node;
        const aspectRatio = width / height;
        const newWidth = newHeight * aspectRatio;
        this.api.updateNode(this.node, { width: newWidth, height: newHeight });
        this.api.record();
      } else {
        this.api.updateNode(this.node, {
          height: newHeight,
        });
        this.api.record();
      }
    } else if (this.node.type === 'circle') {
      this.api.updateNode(this.node, {
        r: newHeight / 2,
      });
      this.api.record();
    } else if (this.node.type === 'ellipse') {
      this.api.updateNode(this.node, {
        ry: newHeight / 2,
      });
      this.api.record();
    }
    // TODO: Polyline, Path, Text
  }

  private handleXChanged(e: Event & { target: HTMLInputElement }) {
    const x = parseInt(e.target.value);
    if (this.node.type === 'rect') {
      this.api.updateNode(this.node, { x });
      this.api.record();
    } else if (this.node.type === 'circle') {
      this.api.updateNode(this.node, { cx: x + this.node.r });
      this.api.record();
    } else if (this.node.type === 'ellipse') {
      this.api.updateNode(this.node, { cx: x + this.node.rx });
      this.api.record();
    }
    // TODO: Polyline, Path, Text
  }

  private handleYChanged(e: Event & { target: HTMLInputElement }) {
    const y = parseInt(e.target.value);
    if (this.node.type === 'rect') {
      this.api.updateNode(this.node, { y });
      this.api.record();
    } else if (this.node.type === 'circle') {
      this.api.updateNode(this.node, { cy: y + this.node.r });
      this.api.record();
    } else if (this.node.type === 'ellipse') {
      this.api.updateNode(this.node, { cy: y + this.node.ry });
      this.api.record();
    }
    // TODO: Polyline, Path, Text
  }

  private handleLockAspectRatioChanged() {
    this.api.updateNode(this.node, {
      lockAspectRatio: !this.node.lockAspectRatio,
    });
    this.api.record();
  }

  private handleFontSizeChanged(e: Event & { target: HTMLInputElement }) {
    const fontSize = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      fontSize,
    });
    this.api.record();
  }

  private transformTemplate() {
    const { type } = this.node;
    const { lockAspectRatio } = this.node as TextSerializedNode;

    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;
    let angle = 0;

    if (type === 'circle') {
      const { r, cx, cy } = this.node;
      width = r * 2;
      height = r * 2;
      x = cx - r;
      y = cy - r;
      angle = 0;
    } else if (type === 'ellipse') {
      const { rx, ry, cx, cy } = this.node;
      width = rx * 2;
      height = ry * 2;
      x = cx - rx;
      y = cy - ry;
      angle = 0;
    } else if (type === 'rect') {
      const { width: w, height: h, x: xx, y: yy } = this.node;
      width = w;
      height = h;
      x = xx;
      y = yy;
      angle = 0;
    }

    return html`<sp-accordion-item label="Transform" open>
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
              lockAspectRatio,
              () => 'Constrain aspect ratio',
              () => 'Do not constrain aspect ratio',
            )}
          </sp-tooltip>
          ${when(
            lockAspectRatio,
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

    const { fontSize } = this.node as TextSerializedNode;

    return html`
      <sp-accordion allow-multiple size="s">
        ${!isGroup
          ? html`
              <sp-accordion-item label=${'Shape ' + this.node.type} open>
                <div class="content style-group">
                  <div class="line">
                    <sp-field-label for="style" side-aligned="start"
                      >Style</sp-field-label
                    >
                    <div>
                      <ic-spectrum-fill-action-button
                        .node=${this.node}
                      ></ic-spectrum-fill-action-button>
                      ${when(
                        !isText,
                        () => html`<ic-spectrum-stroke-action-button
                          .node=${this.node}
                        ></ic-spectrum-stroke-action-button>`,
                      )}
                    </div>
                  </div>

                  ${when(
                    !isText,
                    () => html`<ic-spectrum-stroke-content
                      .node=${this.node}
                    ></ic-spectrum-stroke-content>`,
                    () => html`<div class="line">
                      <sp-field-label for="font-size" side-aligned="start"
                        >Font size</sp-field-label
                      >
                      <sp-number-field
                        id="font-size"
                        value=${fontSize}
                        hide-stepper
                        autocomplete="off"
                        @change=${this.handleFontSizeChanged}
                        format-options='{
                          "style": "unit",
                          "unit": "px"
                        }'
                      ></sp-number-field>
                    </div> `,
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
