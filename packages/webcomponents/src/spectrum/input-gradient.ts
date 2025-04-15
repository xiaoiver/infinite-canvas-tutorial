import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { trigger } from '@spectrum-web-components/overlay';
import { Gradient, parseGradient } from '@infinite-canvas-tutorial/ecs';
import { ColorType } from './color-picker';

@customElement('ic-spectrum-input-gradient')
export class InputGradient extends LitElement {
  static styles = css`
    .gradient-actions {
      display: flex;
      align-items: center;
      justify-content: end;
      gap: 8px;
    }
    .gradient-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
      overflow-x: hidden;
      height: 114px;
    }

    .gradient-item {
      display: flex;
      align-items: center;
      justify-content: space-between;

      > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      sp-picker {
        width: 100px;
      }
    }

    sp-popover {
      padding: 0;
    }

    sp-swatch {
      transform: rotate(90deg);
    }

    .gradient-settings-popover {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;

      h4 {
        margin: 0;
      }

      .angle-field {
        display: flex;
        align-items: center;
      }

      sp-number-field {
        width: 100px;
      }
    }

    .gradient-stops-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .gradient-stops {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: auto;
    }

    .gradient-stop {
      display: flex;
      align-items: center;
      justify-content: space-between;

      > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  `;

  @property()
  value: string;

  @property()
  opacity: number;

