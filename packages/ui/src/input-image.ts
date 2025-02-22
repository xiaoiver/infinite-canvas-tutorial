import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';

@customElement('ic-input-image')
export class InputImage extends LitElement {
  static styles = css`
    input[type='file'] {
      &::file-selector-button {
        cursor: pointer;
        margin-right: 1em;
        font-family: var(--sl-input-font-family);
        font-weight: var(--sl-font-weight-semibold);
        font-size: var(--sl-button-font-size-small);
        height: var(--sl-input-height-small);
        border-style: solid;
        border-width: var(--sl-input-border-width);
        border-radius: var(--sl-input-border-radius-small);
        background-color: var(--sl-color-neutral-0);
        border-color: var(--sl-color-neutral-300);
        color: var(--sl-color-neutral-700);
      }

      &::file-selector-button:hover {
        background-color: var(--sl-color-primary-50);
        border-color: var(--sl-color-primary-300);
        color: var(--sl-color-primary-700);
      }
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      margin-top: 8px;
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

    sl-divider {
      margin: 8px 0;
    }
  `;

  @property()
  opacity: number;

  @state()
  dataURI: string;

  handleInput(e: Event) {
    const files = (e.target as HTMLInputElement).files;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataURI = e.target.result as string;
      this.dataURI = dataURI;
      const event = new CustomEvent('filechanged', {
        detail: { dataURI, opacity: this.opacity },
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      this.dispatchEvent(event);
    };
    reader.readAsDataURL(files[0]);
  }

  handleOpacityChange(e: CustomEvent) {
    const opacity = (e.target as any).value;
    const event = new CustomEvent('filechanged', {
      detail: { dataURI: this.dataURI, opacity },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <input type="file" accept="image/*" @change=${this.handleInput} />
      ${this.dataURI ? html`<img src=${this.dataURI} />` : ''}
      <sl-divider></sl-divider>
      <ic-input-range
        label="Opacity"
        min="0"
        max="1"
        step="0.1"
        value=${this.opacity}
        @sl-input=${this.handleOpacityChange}
      ></ic-input-range>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-input-image': InputImage;
  }
}
