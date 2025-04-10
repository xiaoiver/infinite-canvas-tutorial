import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { isGradient } from '@infinite-canvas-tutorial/ecs';

const DEFAULT_COLOR = {
  ['none']: 'none',
  ['solid']: '#000',
  ['gradient']: 'linear-gradient(to right, #000, #fff)',
};

@customElement('ic-spectrum-color-picker')
export class ColorPicker extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      width: 200px;
    }

    h4 {
      margin: 0;
    }
  `;

  @property()
  value: string;

  @property({ type: Boolean })
  solid: boolean = false;

  private handleTypeChanged(e: CustomEvent) {
    const type = (e.target as any).selected[0];
    this.dispatchEvent(
      new CustomEvent('color-change', {
        detail: {
          type,
          value: DEFAULT_COLOR[type],
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const selected =
      this.value === 'none'
        ? 'none'
        : isGradient(this.value)
        ? 'gradient'
        : 'solid';

    return html`
      <h4>Select a color</h4>
      ${when(
        !this.solid,
        () => html`<sp-action-group
          quiet
          compact
          size="m"
          selects="single"
          .selected=${[selected]}
          @change=${this.handleTypeChanged}
        >
          <sp-action-button value="none">
            <sp-tooltip self-managed placement="bottom"> No color </sp-tooltip>
            <sp-swatch nothing slot="icon"> </sp-swatch>
          </sp-action-button>

          <sp-action-button value="solid">
            <sp-tooltip self-managed placement="bottom"> Solid </sp-tooltip>
            <sp-swatch color=${this.value} slot="icon"> </sp-swatch>
          </sp-action-button>

          <sp-action-button value="gradient">
            <sp-tooltip self-managed placement="bottom"> Gradient </sp-tooltip>
            <sp-swatch color=${this.value} slot="icon"> </sp-swatch>
          </sp-action-button>
        </sp-action-group>`,
      )}
      ${when(
        selected === 'solid',
        () => html`
          <ic-spectrum-input-solid
            value=${this.value}
          ></ic-spectrum-input-solid>
        `,
      )}
      ${when(
        selected === 'gradient',
        () => html`<ic-spectrum-input-gradient
          value=${this.value}
        ></ic-spectrum-input-gradient>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-color-picker': ColorPicker;
  }
}
