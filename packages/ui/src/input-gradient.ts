import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { Gradient, parseGradient } from '@infinite-canvas-tutorial/core';

import '@shoelace-style/shoelace/dist/components/input/input.js';

function convertGradientsToValue(gradients: Gradient[]) {
  return gradients.map((gradient) => {
    if (gradient.type === 'linear-gradient') {
      return `linear-gradient(${gradient.angle}deg, ${gradient.steps
        .map((step) => `${step.color} ${step.offset}`)
        .join(', ')})`;
      // } else if (gradient.type === 'radial-gradient') {
      //   return `radial-gradient(${gradient.angle}deg, ${gradient.steps.map((step) => `${step.color} ${step.offset}`).join(', ')})`;
    }
    return '';
  });
}

@customElement('ic-input-gradient')
export class InputGradient extends LitElement {
  @property()
  value: string;

  @state()
  gradients: Gradient[] = [];

  willUpdate() {
    this.gradients = parseGradient(this.value);

    console.log(this.gradients);
  }

  addGradient() {
    // this.gradients.push({
    //   type: 'linear-gradient',
    //   orientation: 'to right',
    //   steps: [{ color: '#000000', offset: 0 }],
    // });
  }

  render() {
    return html`<sl-icon-button
        name="add"
        label="Add gradient"
        @click="${this.addGradient}"
      ></sl-icon-button>
      ${map(this.gradients, (gradient) => {
        return html` ${gradient.type === 'linear-gradient' ? 'linear' : ''}
          <sl-input type="color" value=${gradient.steps[0].color}></sl-input>`;
      })}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-input-gradient': InputGradient;
  }
}
