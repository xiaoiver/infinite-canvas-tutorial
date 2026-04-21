import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  designVariableRefKeyFromWire,
  inferXYWidthHeight,
  isDesignVariableReference,
  resolveDesignVariableValue,
  SerializedNode,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import { when } from 'lit/directives/when.js';
import type { DesignVariablePickDetail } from './design-variable-picker';
import './design-variable-picker.js';

@customElement('ic-spectrum-text-content')
@localized()
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
        width: 70px;
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

    .dv-badge {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-purple-900);
      background: var(--spectrum-purple-100);
      border-radius: 4px;
      padding: 2px 6px;
    }

    .dv-var-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
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

  private handleFontSizeVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    this.api.updateNode(this.node, {
      fontSize: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleFontSizeUnbind() {
    const fs = (this.node as TextSerializedNode).fontSize;
    const resolved = resolveDesignVariableValue(fs, this.appState.variables);
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      this.api.updateNode(this.node, { fontSize: n });
      this.api.record();
    }
  }

  private handleTextAlignChanged(e: Event & { target: HTMLInputElement }) {
    const selected = (e.target as any).selected;

    const newAnchorX = (this.node as TextSerializedNode).anchorX + this.node.x;
    const newAnchorY = (this.node as TextSerializedNode).anchorY + this.node.y;
    const { x, y, width, height, ...rest } = this.node;

    const { x: newX, y: newY, width: newWidth, height: newHeight } =
      inferXYWidthHeight({ ...rest, anchorX: newAnchorX, anchorY: newAnchorY, textAlign: selected[0] } as TextSerializedNode);

    this.api.updateNode(this.node, {
      textAlign: selected[0],
      anchorX: newAnchorX,
      anchorY: newAnchorY,
      x: newX, y: newY, width: newWidth, height: newHeight,
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
      textAlign = 'start',
      textBaseline,
      // textDecoration,
    } = this.node as TextSerializedNode;

    const formattedTextAlign = textAlign === 'left' ? 'start' : textAlign === 'center' ? 'center' : textAlign === 'right' ? 'end' : textAlign;

    const fontSizeResolved = resolveDesignVariableValue(
      fontSize,
      this.appState.variables,
    );
    const fontSizeShow = (() => {
      if (typeof fontSizeResolved === 'number') {
        return fontSizeResolved;
      }
      const n = parseFloat(String(fontSizeResolved ?? ''));
      return Number.isFinite(n) ? n : 0;
    })();
    const fontSizeBound =
      typeof fontSize === 'string' && isDesignVariableReference(fontSize);

    return html`<div class="line">
        <sp-field-label for="font-size" side-aligned="start"
          >${msg(str`Font size`)}</sp-field-label
        >
        <div class="dv-var-block">
          ${when(
      fontSizeBound,
      () =>
        html`<div
                style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"
              >
                <span class="dv-badge">${String(fontSize)}</span>
                <sp-action-button
                  quiet
                  size="s"
                  @click=${this.handleFontSizeUnbind}
                  >${msg(str`解除绑定`)}</sp-action-button
                >
              </div>`,
    )}
          <sp-number-field
            id="font-size"
            value=${fontSizeShow}
            hide-stepper
            autocomplete="off"
            @change=${this.handleFontSizeChanged}
            format-options='{
          "style": "unit",
          "unit": "px"
        }'
          ></sp-number-field>
          <ic-spectrum-design-variable-picker
            match-type="number"
            selected-key=${designVariableRefKeyFromWire(fontSize)}
            label=${msg(str`绑定字号变量`)}
            @ic-variable-pick=${this.handleFontSizeVariablePick}
          ></ic-spectrum-design-variable-picker>
        </div>
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
            <sp-tooltip self-managed placement="bottom"> ${msg(str`Bold`)} </sp-tooltip>
            <sp-icon-text-bold slot="icon"></sp-icon-text-bold>
          </sp-action-button>
          <sp-action-button value="italic">
            <sp-tooltip self-managed placement="bottom"> ${msg(str`Italic`)} </sp-tooltip>
            <sp-icon-text-italic slot="icon"></sp-icon-text-italic>
          </sp-action-button>
          <!-- <sp-action-button value="underline">
            <sp-tooltip self-managed placement="bottom"> ${msg(str`Underline`)} </sp-tooltip>
            <sp-icon-text-underline slot="icon"></sp-icon-text-underline>
          </sp-action-button> -->
        </sp-action-group>

        <sp-action-group
          quiet
          size="m"
          selects="single"
          .selected=${[formattedTextAlign]}
          @change=${this.handleTextAlignChanged}
        >
          <sp-action-button value="start">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Left align`)}
            </sp-tooltip>
            <sp-icon-text-align-left slot="icon"></sp-icon-text-align-left>
          </sp-action-button>
          <sp-action-button value="center">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Center align`)}
            </sp-tooltip>
            <sp-icon-text-align-center slot="icon"></sp-icon-text-align-center>
          </sp-action-button>
          <sp-action-button value="end">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Right align`)}
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
