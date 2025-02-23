import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/radio-button/radio-button.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import { panelStyles } from './styles';

@customElement('ic-stroke-panel')
export class StrokePanel extends LitElement {
  static styles = [
    panelStyles,
    css`
      .stroke-panel-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    `,
  ];

  @property()
  stroke: string;

  @property()
  strokeOpacity: number;

  @property()
  strokeWidth: number;

  @property()
  strokeAlignment: 'inner' | 'center' | 'outer';

  @property()
  strokeLinejoin: 'miter' | 'round' | 'bevel';

  @property()
  strokeDash: number;

  @property()
  strokeGap: number;

  @property()
  strokeDashOffset: number;

  @property()
  @state()
  type: 'solid' | 'none';

  @property()
  @state()
  strokeStyle: 'solid' | 'dash' = 'solid';

  private handleStrokeChange(e: CustomEvent) {
    const { rgb, opacity } = e.detail;
    const event = new CustomEvent('strokechanged', {
      detail: { stroke: rgb, strokeOpacity: opacity },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleTypeChange(e: CustomEvent) {
    this.type = (e.target as any).value;
  }

  private handleStrokeStyleChange(e: CustomEvent) {
    this.strokeStyle = (e.target as any).value;
    // const event = new CustomEvent('strokewidthchanged', {
    //   detail: { strokeWidth },
    //   bubbles: true,
    //   composed: true,
    //   cancelable: true,
    // });
    // this.dispatchEvent(event);
  }

  private handleStrokeWidthChange(e: CustomEvent) {
    const strokeWidth = (e.target as any).value;
    const event = new CustomEvent('strokewidthchanged', {
      detail: { strokeWidth },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleStrokeAlignmentChange(e: CustomEvent) {
    const strokeAlignment = (e.target as any).value;
    const event = new CustomEvent('strokealignmentchanged', {
      detail: { strokeAlignment },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleStrokeLinejoinChange(e: CustomEvent) {
    const strokeLinejoin = (e.target as any).value;
    const event = new CustomEvent('strokelinejoinchanged', {
      detail: { strokeLinejoin },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleStrokeDashChange(e: CustomEvent) {
    const strokeDash = (e.target as any).value;
    const event = new CustomEvent('strokedashchanged', {
      detail: { strokeDash },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleStrokeGapChange(e: CustomEvent) {
    const strokeGap = (e.target as any).value;
    const event = new CustomEvent('strokestrokegapchanged', {
      detail: { strokeGap },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private handleStrokeDashOffsetChange(e: CustomEvent) {
    const strokeDashOffset = (e.target as any).value;
    const event = new CustomEvent('strokedashoffsetchanged', {
      detail: { strokeDashOffset },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <div class="stroke-panel-content">
        <sl-radio-group
          name="stroke"
          label="Color"
          value=${this.type}
          @sl-change=${this.handleTypeChange}
        >
          <sl-radio-button size="small" value="solid">Solid</sl-radio-button>
          <sl-radio-button size="small" value="none">None</sl-radio-button>
        </sl-radio-group>
        ${this.type === 'solid'
          ? html` <ic-input-solid
              rgb=${this.stroke}
              opacity=${this.strokeOpacity}
              @colorchanged=${this.handleStrokeChange}
            ></ic-input-solid>`
          : ''}
        <sl-input
          type="number"
          size="small"
          label="Width"
          min="0"
          max="20"
          step="0.5"
          value=${this.strokeWidth}
          @sl-change=${this.handleStrokeWidthChange}
        ></sl-input>
        <sl-select
          placeholder="center"
          size="small"
          label="Alignment"
          hoist
          value=${this.strokeAlignment}
          @sl-change=${this.handleStrokeAlignmentChange}
        >
          <sl-option value="inner">inner</sl-option>
          <sl-option value="center">center</sl-option>
          <sl-option value="outer">outer</sl-option>
        </sl-select>
        <sl-select
          placeholder="miter"
          size="small"
          label="Linejoin"
          hoist
          value=${this.strokeLinejoin}
          @sl-change=${this.handleStrokeLinejoinChange}
        >
          <sl-option value="miter">miter</sl-option>
          <sl-option value="round">round</sl-option>
          <sl-option value="bevel">bevel</sl-option>
        </sl-select>
        <sl-radio-group
          label="Style"
          name="style"
          value=${this.strokeStyle}
          @sl-change=${this.handleStrokeStyleChange}
        >
          <sl-radio-button size="small" value="solid">Solid</sl-radio-button>
          <sl-radio-button size="small" value="dash">Dash</sl-radio-button>
        </sl-radio-group>
        ${this.strokeStyle === 'dash'
          ? html`
              <sl-input
                type="number"
                label="Dash"
                size="small"
                value=${this.strokeDash}
                @sl-change=${this.handleStrokeDashChange}
              ></sl-input>
              <sl-input
                type="number"
                label="Gap"
                size="small"
                value=${this.strokeGap}
                @sl-change=${this.handleStrokeGapChange}
              ></sl-input>
              <sl-input
                type="number"
                label="DashOffset"
                size="small"
                value=${this.strokeDashOffset}
                @sl-change=${this.handleStrokeDashOffsetChange}
              ></sl-input>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-stroke-panel': StrokePanel;
  }
}
