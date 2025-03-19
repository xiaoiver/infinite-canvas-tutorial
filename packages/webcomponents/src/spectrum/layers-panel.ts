import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ic-spectrum-layers-panel')
export class LayersPanel extends LitElement {
  @property({ type: Boolean })
  open = false;

  static styles = css`
    :host {
      display: flex;
      background-color: white;
      border-radius: var(--spectrum-corner-radius-200);
      justify-content: center;
      pointer-events: auto;

      padding: var(--spectrum-global-dimension-size-100);
      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }
  `;

  render() {
    console.log('render', this.open);

    return this.open ? html`xxx` : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layers-panel': LayersPanel;
  }
}
