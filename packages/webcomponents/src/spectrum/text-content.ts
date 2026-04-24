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
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/number-field/sp-number-field.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-link.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-unlink.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
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
      gap: var(--spectrum-global-dimension-size-50);
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      sp-field-label {
        width: 100px;
        flex-shrink: 0;
      }

      sp-number-field {
        width: 70px;
      }
    }

    .fill-opacity-controls {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: flex-end;
      gap: var(--spectrum-global-dimension-size-50);
      min-width: 0;
    }

    .dv-popover-body {
      display: flex;
      flex-direction: column;
      gap: var(--spectrum-global-dimension-size-50);
      padding: 4px;
      box-sizing: border-box;
    }

    .dv-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-50);
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

    .font-family-picker {
      width: 120px;
    }

  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  private handleFontFamilyChanged(e: Event & { target: HTMLInputElement }) {
    const el = e.target as HTMLInputElement & { value?: string };
    const fontFamily = typeof el.value === 'string' ? el.value : '';
    if (!fontFamily) {
      return;
    }
    this.api.updateNode(this.node, { fontFamily });
    this.api.record();
  }

  private handleLetterSpacingChanged(e: Event & { target: HTMLInputElement }) {
    const letterSpacing = parseFloat(e.target.value);
    if (!Number.isFinite(letterSpacing)) {
      return;
    }
    this.api.updateNode(this.node, { letterSpacing });
    this.api.record();
  }

  private handleLetterSpacingVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    this.api.updateNode(this.node, {
      letterSpacing: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleLetterSpacingUnbind() {
    const raw = (this.node as TextSerializedNode).letterSpacing;
    const resolved = resolveDesignVariableValue(
      raw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      this.api.updateNode(this.node, { letterSpacing: n });
      this.api.record();
    }
  }

  private handleLineHeightChanged(e: Event & { target: HTMLInputElement }) {
    const lineHeight = parseFloat(e.target.value);
    if (!Number.isFinite(lineHeight) || lineHeight < 0) {
      return;
    }
    this.api.updateNode(this.node, { lineHeight });
    this.api.record();
  }

  private handleLineHeightVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    this.api.updateNode(this.node, {
      lineHeight: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleLineHeightUnbind() {
    const raw = (this.node as TextSerializedNode).lineHeight;
    const resolved = resolveDesignVariableValue(
      raw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n) && n >= 0) {
      this.api.updateNode(this.node, { lineHeight: n });
      this.api.record();
    }
  }

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
    const resolved = resolveDesignVariableValue(
      fs,
      this.appState.variables,
      this.appState.themeMode,
    );
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

    const baseFamilies =
      this.appState.penbarText?.fontFamilies?.length ?
        [...this.appState.penbarText.fontFamilies] :
        ['system-ui', 'serif', 'monospace'];
    const fontFamilyResolved = fontFamily ?? 'sans-serif';
    const fontFamilyOptions =
      baseFamilies.includes(fontFamilyResolved) ?
        baseFamilies :
        [fontFamilyResolved, ...baseFamilies];

    const formattedTextAlign = textAlign === 'left' ? 'start' : textAlign === 'center' ? 'center' : textAlign === 'right' ? 'end' : textAlign;

    const fontSizeResolved = resolveDesignVariableValue(
      fontSize,
      this.appState.variables,
      this.appState.themeMode,
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

    const letterSpacingRaw = (this.node as TextSerializedNode).letterSpacing;
    const letterSpacingResolved = resolveDesignVariableValue(
      letterSpacingRaw ?? 0,
      this.appState.variables,
      this.appState.themeMode,
    );
    const letterSpacingShow = (() => {
      if (typeof letterSpacingResolved === 'number') {
        return letterSpacingResolved;
      }
      const n = parseFloat(String(letterSpacingResolved ?? ''));
      return Number.isFinite(n) ? n : 0;
    })();
    const letterSpacingBound =
      typeof letterSpacingRaw === 'string' &&
      isDesignVariableReference(letterSpacingRaw);

    const lineHeightRaw = (this.node as TextSerializedNode).lineHeight;
    const lineHeightResolved = resolveDesignVariableValue(
      lineHeightRaw ?? 0,
      this.appState.variables,
      this.appState.themeMode,
    );
    const lineHeightNumeric = (() => {
      if (typeof lineHeightResolved === 'number') {
        return lineHeightResolved;
      }
      const n = parseFloat(String(lineHeightResolved ?? ''));
      return Number.isFinite(n) ? n : 0;
    })();
    const lineHeightBound =
      typeof lineHeightRaw === 'string' &&
      isDesignVariableReference(lineHeightRaw);
    const lineHeightForInput =
      lineHeightBound || (typeof lineHeightRaw === 'number' && lineHeightRaw > 0) ?
        lineHeightNumeric
        : (fontSizeShow > 0 ? fontSizeShow : 16);

    return html`<div class="line">
        <sp-field-label
          for="ic-text-content-font-family"
          side-aligned="start"
          >${msg(str`Font family`)}</sp-field-label
        >
        <div class="fill-opacity-controls">
          <sp-picker
            class="font-family-picker"
            id="ic-text-content-font-family"
            size="s"
            .value=${fontFamilyResolved}
            @change=${this.handleFontFamilyChanged}
          >
            ${fontFamilyOptions.map(
      (ff) =>
        html`<sp-menu-item
                value=${ff}
                style=${`font-family: ${ff};`}
                >${ff}</sp-menu-item
              >`,
    )}
          </sp-picker>
        </div>
      </div>
      <div class="line">
        <sp-field-label for="font-size" side-aligned="start"
          >${msg(str`Font size`)}</sp-field-label
        >
        <div class="fill-opacity-controls">
          <sp-action-button
            quiet
            size="s"
            id="ic-text-content-font-size-dv-trigger"
          >
            <sp-icon-link slot="icon"></sp-icon-link>
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Attach a variable`)}
            </sp-tooltip>
          </sp-action-button>
          <sp-number-field
            id="font-size"
            size="s"
            value=${fontSizeShow}
            hide-stepper
            autocomplete="off"
            @change=${this.handleFontSizeChanged}
            format-options='{
          "style": "unit",
          "unit": "px"
        }'
          ></sp-number-field>
          <sp-overlay
            trigger="ic-text-content-font-size-dv-trigger@click"
            placement="bottom"
            type="auto"
          >
            <sp-popover dialog>
              <div class="dv-popover-body">
                ${when(
      fontSizeBound,
      () =>
        html`<div class="dv-row">
                    <span class="dv-badge" title=${String(fontSize)}
                      >${String(fontSize)}</span
                    >
                    <sp-action-button
                      quiet
                      size="s"
                      @click=${this.handleFontSizeUnbind}
                    >
                      <sp-icon-unlink slot="icon"></sp-icon-unlink>
                      <sp-tooltip self-managed placement="right">
                        ${msg(str`Detach variable`)}
                      </sp-tooltip>
                    </sp-action-button>
                  </div>`,
    )}
                <ic-spectrum-design-variable-picker
                  match-type="number"
                  selected-key=${designVariableRefKeyFromWire(fontSize)}
                  @ic-variable-pick=${this.handleFontSizeVariablePick}
                ></ic-spectrum-design-variable-picker>
              </div>
            </sp-popover>
          </sp-overlay>
        </div>
      </div>
      <div class="line">
        <sp-field-label
          for="ic-text-content-letter-spacing"
          side-aligned="start"
          >${msg(str`Letter spacing`)}</sp-field-label
        >
        <div class="fill-opacity-controls">
          <sp-action-button
            quiet
            size="s"
            id="ic-text-content-letter-spacing-dv-trigger"
          >
            <sp-icon-link slot="icon"></sp-icon-link>
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Attach a variable`)}
            </sp-tooltip>
          </sp-action-button>
          <sp-number-field
            id="ic-text-content-letter-spacing"
            size="s"
            .value=${letterSpacingShow}
            min="-50"
            max="200"
            step="0.5"
            hide-stepper
            autocomplete="off"
            @change=${this.handleLetterSpacingChanged}
            format-options='{
          "style": "unit",
          "unit": "px"
        }'
          ></sp-number-field>
          <sp-overlay
            trigger="ic-text-content-letter-spacing-dv-trigger@click"
            placement="bottom"
            type="auto"
          >
            <sp-popover dialog>
              <div class="dv-popover-body">
                ${when(
      letterSpacingBound,
      () =>
        html`<div class="dv-row">
                    <span
                      class="dv-badge"
                      title=${String(letterSpacingRaw)}
                      >${String(letterSpacingRaw)}</span
                    >
                    <sp-action-button
                      quiet
                      size="s"
                      @click=${this.handleLetterSpacingUnbind}
                    >
                      <sp-icon-unlink slot="icon"></sp-icon-unlink>
                      <sp-tooltip self-managed placement="right">
                        ${msg(str`Detach variable`)}
                      </sp-tooltip>
                    </sp-action-button>
                  </div>`,
    )}
                <ic-spectrum-design-variable-picker
                  match-type="number"
                  selected-key=${designVariableRefKeyFromWire(letterSpacingRaw)}
                  @ic-variable-pick=${this.handleLetterSpacingVariablePick}
                ></ic-spectrum-design-variable-picker>
              </div>
            </sp-popover>
          </sp-overlay>
        </div>
      </div>
      <div class="line">
        <sp-field-label
          for="ic-text-content-line-height"
          side-aligned="start"
          >${msg(str`Line height`)}</sp-field-label
        >
        <div class="fill-opacity-controls">
          <sp-action-button
            quiet
            size="s"
            id="ic-text-content-line-height-dv-trigger"
          >
            <sp-icon-link slot="icon"></sp-icon-link>
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Attach a variable`)}
            </sp-tooltip>
          </sp-action-button>
          <sp-number-field
            id="ic-text-content-line-height"
            size="s"
            .value=${lineHeightForInput}
            min="0"
            max="400"
            step="0.5"
            hide-stepper
            autocomplete="off"
            @change=${this.handleLineHeightChanged}
            format-options='{
          "style": "unit",
          "unit": "px"
        }'
          ></sp-number-field>
          <sp-overlay
            trigger="ic-text-content-line-height-dv-trigger@click"
            placement="bottom"
            type="auto"
          >
            <sp-popover dialog>
              <div class="dv-popover-body">
                ${when(
      lineHeightBound,
      () =>
        html`<div class="dv-row">
                    <span
                      class="dv-badge"
                      title=${String(lineHeightRaw)}
                      >${String(lineHeightRaw)}</span
                    >
                    <sp-action-button
                      quiet
                      size="s"
                      @click=${this.handleLineHeightUnbind}
                    >
                      <sp-icon-unlink slot="icon"></sp-icon-unlink>
                      <sp-tooltip self-managed placement="right">
                        ${msg(str`Detach variable`)}
                      </sp-tooltip>
                    </sp-action-button>
                  </div>`,
    )}
                <ic-spectrum-design-variable-picker
                  match-type="number"
                  selected-key=${designVariableRefKeyFromWire(lineHeightRaw)}
                  @ic-variable-pick=${this.handleLineHeightVariablePick}
                ></ic-spectrum-design-variable-picker>
              </div>
            </sp-popover>
          </sp-overlay>
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
          <sp-action-button value="bold" size="s">
            <sp-tooltip self-managed placement="bottom"> ${msg(str`Bold`)} </sp-tooltip>
            <sp-icon-text-bold slot="icon"></sp-icon-text-bold>
          </sp-action-button>
          <sp-action-button value="italic" size="s">
            <sp-tooltip self-managed placement="bottom"> ${msg(str`Italic`)} </sp-tooltip>
            <sp-icon-text-italic slot="icon"></sp-icon-text-italic>
          </sp-action-button>
          <!-- <sp-action-button value="underline" size="s">
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
          <sp-action-button value="start" size="s">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Left align`)}
            </sp-tooltip>
            <sp-icon-text-align-left slot="icon"></sp-icon-text-align-left>
          </sp-action-button>
          <sp-action-button value="center" size="s">
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Center align`)}
            </sp-tooltip>
            <sp-icon-text-align-center slot="icon"></sp-icon-text-align-center>
          </sp-action-button>
          <sp-action-button value="end" size="s">
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
