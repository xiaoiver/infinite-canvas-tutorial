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
        return `linear-gradient(${gradient.angle}deg, ${gradient.steps
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
      .gradient-actions {
        display: flex;
        align-items: center;
        justify-content: end;
        gap: 8px;
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
        width: 16px;
        height: 16px;
      }
      .gradient-settings {
        width: 320px;
        display: flex;
        flex-direction: column;
        gap: 8px;

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
      }

      .gradient-stop {
        display: flex;
        align-items: center;
        justify-content: space-between;
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

  addGradient() {
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

    const event = new CustomEvent('gradientchanged', {
      detail: {
        gradient: convertGradientsToCSSValue(this.gradients),
        opacity: this.opacity,
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private removeGradient(index: number) {
    this.gradients = this.gradients.filter((_, i) => i !== index);

    const event = new CustomEvent('gradientchanged', {
      detail: {
        gradient: convertGradientsToCSSValue(this.gradients),
        opacity: this.opacity,
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private addStop() {}

  private removeStop(index: number) {}

  private handleOpacityChange(e: CustomEvent) {
    const opacity = (e.target as any).value;
    const event = new CustomEvent('gradientchanged', {
      detail: { gradient: convertGradientsToCSSValue(this.gradients), opacity },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleColorChange(e: CustomEvent) {
    // const color = e.target as string;
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
      ${map(this.gradients, (gradient, index) => {
        return html`<div class="gradient-item">
          <div>
            <div
              class="gradient-preview"
              style="background-image: ${convertGradientsToCSSValue([
                gradient,
              ])}; transform: rotate(90deg);"
            ></div>
            ${gradient.type}
          </div>
          <div>
            <sl-dropdown placement="left-start" hoist>
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
                      ></sl-input
                      ><sl-divider></sl-divider>`
                  : ''}
                <div class="gradient-stops-header">
                  Stops
                  <sl-tooltip content="Add stop" placement="left-start" hoist>
                    <sl-icon-button
                      name="plus-lg"
                      label="Add stop"
                      @click="${this.addStop}"
                    ></sl-icon-button>
                  </sl-tooltip>
                </div>
                ${gradient.steps.map((step) => {
                  return html`
                    <div class="gradient-stop">
                      <sl-input
                        type="number"
                        label="Step offset"
                        size="small"
                        value=${step.offset.value}
                        ><sl-icon name="percent" slot="suffix"></sl-icon
                      ></sl-input>
                      <sl-color-picker
                        hoist
                        size="small"
                        value=${step.color}
                        @sl-input=${this.handleColorChange}
                        opacity
                        swatches="#d0021b; #f5a623; #f8e71c; #8b572a; #7ed321; #417505; #bd10e0; #9013fe; #4a90e2; #50e3c2; #b8e986; #000; #444; #888; #ccc; #fff;"
                      >
                      </sl-color-picker>
                      <sl-tooltip content="Remove" placement="left-start" hoist>
                        <sl-icon-button
                          name="dash-lg"
                          label="Remove stop"
                          @click="${this.removeStop.bind(this, index)}"
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
