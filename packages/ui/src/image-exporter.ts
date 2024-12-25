import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import type { Canvas } from '@infinite-canvas-tutorial/core';
import { ImageExporter } from '@infinite-canvas-tutorial/core';

@customElement('ic-exporter')
export class Exporter extends LitElement {
  static styles = css`
    :host {
      box-shadow: var(--sl-shadow-medium);
      background: white;
    }

    sl-switch {
      margin-left: 24px;
    }

    sl-menu-item::part(base) {
      font-size: 14px;
    }
  `;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  @state()
  grid = false;

  private handleInputChange() {
    this.grid = !this.grid;
  }

  connectedCallback() {
    super.connectedCallback();
    const exporter = new ImageExporter({ canvas: this.canvas });

    this.addEventListener('sl-select', async (event: MouseEvent) => {
      const selectedItem = (event.detail as any).item;

      let dataURL: string;
      if (
        selectedItem.value === 'download-image-png' ||
        selectedItem.value === 'download-image-jpeg'
      ) {
        const canvas = await exporter.toCanvas({ grid: this.grid });
        dataURL = canvas.toDataURL(
          `image/${selectedItem.value.split('-').reverse()[0]}`,
        ); // png / jpeg
      } else if (selectedItem.value === 'download-image-svg') {
        dataURL = exporter.toSVGDataURL({ grid: this.grid });
      }

      if (dataURL) {
        exporter.downloadImage({
          dataURL,
          name: 'infinite-canvas-screenshot',
        });
      }
    });
  }

  render() {
    return html`<sl-dropdown>
      <sl-icon-button
        slot="trigger"
        name="download"
        label="Download"
      ></sl-icon-button>
      <sl-menu>
        <sl-switch
          size="small"
          .checked=${this.grid}
          @sl-input=${this.handleInputChange}
          >Grids included</sl-switch
        >
        <sl-menu-item value="download-image-png"
          >Download PNG image</sl-menu-item
        >
        <sl-menu-item value="download-image-jpeg"
          >Download JPEG image</sl-menu-item
        >
        <sl-menu-item value="download-image-svg"
          >Download SVG image</sl-menu-item
        >
      </sl-menu>
    </sl-dropdown>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-exporter': Exporter;
  }
}
