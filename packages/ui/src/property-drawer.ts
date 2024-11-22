import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import { type Canvas } from '@infinite-canvas-tutorial/core';

@customElement('ic-property-drawer')
export class PropertyDrawer extends LitElement {
  static styles = css``;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  render() {
    return html`
      <div
        style="position: relative; border: solid 2px var(--sl-panel-border-color); height: 300px; padding: 1rem; margin-bottom: 1rem;"
      >
        The drawer will be contained to this box. This content won't shift or be
        affected in any way when the drawer opens.

        <sl-drawer
          label="Drawer"
          contained
          class="drawer-contained"
          style="--size: 50%;"
        >
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          <sl-button slot="footer" variant="primary">Close</sl-button>
        </sl-drawer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-property-drawer': PropertyDrawer;
  }
}
