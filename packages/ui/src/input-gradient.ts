import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { Gradient, parseGradient } from '@infinite-canvas-tutorial/core';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import { panelStyles } from './styles';

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

@customElement('ic-input-gradient')
export class InputGradient extends LitElement {
  static styles = [
    panelStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

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
      }

      .gradient-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: var(--sl-font-size-small);

        > div {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
      .gradient-preview {
        width: 24px;
        height: 24px;
      }
      .gradient-settings {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 280px;
        background-color: var(--sl-panel-background-color);
        border-radius: var(--sl-border-radius-medium);
        border: solid 1px var(--sl-color-neutral-200);
        padding: var(--sl-spacing-small);
      }

      .gradient-stops-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: var(--sl-font-size-small);
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
    `,
  ];

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
    const event = new CustomEvent('gradientchanged', {
      detail: {
        gradient: convertGradientsToCSSValue(this.gradients),
        opacity: this.opacity,
      },
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
            color: 'white',
          },
          {
            offset: {
              type: '%',
              value: 100,
            },
            color: 'black',
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
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  private removeStop(index: number, stopIndex: number) {
    this.gradients[index].steps = this.gradients[index].steps.filter(
      (_, i) => i !== stopIndex,
    );
    this.requestUpdate();
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
      this.requestUpdate();
      this.triggerGradientChangeEvent();
    }
  }

  private handleGradientTypeChange(index: number, e: CustomEvent) {
    const type = (e.target as any).value;
    this.gradients[index].type = type;
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  private handleColorChange(index: number, stopIndex: number, e: CustomEvent) {
    const color = (e.target as any).value;
    this.gradients[index].steps[stopIndex].color = color;
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  private handleOffsetChange(index: number, stopIndex: number, e: CustomEvent) {
    const offset = (e.target as any).value;
    this.gradients[index].steps[stopIndex].offset.value = offset;
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  render() {
    return html`
      <div class="gradient-actions">
        <sl-tooltip content="Add gradient" placement="left-start" hoist>
          <sl-icon-button
            name="plus-lg"
            label="Add gradient"
            @click="${this.addGradient}"
          ></sl-icon-button>
        </sl-tooltip>
      </div>
      <div class="gradient-list">
        ${map(this.gradients, (gradient, index) => {
          return html`<div class="gradient-item">
            <div>
              <div
                class="gradient-preview"
                style="background-image: ${convertGradientsToCSSValue([
                  gradient,
                ])}; transform: rotate(90deg);"
              ></div>
              <sl-select
                placeholder="center"
                size="small"
                hoist
                value=${gradient.type}
                @sl-change=${this.handleGradientTypeChange.bind(this, index)}
              >
                <sl-option value="linear-gradient">Linear</sl-option>
                <sl-option value="radial-gradient">Radial</sl-option>
                <sl-option value="conic-gradient">Conic</sl-option>
              </sl-select>
            </div>
            <div>
              <sl-dropdown placement="bottom-start" hoist>
                <sl-icon-button
                  slot="trigger"
                  name="gear"
                  label="Gradient settings"
                ></sl-icon-button>
                <div class="gradient-settings">
                  ${gradient.type === 'linear-gradient'
                    ? html`<sl-input
                        type="number"
                        label="Angle"
                        size="small"
                        min="0"
                        max="360"
                        step="1"
                        value=${gradient.angle}
                        @sl-input=${this.handleAngleChange.bind(this, index)}
                      ></sl-input>`
                    : ''}
                  <div class="gradient-stops-header">
                    Stops
                    <sl-tooltip content="Add stop" placement="left-start" hoist>
                      <sl-icon-button
                        name="plus-lg"
                        label="Add stop"
                        @click="${this.addStop.bind(this, index)}"
                      ></sl-icon-button>
                    </sl-tooltip>
                  </div>
                  ${gradient.steps.map((step, stopIndex) => {
                    return html`
                      <div class="gradient-stop">
                        <div>
                          <sl-input
                            type="number"
                            size="small"
                            value=${step.offset.value}
                            @sl-input=${this.handleOffsetChange.bind(
                              this,
                              index,
                              stopIndex,
                            )}
                            min="0"
                            max="100"
                            step="0.1"
                            ><sl-icon name="percent" slot="suffix"></sl-icon
                          ></sl-input>
                          <sl-color-picker
                            hoist
                            size="small"
                            value=${step.color}
                            @sl-input=${this.handleColorChange.bind(
                              this,
                              index,
                              stopIndex,
                            )}
                            opacity
                            swatches="#d0021b; #f5a623; #f8e71c; #8b572a; #7ed321; #417505; #bd10e0; #9013fe; #4a90e2; #50e3c2; #b8e986; #000; #444; #888; #ccc; #fff;"
                          >
                          </sl-color-picker>
                        </div>
                        <sl-tooltip
                          content="Remove"
                          placement="left-start"
                          hoist
                        >
                          <sl-icon-button
                            name="dash-lg"
                            label="Remove stop"
                            @click="${this.removeStop.bind(
                              this,
                              index,
                              stopIndex,
                            )}"
                          ></sl-icon-button>
                        </sl-tooltip>
                      </div>
                    `;
                  })}
                </div>
              </sl-dropdown>
              <sl-tooltip content="Remove" placement="left-start" hoist>
                <sl-icon-button
                  name="dash-lg"
                  label="Remove gradient"
                  @click="${this.removeGradient.bind(this, index)}"
                ></sl-icon-button>
              </sl-tooltip>
            </div>
          </div>`;
        })}
      </div>
      <sl-input
        type="number"
        label="Opacity"
        size="small"
        min="0"
        max="1"
        step="0.1"
        value=${this.opacity}
        @sl-change=${this.handleOpacityChange}
      ></sl-input>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-input-gradient': InputGradient;
  }
}