  @state()
  gradients: Gradient[];

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('value')) {
      this.gradients = parseGradient(this.value) || [];
    }
  }

  private triggerGradientChangeEvent() {
    const event = new CustomEvent('color-change', {
      detail: {
        type: 'gradient',
        value: convertGradientsToCSSValue(this.gradients),
        opacity: this.opacity,
      },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(event);
  }

  private addGradient() {
    this.gradients = [
      ...this.gradients,
      {
        type: 'linear-gradient',
        angle: 0,
        steps: [
          {
            offset: {
              type: '%',
              value: 0,
            },
            color: '#fff',
          },
          {
            offset: {
              type: '%',
              value: 100,
            },
            color: '#000',
          },
        ],
      },
    ];

    this.triggerGradientChangeEvent();
  }

  private removeGradient(index: number) {
    this.gradients = this.gradients.filter((_, i) => i !== index);

    this.triggerGradientChangeEvent();
  }

  private addStop(index: number) {
    this.gradients[index].steps.push({
      offset: {
        type: '%',
        value: 0,
      },
      color: 'white',
    });

    this.triggerGradientChangeEvent();
  }

  private removeStop(index: number, stopIndex: number) {
    this.gradients[index].steps = this.gradients[index].steps.filter(
      (_, i) => i !== stopIndex,
    );

    this.triggerGradientChangeEvent();
  }

  private handleOpacityChange(e: CustomEvent) {
    const opacity = (e.target as any).value;
    this.opacity = opacity;
    this.triggerGradientChangeEvent();
  }

  private handleAngleChange(index: number, e: CustomEvent) {
    const angle = (e.target as any).value;
    if (this.gradients[index].type === 'linear-gradient') {
      (this.gradients[index] as any).angle = angle;

      this.triggerGradientChangeEvent();
    }
  }

  private handleGradientTypeChange(index: number, e: CustomEvent) {
    const type = (e.target as any).value;
    this.gradients[index].type = type;

    this.triggerGradientChangeEvent();
  }

  private handleColorChange(index: number, stopIndex: number, e: CustomEvent) {
    e.stopPropagation();
    const color = (e.detail as any).value;
    this.gradients[index].steps[stopIndex].color = color;
    this.triggerGradientChangeEvent();
  }

  private handleOffsetChange(index: number, stopIndex: number, e: CustomEvent) {
    const offset = (e.target as any).value * 100;
    this.gradients[index].steps[stopIndex].offset.value = offset;

    this.triggerGradientChangeEvent();
  }

  render() {
    return html`
      <sp-action-button quiet size="s" @click="${this.addGradient}">
        <sp-tooltip self-managed placement="bottom"> Add gradient </sp-tooltip>
        <sp-icon-add slot="icon"></sp-icon-add>
      </sp-action-button>
      <div class="gradient-list">
        ${map(this.gradients, (gradient, index) => {
          const renderOverlayContent = () => html`
            <sp-popover class="gradient-settings-popover" dialog>
              <h4>Gradient settings</h4>
              ${gradient.type === 'linear-gradient'
                ? html`
                    <div class="angle-field"
                      <sp-field-label for="angle" side-aligned="start"
                          >Angle</sp-field-label
                        >
                        <sp-number-field
                          id="angle"
                          size="s"
                          min="0"
                          max="360"
                          step="1"
                          value=${gradient.angle}
                          @input=${this.handleAngleChange.bind(this, index)}
                        ></sp-number-field></div>`
                : ''}
              <div class="gradient-stops-header">
                Stops
                <sp-action-button
                  quiet
                  size="s"
                  @click="${this.addStop.bind(this, index)}"
                >
                  <sp-tooltip self-managed placement="bottom">
                    Add stop
                  </sp-tooltip>
                  <sp-icon-add slot="icon"></sp-icon-add>
                </sp-action-button>
              </div>
              <div class="gradient-stops">
                ${gradient.steps.map((step, stopIndex) => {
                  return html`
                    <div class="gradient-stop">
                      <div>
                        <sp-number-field
                          id="angle"
                          size="s"
                          min="0"
                          max="1"
                          step="0.1"
                          format-options='{
                              "style": "percent"
                            }'
                          value=${step.offset.value / 100}
                          @input=${this.handleOffsetChange.bind(
                            this,
                            index,
                            stopIndex,
                          )}
                        ></sp-number-field>

                        <sp-swatch
                          id=${`stop-color-${index}-${stopIndex}`}
                          color=${step.color}
                          size="s"
                        ></sp-swatch>
                        <sp-overlay
                          type="auto"
                          trigger=${`stop-color-${index}-${stopIndex}@click`}
                          placement="bottom"
                        >
                          <sp-popover class="stop-color-popover" dialog>
                            <ic-spectrum-color-picker
                              .types=${[ColorType.Solid]}
                              value=${step.color}
                              @color-change=${this.handleColorChange.bind(
                                this,
                                index,
                                stopIndex,
                              )}
                            ></ic-spectrum-color-picker>
                          </sp-popover>
                        </sp-overlay>
                      </div>
                      <sp-action-button
                        quiet
                        size="s"
                        @click="${this.removeStop.bind(this, index, stopIndex)}"
                      >
                        <sp-tooltip self-managed placement="bottom">
                          Remove stop
                        </sp-tooltip>
                        <sp-icon-remove slot="icon"></sp-icon-remove>
                      </sp-action-button>
                    </div>
                  `;
                })}
              </div>
            </sp-popover>
          `;

          return html`<div class="gradient-item">
            <div>
              <sp-swatch
                color=${convertGradientsToCSSValue([gradient])}
                size="s"
              ></sp-swatch>
              <sp-picker
                label="Gradient type"
                size="s"
                value=${gradient.type}
                @change=${this.handleGradientTypeChange.bind(this, index)}
              >
                <sp-menu-item value="linear-gradient">Linear</sp-menu-item>
                <sp-menu-item value="radial-gradient">Radial</sp-menu-item>
                <sp-menu-item value="conic-gradient">Conic</sp-menu-item>
              </sp-picker>
            </div>
            <div>
              <sp-action-button
                quiet
                size="s"
                ${trigger(renderOverlayContent, {
                  triggerInteraction: 'click',
                  overlayOptions: {
                    placement: 'bottom',
                    offset: 6,
                  },
                })}
              >
                <sp-icon-settings slot="icon"></sp-icon-settings>
                <sp-tooltip self-managed placement="bottom">
                  Gradient settings
                </sp-tooltip>
              </sp-action-button>

              <sp-action-button
                quiet
                size="s"
                @click="${this.removeGradient.bind(this, index)}"
              >
                <sp-tooltip self-managed placement="bottom">
                  Remove gradient
                </sp-tooltip>
                <sp-icon-remove slot="icon"></sp-icon-remove>
              </sp-action-button>
            </div>
          </div>`;
        })}
      </div>
    `;
  }
}

function convertGradientsToCSSValue(gradients: Gradient[]) {
  return gradients
    .map((gradient) => {
      if (gradient.type === 'linear-gradient') {
        return `linear-gradient(${gradient.angle || 0}deg, ${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      } else if (gradient.type === 'radial-gradient') {
        return `radial-gradient(${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      } else if (gradient.type === 'conic-gradient') {
        return `conic-gradient(${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      }
      return '';
    })
    .join(', ');
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-gradient': InputGradient;
  }
}
