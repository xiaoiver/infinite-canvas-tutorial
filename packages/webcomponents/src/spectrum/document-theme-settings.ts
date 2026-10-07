import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { live } from 'lit/directives/live.js';
import * as d3 from 'd3-color';
import {
  AppState,
  ThemeMode,
  parseColor,
  getDesignVariableLightDarkValues,
  type DesignVariable,
  type DesignVariableType,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import {
  editDesignVariable,
  type DesignVariableCommand,
} from './design-variable-command';
import './input-solid';

import '@spectrum-web-components/accordion/sp-accordion.js';
import '@spectrum-web-components/accordion/sp-accordion-item.js';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import '@spectrum-web-components/number-field/sp-number-field.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-code.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-color-palette.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-text.js';

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

    sp-accordion {
      --mod-accordion-item-header-font-size: 13px;
    }

    .color-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--spectrum-global-dimension-size-100);
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

    .var-table {
      display: flex;
      flex-direction: column;
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .var-table-h {
      display: grid;
      grid-template-columns: minmax(200px, 2.2fr) minmax(80px, 1fr) minmax(80px, 1fr) 32px;
      align-items: center;
      gap: 4px;
      border-bottom: 1px solid var(--spectrum-gray-300);
      font-size: 12px;
      font-weight: 600;
      color: var(--spectrum-gray-800);
    }

    .var-th-center {
      text-align: center;
    }

    .var-table-row {
      display: grid;
      grid-template-columns: minmax(200px, 2.2fr) minmax(80px, 1fr) minmax(80px, 1fr) 32px;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
    }

    .var-name-block {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .var-type-icon {
      flex: 0 0 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--spectrum-gray-700);
    }

    .var-type-icon sp-icon-color-palette,
    .var-type-icon sp-icon-text,
    .var-type-icon sp-icon-code {
      --mod-icon-size: 18px;
    }

    .var-type-picker {
      flex: 0 0 76px;
      min-width: 0;
    }

    .var-name-block sp-textfield {
      min-width: 0;
      flex: 1 1 auto;
    }

    .var-cell {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .var-cell--color {
      justify-content: center;
    }

    .var-cell .color-trigger {
      max-width: 100%;
    }

    .var-cell sp-number-field {
      width: 48px;
    }

    .var-cell sp-textfield {
      width: 100%;
    }

    .add-row {
      display: grid;
      grid-template-columns: minmax(200px, 2.2fr) minmax(80px, 1fr) minmax(80px, 1fr) 32px;
      align-items: end;
      gap: 8px;
    }

    .add-row .draft-name-type {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 6px;
      min-width: 0;
    }

    .add-row .draft-name-type sp-textfield {
      flex: 1 1 100px;
      min-width: 0;
    }

    .add-row .draft-value-merge {
      grid-column: 2 / 4;
    }

    .add-row .draft-value-merge sp-textfield {
      width: 100%;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @state()
  private draftVarKey = '';

  @state()
  private draftVarType: DesignVariableType = 'color';

  @state()
  private draftVarValue = '';

  @state()
  private addingVariable = false;

  private async commitVariable(
    command: DesignVariableCommand,
    target?: DesignVariable,
  ) {
    const { api } = this;
    if (!this.isConnected || !api) return false;
    const committed = await editDesignVariable(api, command, target);
    if (this.isConnected && this.api === api) {
      this.appState = api.getAppState();
      this.requestUpdate();
    }
    return committed;
  }

  private handleVariableKeyCommit(def: DesignVariable, e: Event) {
    const host = e.target as HTMLElement & { value: string };
    return this.commitVariable({ kind: 'rename', key: host.value }, def);
  }

  private focusDraftKeyField() {
    this.updateComplete.then(() => {
      const el = this.renderRoot?.querySelector(
        '#dv-draft-key',
      ) as HTMLInputElement | null;
      el?.focus();
    });
  }

  private handleVariableSolidChange(
    def: DesignVariable,
    mode: ThemeMode,
    e: CustomEvent<{ type: string; value: string }>,
  ) {
    if (e.detail.type !== 'solid') return;
    return this.commitVariable(
      { kind: 'value', type: 'color', mode, value: e.detail.value },
      def,
    );
  }

  private handleVariableValueInput(
    def: DesignVariable,
    mode: ThemeMode,
    e: Event & { target: HTMLInputElement },
  ) {
    return this.commitVariable(
      { kind: 'value', type: def.type, mode, value: e.target.value },
      def,
    );
  }

  private async addVariable() {
    if (this.addingVariable || !this.isConnected || !this.api) return;
    const {
      api,
      draftVarKey: key,
      draftVarType: type,
      draftVarValue: value,
    } = this;
    this.addingVariable = true;
    try {
      const committed = await this.commitVariable({
        kind: 'add',
        key,
        type,
        value,
      });
      // A pending submission must not clear a newer draft or another canvas.
      if (
        committed &&
        this.isConnected &&
        this.api === api &&
        this.draftVarKey === key &&
        this.draftVarType === type &&
        this.draftVarValue === value
      ) {
        this.draftVarKey = '';
        this.draftVarValue = '';
        this.draftVarType = 'color';
      }
    } finally {
      this.addingVariable = false;
    }
  }

  private varKeySlug(key: string) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private variableTypeIcon(t: DesignVariableType) {
    if (t === 'color') {
      return html`<span
        class="var-type-icon"
        title=${msg(str`color`)}
        aria-label=${msg(str`color variable`)}
      >
        <sp-icon-color-palette></sp-icon-color-palette>
      </span>`;
    }
    if (t === 'string') {
      return html`<span
        class="var-type-icon"
        title=${msg(str`string`)}
        aria-label=${msg(str`string variable`)}
      >
        <sp-icon-text></sp-icon-text>
      </span>`;
    }
    return html`<span
      class="var-type-icon"
      title=${msg(str`number`)}
      aria-label=${msg(str`number variable`)}
    >
      <sp-icon-code></sp-icon-code>
    </span>`;
  }

  private variableTypePicker(
    key: string | 'draft',
    current: DesignVariableType,
    onPick: (t: DesignVariableType) => void,
  ) {
    const id =
      key === 'draft' ? 'dv-draft-type' : `dv-type-${this.varKeySlug(key)}`;
    return html`
      <sp-picker
        class="var-type-picker"
        id=${id}
        size="s"
        label=${msg(str`Type`)}
        .value=${live(current)}
        @change=${(e: Event & { target: { value: string } }) => {
          if (['color', 'number', 'string'].includes(e.target.value)) {
            onPick(e.target.value as DesignVariableType);
          } else {
            this.requestUpdate();
          }
        }}
      >
        <sp-menu-item value="color">${msg(str`color`)}</sp-menu-item>
        <sp-menu-item value="number">${msg(str`number`)}</sp-menu-item>
        <sp-menu-item value="string">${msg(str`string`)}</sp-menu-item>
      </sp-picker>
    `;
  }

  private variableCellForMode(
    key: string,
    def: DesignVariable,
    mode: ThemeMode,
  ) {
    const { light, dark } = getDesignVariableLightDarkValues(def);
    if (def.type === 'color') {
      const raw = String(mode === ThemeMode.LIGHT ? light : dark);
      const hex = solidHexForPicker(typeof raw === 'string' ? raw : '#808080');
      const slug = this.varKeySlug(key);
      const triggerId = `var-solid-${slug}-${
        mode === ThemeMode.LIGHT ? 'L' : 'D'
      }`;
      return html`<div
        class="var-cell var-cell--color"
        title=${msg(str`value`)}
      >
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
                .value=${live(hex)}
                @color-change=${(
                  e: CustomEvent<{ type: string; value: string }>,
                ) => this.handleVariableSolidChange(def, mode, e)}
              ></ic-spectrum-input-solid>
            </div>
          </sp-popover>
        </sp-overlay>
      </div>`;
    }
    if (def.type === 'number') {
      const v = mode === ThemeMode.LIGHT ? light : dark;
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0;
      return html`<div class="var-cell">
        <sp-number-field
          size="s"
          .value=${live(n)}
          hide-stepper
          @change=${(e: Event & { target: HTMLInputElement }) =>
            this.handleVariableValueInput(def, mode, e)}
        ></sp-number-field>
      </div>`;
    }
    const s = String(mode === ThemeMode.LIGHT ? light : dark);
    return html`<div class="var-cell">
      <sp-textfield
        size="s"
        .value=${live(s)}
        @change=${(e: Event & { target: HTMLInputElement }) =>
          this.handleVariableValueInput(def, mode, e)}
      ></sp-textfield>
    </div>`;
  }

  private variableTableRow(key: string, def: DesignVariable) {
    return html`
      <div class="var-table-row" data-variable-key=${key}>
        <div class="var-name-block">
          ${this.variableTypeIcon(def.type)}
          <sp-textfield
            size="s"
            .value=${live(key)}
            title=${msg(
              str`Variable name; use $ in nodes, e.g. $color.background`,
            )}
            placeholder=${msg(str`name`)}
            @change=${(e: Event & { target: HTMLElement }) =>
              this.handleVariableKeyCommit(def, e)}
          ></sp-textfield>
        </div>
        ${this.variableCellForMode(key, def, ThemeMode.LIGHT)}
        ${this.variableCellForMode(key, def, ThemeMode.DARK)}
        <sp-action-button
          quiet
          size="s"
          @click=${() => this.commitVariable({ kind: 'remove' }, def)}
          label=${msg(str`Remove variable`)}
        >
          <sp-icon-delete slot="icon"></sp-icon-delete>
        </sp-action-button>
      </div>
    `;
  }

  private variablesSection() {
    const entries = Object.entries(this.appState.variables ?? {}).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return html`<sp-accordion-item label=${msg(str`Variables`)} ?open=${true}>
      <div class="var-table">
        <div class="var-table-h" aria-hidden="true">
          <span>${msg(str`Name`)}</span>
          <span class="var-th-center">${msg(str`Light`)}</span>
          <span class="var-th-center">${msg(str`Dark`)}</span>
          <sp-action-button
            quiet
            size="s"
            @click=${() => this.focusDraftKeyField()}
            title=${msg(str`Add variable`)}
            label=${msg(str`Add variable`)}
            >+</sp-action-button
          >
        </div>
        ${entries.map(([k, def]) => this.variableTableRow(k, def))}
        <div class="add-block">
          <sp-field-label for="dv-draft-key" side-aligned="start"
            >${msg(str`Add variable`)}</sp-field-label
          >
          <div class="add-row">
            <div class="draft-name-type">
              <sp-textfield
                id="dv-draft-key"
                size="s"
                placeholder=${msg(str`e.g. --primary`)}
                .value=${live(this.draftVarKey)}
                @input=${(e: Event & { target: HTMLInputElement }) => {
                  this.draftVarKey = e.target.value;
                }}
              ></sp-textfield>
              ${this.variableTypePicker('draft', this.draftVarType, (t) => {
                this.draftVarType = t;
                this.draftVarValue =
                  t === 'color' ? '#808080' : t === 'number' ? '0' : '';
              })}
            </div>
            <div class="draft-value-merge">
              <sp-textfield
                size="s"
                placeholder=${msg(str`Default for Light & Dark`)}
                .value=${live(this.draftVarValue)}
                @input=${(e: Event & { target: HTMLInputElement }) => {
                  this.draftVarValue = e.target.value;
                }}
              ></sp-textfield>
            </div>
            <sp-action-button
              size="s"
              @click=${() => this.addVariable()}
              ?disabled=${this.addingVariable ||
              !this.draftVarKey.trim() ||
              Object.prototype.hasOwnProperty.call(
                this.appState.variables,
                this.draftVarKey.trim(),
              )}
            >
              ${msg(str`Add`)}
            </sp-action-button>
          </div>
        </div>
      </div>
    </sp-accordion-item>`;
  }

  render() {
    return html`
      <sp-accordion size="s" allow-multiple>
        ${this.variablesSection()}
        <slot name="extra-accordion-items"></slot>
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
