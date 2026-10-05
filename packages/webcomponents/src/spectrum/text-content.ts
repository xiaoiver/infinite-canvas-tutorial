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
import { live } from 'lit/directives/live.js';
import type { DesignVariablePickDetail } from './design-variable-picker';
import './design-variable-picker.js';

type TypographyNumberField = 'fontSize' | 'letterSpacing' | 'lineHeight';

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

    .text-baseline-picker {
      width: 120px;
    }

  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  private async editTypography(
    resolvePatch: (
      node: TextSerializedNode,
      api: ExtendedAPI,
    ) => Partial<TextSerializedNode> | undefined,
  ) {
    const api = this.api;
    const source = this.node;
    if (!api || source?.type !== 'text') return;
    const { id } = source;
    const controller = new AbortController();
    const dispose = api.onDestroy(() => controller.abort());
    try {
      await api.edit(
        (editor) => {
          const current = editor.getNodeById(id);
          if (
            current?.type !== 'text' ||
            current.isDeleted ||
            !editor.getEntity(current)
          ) {
            controller.abort();
            return;
          }
          const patch = resolvePatch(current, editor);
          if (
            !patch ||
            Object.entries(patch).every(
              ([key, value]) =>
                current[key as keyof TextSerializedNode] === value,
            )
          ) {
            // Abort before writing so a no-op cannot capture unrelated history.
            controller.abort();
            return;
          }
          editor.updateNode(current, patch);
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted) console.error(error);
    } finally {
      dispose();
      this.requestUpdate();
    }
  }

  private handleFontFamilyChanged(e: Event) {
    const fontFamily = (e.target as HTMLInputElement).value;
    if (typeof fontFamily !== 'string' || !fontFamily.trim()) {
      this.requestUpdate();
      return;
    }
    return this.editTypography((node) =>
      (node.fontFamily ?? 'sans-serif') === fontFamily
        ? undefined
        : { fontFamily },
    );
  }

  private static numericValue(raw: unknown, field: TypographyNumberField) {
    if (
      (typeof raw !== 'number' && typeof raw !== 'string') ||
      (typeof raw === 'string' && !raw.trim())
    )
      return;
    const value = Number(raw);
    if (Number.isFinite(value) && (field === 'letterSpacing' || value >= 0)) {
      return value;
    }
  }

  private changeNumber(e: Event, field: TypographyNumberField) {
    const value = TextContent.numericValue(
      (e.target as HTMLInputElement).value,
      field,
    );
    if (value === undefined) {
      this.requestUpdate();
      return;
    }
    return this.editTypography((node) =>
      field !== 'fontSize' && (node[field] ?? 0) === value
        ? undefined
        : { [field]: value },
    );
  }

  private bindNumber(
    e: CustomEvent<DesignVariablePickDetail>,
    field: TypographyNumberField,
  ) {
    const key = e.detail?.key;
    if (typeof key !== 'string' || !key) return;
    return this.editTypography((node, api) =>
      api.getAppState().variables?.[key]?.type === 'number'
        ? { [field]: `$${key}` }
        : undefined,
    );
  }

  private unbindNumber(field: TypographyNumberField) {
    return this.editTypography((node, api) => {
      const raw = node[field] as number | string | undefined;
      if (!isDesignVariableReference(raw)) return;
      const { variables, themeMode } = api.getAppState();
      const value = TextContent.numericValue(
        resolveDesignVariableValue(raw, variables, themeMode),
        field,
      );
      if (value !== undefined) return { [field]: value };
    });
  }

  private handleLetterSpacingChanged(e: Event) {
    return this.changeNumber(e, 'letterSpacing');
  }

  private handleLetterSpacingVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    return this.bindNumber(e, 'letterSpacing');
  }

  private handleLetterSpacingUnbind() {
    return this.unbindNumber('letterSpacing');
  }

  private handleLineHeightChanged(e: Event) {
    return this.changeNumber(e, 'lineHeight');
  }

  private handleLineHeightVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    return this.bindNumber(e, 'lineHeight');
  }

  private handleLineHeightUnbind() {
    return this.unbindNumber('lineHeight');
  }

  private handleFontSizeChanged(e: Event) {
    return this.changeNumber(e, 'fontSize');
  }

  private handleFontStyleChanged(e: Event) {
    const selected = (e.target as HTMLElement & { selected?: string[] })
      .selected;
    if (
      !Array.isArray(selected) ||
      selected.some((value) => !['bold', 'italic'].includes(value))
    ) {
      this.requestUpdate();
      return;
    }
    const fontWeight = selected.includes('bold') ? 'bold' : 'normal';
    const fontStyle = selected.includes('italic') ? 'italic' : 'normal';
    return this.editTypography((node) =>
      (node.fontWeight ?? 'normal') === fontWeight &&
      (node.fontStyle ?? 'normal') === fontStyle
        ? undefined
        : { fontWeight, fontStyle },
    );
  }

  private handleFontSizeVariablePick(e: CustomEvent<DesignVariablePickDetail>) {
    return this.bindNumber(e, 'fontSize');
  }

  private handleFontSizeUnbind() {
    return this.unbindNumber('fontSize');
  }

  private changeAlignment(
    field: 'textAlign' | 'textBaseline',
    value: CanvasTextAlign | CanvasTextBaseline,
  ) {
    return this.editTypography((node, api) => {
      const previous =
        field === 'textAlign'
          ? { left: 'start', right: 'end' }[node.textAlign] ??
            node.textAlign ??
            'start'
          : node.textBaseline ?? 'alphabetic';
      if (previous === value) return;
      const { x, y, width, height, ...rest } = node;
      // Measure current typography, including current theme values, without
      // replacing the document's variable references with resolved literals.
      const { variables, themeMode } = api.getAppState();
      for (const key of ['fontSize', 'letterSpacing', 'lineHeight'] as const) {
        if (rest[key] == null) continue;
        const resolved = TextContent.numericValue(
          resolveDesignVariableValue(rest[key], variables, themeMode),
          key,
        );
        if (resolved === undefined) return;
        rest[key] = resolved;
      }
      const inferred = inferXYWidthHeight({
        ...rest,
        anchorX: (node.anchorX ?? 0) + x,
        anchorY: (node.anchorY ?? 0) + y,
        [field]: value,
      } as TextSerializedNode) as TextSerializedNode;
      const geometry = {
        anchorX: inferred.anchorX ?? 0,
        anchorY: inferred.anchorY ?? 0,
        x: inferred.x,
        y: inferred.y,
        width: inferred.width,
        height: inferred.height,
      };
      if (Object.values(geometry).every(Number.isFinite)) {
        return { [field]: value, ...geometry };
      }
    });
  }

  private handleTextAlignChanged(e: Event) {
    const selected = (e.target as HTMLElement & { selected?: string[] })
      .selected;
    const value = selected?.[0];
    if (
      !Array.isArray(selected) ||
      selected.length !== 1 ||
      !['start', 'center', 'end'].includes(value)
    ) {
      this.requestUpdate();
      return;
    }
    return this.changeAlignment('textAlign', value as CanvasTextAlign);
  }

  private handleTextBaselineChanged(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (
      ![
        'top',
        'hanging',
        'middle',
        'alphabetic',
        'ideographic',
        'bottom',
      ].includes(value)
    ) {
      this.requestUpdate();
      return;
    }
    return this.changeAlignment('textBaseline', value as CanvasTextBaseline);
  }

  private textBaselineLabel(value: CanvasTextBaseline): string {
    switch (value) {
      case 'top':
        return msg(str`Top`);
      case 'hanging':
        return msg(str`Hanging`);
      case 'middle':
        return msg(str`Middle`);
      case 'alphabetic':
        return msg(str`Alphabetic`);
      case 'ideographic':
        return msg(str`Ideographic`);
      case 'bottom':
        return msg(str`Bottom`);
      default:
        return value;
    }
  }

  render() {
    const {
      fontSize,
      fontWeight,
      fontFamily,
      fontStyle,
      textAlign = 'start',
      textBaseline = 'alphabetic',
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

    const textBaselineOptions: CanvasTextBaseline[] = [
      'top',
      'hanging',
      'middle',
      'alphabetic',
      'ideographic',
      'bottom',
    ];

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
            .value=${live(fontFamilyResolved)}
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
            .value=${live(fontSizeShow)}
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
            .value=${live(letterSpacingShow)}
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
            .value=${live(lineHeightForInput)}
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
          .selected=${live(this.node &&
      [
        fontWeight === 'bold' ? 'bold' : undefined,
        fontStyle === 'italic' ? 'italic' : undefined,
      ].filter(Boolean))}
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
          .selected=${live([formattedTextAlign])}
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
      </div>
      <div class="line">
        <sp-field-label
          for="ic-text-content-text-baseline"
          side-aligned="start"
          >${msg(str`Text baseline`)}</sp-field-label
        >
        <div class="fill-opacity-controls">
          <sp-picker
            class="text-baseline-picker"
            id="ic-text-content-text-baseline"
            size="s"
            label=${msg(str`Text baseline`)}
            .value=${live(textBaseline)}
            @change=${this.handleTextBaselineChanged}
          >
            ${textBaselineOptions.map(
      (baseline) =>
        html`<sp-menu-item value=${baseline}
          >${this.textBaselineLabel(baseline)}</sp-menu-item
        >`,
    )}
          </sp-picker>
        </div>
      </div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-text-content': TextContent;
  }
}
