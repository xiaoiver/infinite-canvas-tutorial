import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { Gradient, parseGradient } from '@infinite-canvas-tutorial/core';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import { panelStyles } from './styles';

// function convertGradientsToValue(gradients: Gradient[]) {
//   return gradients.map((gradient) => {
//     if (gradient.type === 'linear-gradient') {
//       return `linear-gradient(${gradient.angle}deg, ${gradient.steps
//         .map((step) => `${step.color} ${step.offset}`)
//         .join(', ')})`;
//       // } else if (gradient.type === 'radial-gradient') {
//       //   return `radial-gradient(${gradient.angle}deg, ${gradient.steps.map((step) => `${step.color} ${step.offset}`).join(', ')})`;
//     }
//     return '';
//   });
// }

@customElement('ic-input-gradient')
export class InputGradient extends LitElement {
  static styles = [panelStyles, css``];

  @property()
  value: string;

  @property()
  opacity: number;

  @state()
  gradients: Gradient[] = [];

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('value')) {
      this.gradients = parseGradient(this.value);

      console.log(this.gradients);
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
  }

  private removeGradient(index: number) {
    this.gradients = this.gradients.filter((_, i) => i !== index);
  }

  private handleOpacityChange(e: CustomEvent) {
    const opacity = (e.target as any).value;
    const event = new CustomEvent('gradientchanged', {
      detail: { gradient: this.value, opacity },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`<sl-icon-button
        name="plus-lg"
        label="Add gradient"
        @click="${this.addGradient}"
      ></sl-icon-button>
      ${map(this.gradients, (gradient, index) => {
        return html`<div>
          ${gradient.type === 'linear-gradient' ? 'linear' : ''}
          <sl-icon-button
            name="dash-lg"
            label="Remove gradient"
            @click="${this.removeGradient.bind(this, index)}"
          ></sl-icon-button>
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
      ></sl-input> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-input-gradient': InputGradient;
  }
}
