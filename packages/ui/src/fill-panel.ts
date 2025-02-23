import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/radio-button/radio-button.js';
import { panelStyles } from './styles';

@customElement('ic-fill-panel')
export class FillPanel extends LitElement {
  static styles = [
    panelStyles,
    css`
      .fill-panel-content {
      }
    `,
  ];

  @property()
  fill: string;

  @property()
  fillOpacity: number;

  @property()
  @state()
  type: 'solid' | 'gradient' | 'image' | 'none';

  private handleSolidChange(e: CustomEvent) {
    const { rgb, opacity } = e.detail;
    const event = new CustomEvent('fillchanged', {
      detail: { fill: rgb, fillOpacity: opacity },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleImageChange(e: CustomEvent) {
    const { dataURI, opacity } = e.detail;

    load(dataURI, ImageLoader).then((image) => {
      const event = new CustomEvent('fillchanged', {
        detail: { fill: image, fillOpacity: opacity },
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      this.dispatchEvent(event);
    });
  }

  private handleFillTypeChange(e: CustomEvent) {
    this.type = (e.target as any).value;
  }

  render() {
    return html`
      <div class="fill-panel-content">
        <sl-radio-group
          name="fill"
          label="Color"
          value=${this.type}
          @sl-change=${this.handleFillTypeChange}
        >
          <sl-radio-button size="small" value="solid">Solid</sl-radio-button>
          <sl-radio-button size="small" value="gradient"
            >Gradient</sl-radio-button
          >
          <sl-radio-button size="small" value="image">Image</sl-radio-button>
          <sl-radio-button size="small" value="none">None</sl-radio-button>
        </sl-radio-group>
        ${this.type === 'solid'
          ? html`
              <ic-input-solid
                rgb=${this.fill}
                opacity=${this.fillOpacity}
                @colorchanged=${this.handleSolidChange}
              ></ic-input-solid>
            `
          : this.type === 'gradient'
          ? html` <ic-input-gradient value=${this.fill}></ic-input-gradient>`
          : this.type === 'image'
          ? html`
              <ic-input-image
                opacity=${this.fillOpacity}
                @filechanged=${this.handleImageChange}
              ></ic-input-image>
            `
          : html``}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-fill-panel': FillPanel;
  }
}
