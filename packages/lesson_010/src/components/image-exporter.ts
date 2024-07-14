import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import type { Canvas } from '../Canvas';
import { ImageExporter } from '../ImageExporter';

@customElement('ic-exporter-lesson10')
export class Exporter extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      right: 16px;
      top: 16px;
      box-shadow: var(--sl-shadow-medium);
      background: white;
    }
  `;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  private exporter: ImageExporter;

  render() {
    if (this.canvas) {
      this.exporter = new ImageExporter({ canvas: this.canvas });

      this.addEventListener('sl-select', async (event: MouseEvent) => {
        const selectedItem = (event.detail as any).item;
        let dataURL: string;
        if (selectedItem.value === 'download-image-png') {
          const canvas = await this.exporter.toCanvas();
          dataURL = canvas.toDataURL();
        } else if (selectedItem.value === 'download-image-jpeg') {
          const canvas = await this.exporter.toCanvas();
          dataURL = canvas.toDataURL('image/jpeg');
        } else if (selectedItem.value === 'download-image-svg') {
        }

        if (dataURL) {
          this.exporter.downloadImage({
            dataURL,
            name: 'infinite-canvas-screenshot',
          });
        }
      });
    }

    return html`<sl-dropdown>
      <sl-icon-button
        slot="trigger"
        name="download"
        label="Download"
      ></sl-icon-button>
      <sl-menu>
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
    'ic-exporter-lesson10': Exporter;
  }
}
