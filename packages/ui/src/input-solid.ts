import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { rgbAndOpacityToRgba, rgbaToRgbAndOpacity } from './utils';

import '@shoelace-style/shoelace/dist/components/color-picker/color-picker.js';

@customElement('ic-input-solid')
export class InputSolid extends LitElement {
  @property()
  rgb: string;

  @property()
  opacity: number;

  private handleColorChange(e: CustomEvent) {
    const { rgb, opacity } = rgbaToRgbAndOpacity(
      (e.target as any).getFormattedValue('rgba') as string,
    );

    const event = new CustomEvent('colorchanged', {
      detail: { rgb, opacity },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <sl-color-picker
        inline
        size="small"
        value=${rgbAndOpacityToRgba(this.rgb, this.opacity)}
        @sl-input=${this.handleColorChange}
        opacity
        label="Select a color"
        swatches="#d0021b; #f5a623; #f8e71c; #8b572a; #7ed321; #417505; #bd10e0; #9013fe; #4a90e2; #50e3c2; #b8e986; #000; #444; #888; #ccc; #fff;"
      ></sl-color-picker>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-input-solid': InputSolid;
  }
}
