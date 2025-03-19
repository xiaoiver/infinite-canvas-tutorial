import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  DataURLType,
  RasterScreenshotRequest,
  VectorScreenshotRequest,
} from '@infinite-canvas-tutorial/ecs';

import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import '@shoelace-style/shoelace/dist/components/menu/menu.js';
import '@shoelace-style/shoelace/dist/components/menu-item/menu-item.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { Event } from '../event';

@customElement('ic-shoelace-exporter')
export class Exporter extends LitElement {
  static styles = css`
    :host {
      box-shadow: var(--sl-shadow-medium);
      background: var(--sl-panel-background-color);
    }

    sl-switch {
      margin-left: 24px;
      color: var(--sl-color-neutral-700);
    }

    sl-menu-item::part(base) {
      font-size: 14px;
    }
  `;

  @state()
  grid = false;

  private handleInputChange() {
    this.grid = !this.grid;
  }

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('sl-select', async (event: MouseEvent) => {
      const selectedItem = (event.detail as any).item;

      let detail: RasterScreenshotRequest | VectorScreenshotRequest;
      if (
        selectedItem.value === 'download-image-png' ||
        selectedItem.value === 'download-image-jpeg'
      ) {
        detail = new RasterScreenshotRequest();
        (detail as RasterScreenshotRequest).type = `image/${
          selectedItem.value.split('-').reverse()[0]
        }` as DataURLType;
      } else {
        detail = new VectorScreenshotRequest();
      }
      detail.grid = this.grid;

      this.dispatchEvent(
        new CustomEvent(Event.SCREENSHOT_REQUESTED, {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
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
    'ic-shoelace-exporter': Exporter;
  }
}
