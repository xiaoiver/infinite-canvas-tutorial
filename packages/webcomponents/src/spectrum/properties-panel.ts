import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, AppState } from '../context';
import { API } from '../API';
import { ColorSlider } from '@spectrum-web-components/color-slider';
import { ColorArea } from '@spectrum-web-components/color-area';

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
      gap: 16px;
    }

    .line {
      display: flex;
      align-items: center;

      sp-field-label {
        width: 40px;
      }

      sp-number-field {
        width: 100px;
      }
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

  render() {
    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;
    let angle = 0;

    if (this.node.type === 'circle') {
      width = this.node.r * 2;
      height = this.node.r * 2;
      x = this.node.cx - this.node.r;
      y = this.node.cy - this.node.r;
      angle = 0;
    } else if (this.node.type === 'ellipse') {
      width = this.node.rx * 2;
      height = this.node.ry * 2;
      x = this.node.cx - this.node.rx;
      y = this.node.cy - this.node.ry;
      angle = 0;
    } else if (this.node.type === 'rect') {
      width = this.node.width;
      height = this.node.height;
      x = this.node.x;
      y = this.node.y;
      angle = 0;
    }

    return html`
      <h4>Properties</h4>
      <sp-accordion allow-multiple size="s">
        <sp-accordion-item label=${'Shape ' + this.node.type} open>
          <div class="content">
            <div class="line">
              <sp-field-label for="style" side-aligned="start"
                >Style</sp-field-label
              >
              <sp-action-button quiet size="m" id="fill">
                <sp-icon-properties slot="icon"></sp-icon-properties>
                <sp-tooltip self-managed placement="bottom"> Fill </sp-tooltip>
              </sp-action-button>
              <sp-overlay trigger="fill@click" placement="bottom">
                <sp-popover>
                  <sp-color-area
                    color="hsv (0 100% 100%)"
                    @input=${({ target }: Event & { target: ColorArea }) => {
                      const next = target.nextElementSibling as ColorSlider;
                      const display = next.nextElementSibling as HTMLElement;
                      display.textContent = target.color as string;
                      display.style.color = target.color as string;
                      next.color = target.color;
                    }}
                  ></sp-color-area>
                  <sp-color-slider
                    color="hsv(0 100% 100%)"
                    @input=${({
                      target: {
                        color,
                        previousElementSibling,
                        nextElementSibling,
                      },
                    }: Event & {
                      target: ColorSlider & {
                        previousElementSibling: ColorArea;
                        nextElementSibling: HTMLDivElement;
                      };
                    }): void => {
                      previousElementSibling.color = color;
                      nextElementSibling.textContent = color as string;
                      nextElementSibling.style.color = color as string;
                    }}
                  ></sp-color-slider>
                </sp-popover>
              </sp-overlay>

              <sp-action-button quiet size="m" id="stroke">
                <sp-icon-properties slot="icon"></sp-icon-properties>
                <sp-tooltip self-managed placement="bottom">
                  Stroke
                </sp-tooltip>
              </sp-action-button>
              <sp-overlay trigger="stroke@click" placement="bottom">
                <sp-popover> </sp-popover>
              </sp-overlay>
            </div>
          </div>
        </sp-accordion-item>
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
