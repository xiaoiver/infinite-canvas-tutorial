import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  SerializedNode,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

@customElement('ic-spectrum-text-content')
export class TextContent extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      sp-field-label {
        width: 100px;
      }

      sp-number-field {
        width: 80px;
      }

      > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }

    sp-slider {
      flex: 1;
      margin-right: 8px;
    }

    .stroke-width-field {
      position: relative;
      top: 10px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  private handleFontSizeChanged(e: Event & { target: HTMLInputElement }) {
    const fontSize = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      fontSize,
    });
    this.api.record();
  }

  private handleFontStyleChanged(e: Event & { target: HTMLInputElement }) {
    const selected = (e.target as any).selected;
    this.api.updateNode(this.node, {
      fontWeight: selected.includes('bold') ? 'bold' : 'normal',
      fontStyle: selected.includes('italic') ? 'italic' : 'normal',
      // TODO: implement text underline
    });
    this.api.record();
  }

  private handleTextAlignChanged(e: Event & { target: HTMLInputElement }) {
    const selected = (e.target as any).selected;
    this.api.updateNode(this.node, {
      textAlign: selected[0],
    });
    this.api.record();
  }

  render() {
    const {
      fontSize,
      fontWeight,
      fontFamily,
      fontVariant,
      fontStyle,
      textAlign,
      textBaseline,
      // textDecoration,
    } = this.node as TextSerializedNode;

    return html`<div class="line">
        <sp-field-label for="font-size" side-aligned="start"
          >Font size</sp-field-label
        >
        <sp-number-field
          id="font-size"
          value=${fontSize}
          hide-stepper
          autocomplete="off"
          @change=${this.handleFontSizeChanged}
          format-options='{
          "style": "unit",
          "unit": "px"
        }'
        ></sp-number-field>
      </div>
      <div class="line">
        <sp-action-group
          quiet
          size="m"
          selects="multiple"
          .selected=${this.node &&
          [
            fontWeight === 'bold' ? 'bold' : undefined,
            fontStyle === 'italic' ? 'italic' : undefined,
          ].filter(Boolean)}
          @change=${this.handleFontStyleChanged}
        >
          <sp-action-button value="bold">
            <sp-tooltip self-managed placement="bottom"> Bold </sp-tooltip>
            <sp-icon-text-bold slot="icon"></sp-icon-text-bold>
          </sp-action-button>
          <sp-action-button value="italic">
            <sp-tooltip self-managed placement="bottom"> Italic </sp-tooltip>
            <sp-icon-text-italic slot="icon"></sp-icon-text-italic>
          </sp-action-button>
          <!-- <sp-action-button value="underline">
            <sp-tooltip self-managed placement="bottom"> Underline </sp-tooltip>
            <sp-icon-text-underline slot="icon"></sp-icon-text-underline>
          </sp-action-button> -->
        </sp-action-group>

        <sp-action-group
          quiet
          size="m"
          selects="single"
          .selected=${[textAlign]}
          @change=${this.handleTextAlignChanged}
        >
          <sp-action-button value="start">
            <sp-tooltip self-managed placement="bottom">
              Left align
            </sp-tooltip>
            <sp-icon-text-align-left slot="icon"></sp-icon-text-align-left>
          </sp-action-button>
          <sp-action-button value="center">
            <sp-tooltip self-managed placement="bottom">
              Center align
            </sp-tooltip>
            <sp-icon-text-align-center slot="icon"></sp-icon-text-align-center>
          </sp-action-button>
          <sp-action-button value="end">
            <sp-tooltip self-managed placement="bottom">
              Right align
            </sp-tooltip>
            <sp-icon-text-align-right slot="icon"></sp-icon-text-align-right>
          </sp-action-button>
        </sp-action-group>
      </div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-text-content': TextContent;
  }
}
