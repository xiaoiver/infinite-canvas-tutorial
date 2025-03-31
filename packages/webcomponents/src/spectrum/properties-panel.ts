import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, AppState } from '../context';
import { API } from '../API';
import { ColorArea } from '@spectrum-web-components/color-area';
import { TextSerializedNode } from '@infinite-canvas-tutorial/ecs/lib/utils';

@customElement('ic-spectrum-properties-panel')
export class PropertiesPanel extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      padding: 0;
      width: 300px;

      --system-accordion-size-s-item-header-font-size: 14px;
    }

    sp-popover {
      padding: 0;
    }

    h4 {
      padding: var(--spectrum-global-dimension-size-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .line {
      display: flex;
      align-items: center;

      sp-field-label {
        width: 30px;
      }

      sp-number-field {
        width: 100px;
      }
    }

    ic-spectrum-fill-icon {
      width: 30px;
      height: 30px;
    }

    ic-spectrum-stroke-icon {
      width: 30px;
      height: 30px;
    }

    sp-slider {
      flex: 1;
      margin-right: 8px;
    }

    .stroke-width-field {
      position: relative;
      top: 10px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: API;

  @property()
  node: SerializedNode;

  private handleWidthChanged(e: Event & { target: HTMLInputElement }) {
    console.log('width changed', e.target.value);
  }

  private handleFontSizeChanged(e: Event & { target: HTMLInputElement }) {
    const fontSize = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      fontSize,
    });
  }

  private handleStrokeWidthChanging(e: Event & { target: HTMLInputElement }) {
    const nextElementSibling = e.target.nextElementSibling as HTMLInputElement;
    if (nextElementSibling) {
      nextElementSibling.value = e.target.value;
    }
  }

  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    const strokeWidth = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      strokeWidth,
    });
  }

  private handleFillChanged(e: Event & { target: ColorArea }) {
    const fill = e.target.color.toString();

    // TODO: hex color
    this.api.updateNode(this.node, {
      fill: fill.startsWith('#') ? fill : `#${fill}`,
    });
  }

  render() {
    const { type } = this.node;
    const isGroup = type === 'g';
    const isText = type === 'text';

    const { fill, stroke, strokeWidth, fontSize } = this
      .node as TextSerializedNode;

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

    return html`
      <h4>Properties</h4>
      <sp-accordion allow-multiple size="s">
        ${!isGroup
          ? html`
              <sp-accordion-item label=${'Shape ' + this.node.type} open>
                <div class="content">
                  <div class="line">
                    <sp-field-label for="style" side-aligned="start"
                      >Style</sp-field-label
                    >
                    <sp-action-button quiet size="m" id="fill">
                      <ic-spectrum-fill-icon
                        value=${fill}
                        slot="icon"
                      ></ic-spectrum-fill-icon>
                      <sp-tooltip self-managed placement="bottom">
                        Fill
                      </sp-tooltip>
                    </sp-action-button>
                    <sp-overlay trigger="fill@click" placement="bottom">
                      <sp-popover>
                        <sp-color-area
                          color=${fill}
                          @input=${this.handleFillChanged}
                        ></sp-color-area>
                        <sp-color-slider
                          color=${fill}
                          @input=${this.handleFillChanged}
                        ></sp-color-slider>
                        <sp-field-label for="hex">Hex</sp-field-label>
                        <sp-color-field
                          id="hex"
                          size="s"
                          value=${fill}
                          @input=${this.handleFillChanged}
                        ></sp-color-field>
                      </sp-popover>
                    </sp-overlay>

                    ${!isText
                      ? html`<sp-action-button quiet size="m" id="stroke">
                            <ic-spectrum-stroke-icon
                              value=${stroke}
                              slot="icon"
                            ></ic-spectrum-stroke-icon>
                            <sp-tooltip self-managed placement="bottom">
                              Stroke
                            </sp-tooltip>
                          </sp-action-button>
                          <sp-overlay trigger="stroke@click" placement="bottom">
                            <sp-popover> </sp-popover>
                          </sp-overlay> `
                      : ''}
                  </div>

                  ${!isText
                    ? html`<div class="line">
                        <sp-slider
                          label="Stroke width"
                          label-visibility="text"
                          value=${strokeWidth}
                          @input=${this.handleStrokeWidthChanging}
                          @change=${this.handleStrokeWidthChanged}
                        ></sp-slider>
                        <sp-number-field
                          class="stroke-width-field"
                          value=${strokeWidth}
                          @change=${this.handleStrokeWidthChanged}
                          hide-stepper
                          autocomplete="off"
                          format-options='{
                            "style": "unit",
                            "unit": "px"
                          }'
                        ></sp-number-field>
                      </div> `
                    : ''}
                  ${isText
                    ? html`<div class="line">
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
                      </div> `
                    : ''}
                </div>
              </sp-accordion-item>
            `
          : ''}
        <sp-accordion-item label="Transform" open>
          <div class="content">
            <div class="line">
              <sp-field-label for="w" side-aligned="start">W</sp-field-label>
              <sp-number-field
                id="w"
                value=${width}
                hide-stepper
                autocomplete="off"
                @change=${this.handleWidthChanged}
                format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
              ></sp-number-field>

              <sp-field-label for="x" side-aligned="start">X</sp-field-label>
              <sp-number-field
                id="x"
                value=${x}
                hide-stepper
                autocomplete="off"
                format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
              ></sp-number-field>
            </div>

            <div class="line">
              <sp-field-label for="h" side-aligned="start">H</sp-field-label>
              <sp-number-field
                id="h"
                value=${height}
                hide-stepper
                autocomplete="off"
                format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
              ></sp-number-field>

              <sp-field-label for="y" side-aligned="start">Y</sp-field-label>
              <sp-number-field
                id="y"
                value=${y}
                hide-stepper
                autocomplete="off"
                format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
              ></sp-number-field>
            </div>

            <div class="line">
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
        </sp-accordion-item>
      </sp-accordion>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-properties-panel': PropertiesPanel;
  }
}
