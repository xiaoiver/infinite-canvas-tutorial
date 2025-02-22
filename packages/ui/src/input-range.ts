import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';

@customElement('ic-input-range')
export class InputRange extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    sl-range {
      flex: 1;
    }

    sl-input {
      width: 80px;
    }

    sl-range::part(form-control) {
      display: flex;
      justify-content: space-between;
    }

    sl-range::part(form-control-label) {
      font-family: var(--sl-input-font-family);
      font-weight: var(--sl-font-weight-semibold);
      font-size: var(--sl-button-font-size-small);
      color: var(--sl-color-neutral-600);
    }
  `;

  @property({ type: Number })
  value = 0;

  @property({ type: Number })
  min = 0;

  @property({ type: Number })
  max = 100;

  @property({ type: Number })
  step = 1;

  @property({ type: String })
  label = '';

  private handleRangeInput(e: CustomEvent) {
    const newValue = Number((e.target as any).value);
    this.dispatchChangeEvent(newValue);
  }

  private handleInputChange(e: CustomEvent) {
    const newValue = Number((e.target as any).value);
    if (!isNaN(newValue)) {
      const clampedValue = Math.min(Math.max(newValue, this.min), this.max);
      this.dispatchChangeEvent(clampedValue);
    }
  }

  private dispatchChangeEvent(value: number) {
    this.value = value;
    const event = new CustomEvent('value-changed', {
      detail: { value },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <sl-range
        .value=${this.value}
        .min=${this.min}
        .max=${this.max}
        .step=${this.step}
        @sl-input=${this.handleRangeInput}
      >
        ${this.label ? html`<span slot="label">${this.label}</span>` : ''}
      </sl-range>
      <sl-input
        type="number"
        size="small"
        .value=${this.value.toString()}
        .min=${this.min}
        .max=${this.max}
        .step=${this.step}
        @sl-input=${this.handleInputChange}
      ></sl-input>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-input-range': InputRange;
  }
}
