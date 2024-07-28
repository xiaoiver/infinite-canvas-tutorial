import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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
  grids = false;

  private exporter: ImageExporter;

  private handleInputChange(event: any) {
    this.grids = !this.grids;
  }

  connectedCallback() {
    super.connectedCallback();
    this.exporter = new ImageExporter({ canvas: this.canvas });

    this.addEventListener('sl-select', async (event: MouseEvent) => {
      const selectedItem = (event.detail as any).item;
      let dataURL: string;
      if (
        selectedItem.value === 'download-image-png' ||
        selectedItem.value === 'download-image-jpeg'
      ) {
        const canvas = await this.exporter.toCanvas({ grids: this.grids });
        dataURL = canvas.toDataURL(
          `image/${selectedItem.value.split('-').reverse()[0]}`,
        ); // png / jpeg
      } else if (selectedItem.value === 'download-image-svg') {
        dataURL = this.exporter.toSVGDataURL({ grids: this.grids });
      }

      if (dataURL) {
        this.exporter.downloadImage({
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
          .checked=${this.grids}
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
    'ic-exporter-lesson10': Exporter;
  }
}
