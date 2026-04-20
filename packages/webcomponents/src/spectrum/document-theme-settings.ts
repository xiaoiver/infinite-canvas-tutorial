import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import * as d3 from 'd3-color';
import { AppState, ThemeMode, API, parseColor } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { localized, msg, str } from '@lit/localize';
import { normalizeSolidCssValue } from './normalize-solid-css';
import './input-solid';

import '@spectrum-web-components/accordion/sp-accordion.js';
import '@spectrum-web-components/accordion/sp-accordion-item.js';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';

type ThemeColorField =
  | 'background'
  | 'grid'
  | 'selectionBrushFill'
  | 'selectionBrushStroke';

function solidHexForPicker(raw: string): string {
  const p = parseColor(raw.trim() || '#808080');
  return d3.rgb(p.r, p.g, p.b, 1).formatHex();
}

@customElement('ic-spectrum-document-theme-settings')
@localized()
export class DocumentThemeSettings extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 0;
    }

    sp-popover {
      padding: 0;
    }

    .intro {
      margin: 0 0 var(--spectrum-global-dimension-size-100) 0;
      color: var(--spectrum-gray-800);
      font-size: var(--spectrum-font-size-75);
      line-height: 1.45;
    }

    sp-accordion {
      --mod-accordion-item-header-font-size: 13px;
    }

    .color-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--spectrum-global-dimension-size-100);
      margin-bottom: var(--spectrum-global-dimension-size-75);
    }

    .color-row:last-child {
      margin-bottom: 0;
    }

    sp-field-label {
      flex: 0 0 120px;
    }

    .color-trigger {
      flex: 0 0 auto;
    }

    .swatch {
      display: block;
      width: 28px;
      height: 22px;
      border-radius: var(--spectrum-corner-radius-100);
      border: 1px solid var(--spectrum-gray-400);
      box-sizing: border-box;
    }

    .solid-popover-body {
      padding: var(--spectrum-global-dimension-size-100);
      box-sizing: border-box;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: API;

  private patchColor(mode: ThemeMode, key: ThemeColorField, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const prev = this.appState.theme.colors[mode] ?? {};
    this.api.setAppState({
      theme: {
        mode: this.appState.themeMode,
        colors: {
          [mode]: {
            ...prev,
            [key]: trimmed,
          },
        },
      },
    });
  }

  private handleInputSolidColorChange(
    mode: ThemeMode,
    key: ThemeColorField,
    e: CustomEvent<{ type: string; value: string }>,
  ) {
    const { type, value } = e.detail;
    if (type !== 'solid' || !value?.trim()) {
      return;
    }
    this.patchColor(mode, key, normalizeSolidCssValue(value));
  }

  private colorRow(
    mode: ThemeMode,
    key: ThemeColorField,
    label: unknown,
    value: string,
  ) {
    const v = value ?? '';
    const hex = solidHexForPicker(v);
    const triggerId = `theme-solid-${mode}-${key}`;
    return html`<div class="color-row">
      <sp-field-label side-aligned="start" for=${triggerId}>${label}</sp-field-label>
      <sp-action-button class="color-trigger" quiet size="s" id=${triggerId}>
        <span
          class="swatch"
          style=${`background-color: ${hex}`}
          slot="icon"
        ></span>
      </sp-action-button>
      <sp-overlay trigger="${triggerId}@click" placement="bottom" type="auto">
        <sp-popover dialog>
          <div class="solid-popover-body">
            <ic-spectrum-input-solid
              .value=${hex}
              @color-change=${(e: CustomEvent<{ type: string; value: string }>) =>
        this.handleInputSolidColorChange(mode, key, e)}
            ></ic-spectrum-input-solid>
          </div>
        </sp-popover>
      </sp-overlay>
    </div>`;
  }

  private modeSection(mode: ThemeMode, title: unknown) {
    const c = this.appState.theme.colors[mode];
    return html`<sp-accordion-item label=${title} ?open=${mode === this.appState.themeMode}>
      ${this.colorRow(
      mode,
      'background',
      msg(str`Canvas background`),
      c?.background ?? '',
    )}
      ${this.colorRow(mode, 'grid', msg(str`Grid`), c?.grid ?? '')}
      ${this.colorRow(
      mode,
      'selectionBrushFill',
      msg(str`Selection fill`),
      c?.selectionBrushFill ?? '',
    )}
      ${this.colorRow(
      mode,
      'selectionBrushStroke',
      msg(str`Selection stroke`),
      c?.selectionBrushStroke ?? '',
    )}
    </sp-accordion-item>`;
  }

  render() {
    return html`
      <sp-accordion size="s" allow-multiple>
        ${this.modeSection(ThemeMode.LIGHT, msg(str`Light`))}
        ${this.modeSection(ThemeMode.DARK, msg(str`Dark`))}
      </sp-accordion>
      <slot name="document-settings"></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-document-theme-settings': DocumentThemeSettings;
  }
}
