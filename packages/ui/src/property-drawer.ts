import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import { Shape, type Canvas } from '@infinite-canvas-tutorial/core';

@customElement('ic-property-drawer')
export class PropertyDrawer extends LitElement {
  static styles = css``;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  @state()
  shape: Shape;

  connectedCallback() {
    super.connectedCallback();

    this.canvas.root.addEventListener('selected', (e: CustomEvent) => {
      const $drawer = this.shadowRoot!.querySelector('sl-drawer');
      const shape = e.detail as Shape;
      this.shape = shape;

      console.log(e.detail);
      // @ts-ignore
      $drawer.show();
    });

    this.canvas.root.addEventListener('deselected', (e: CustomEvent) => {
      const $drawer = this.shadowRoot!.querySelector('sl-drawer');
      this.shape = undefined;
      // @ts-ignore
      $drawer.hide();
    });
  }

  render() {
    return html`
      <sl-drawer
        label="Property panel"
        contained
        class="drawer-contained"
        style="--size: 40%;"
      >
        <div>
          <h4>Stroke</h4>
          <sl-color-picker
            value=${this.shape?.stroke}
            label="Select a color"
          ></sl-color-picker>
          <h4>Fill</h4>
          <sl-color-picker
            value=${this.shape?.fill}
            label="Select a color"
          ></sl-color-picker>
        </div>
      </sl-drawer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-property-drawer': PropertyDrawer;
  }
}
