import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import * as d3 from 'd3-color';
import {
  AppState,
  ThemeMode,
  parseColor,
  type DesignVariable,
  type DesignVariableType,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import { normalizeSolidCssValue } from './normalize-solid-css';
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
import '@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js';

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

    .var-row {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
      padding: 2px 0;
    }

    .var-key {
      flex: 1 1 auto;
      min-width: 72px;
      max-width: min(52%, 280px);
    }

    .var-key sp-textfield {
      width: 100%;
    }

    .var-type-picker {
      flex: 0 0 100px;
      min-width: 0;
    }

    .var-row-trailing {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 4px;
      margin-left: auto;
      min-width: 0;
    }

    .var-value {
    }

    .var-value sp-textfield {
      width: 120px;
    }
    .var-value sp-number-field {
      width: 60px;
    }

    .add-block {
      margin-top: var(--spectrum-global-dimension-size-100);
      padding-top: var(--spectrum-global-dimension-size-100);
      border-top: 1px solid var(--spectrum-gray-300);
    }

    .add-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 8px;
    }

    .add-row sp-textfield {
      flex: 1 1 120px;
      min-width: 0;
    }

    .add-row sp-picker {
      flex: 0 0 100px;
    }

    .add-row .draft-value {
      flex: 1 1 100px;
      min-width: 0;
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

  private patchVariable(key: string, def: DesignVariable) {
    this.api.setAppState({
      variables: {
        [key]: def,
      },
    });
  }

  private removeVariable(key: string) {
    const next = { ...this.appState.variables };
    delete next[key];
    this.api.setAppState({ variables: next }, { replaceVariables: true });
  }

  /** 行内重命名：`change` 时提交；空名或与已有键重名则恢复为原键 */
  private handleVariableKeyCommit(oldKey: string, e: Event) {
    const host = e.target as HTMLElement & { value?: string };
    const raw =
      typeof host.value === 'string'
        ? host.value
        : (
          host.shadowRoot?.querySelector(
            'input',
          ) as HTMLInputElement | null
        )?.value ?? '';
    const next = raw.trim();
    if (!next) {
      this.revertVariableKeyField(host, oldKey);
      return;
    }
    if (next === oldKey) {
      return;
    }
    if (this.appState.variables[next]) {
      this.revertVariableKeyField(host, oldKey);
      return;
    }
    const def = this.appState.variables[oldKey];
    if (!def) {
      return;
    }
    const map = { ...this.appState.variables };
    delete map[oldKey];
    map[next] = def;
    this.api.setAppState({ variables: map }, { replaceVariables: true });
  }

  private revertVariableKeyField(host: HTMLElement, oldKey: string) {
    const h = host as { value?: string };
    if (typeof h.value === 'string' || 'value' in h) {
      h.value = oldKey;
    }
    const input = host.shadowRoot?.querySelector(
      'input',
    ) as HTMLInputElement | null;
    if (input) {
      input.value = oldKey;
    }
  }

  private handleVariableTypeChange(key: string, newType: DesignVariableType) {
    const prev = this.appState.variables[key];
    if (!prev) {
      return;
    }
    let value: string | number = prev.value;
    if (newType === 'color') {
      value =
        typeof value === 'string'
          ? normalizeSolidCssValue(value || '#808080')
          : '#808080';
    } else if (newType === 'number') {
      const n =
        typeof value === 'number' ? value : parseFloat(String(value ?? ''));
      value = Number.isFinite(n) ? n : 0;
    } else {
      value = String(value ?? '');
    }
    this.patchVariable(key, { type: newType, value });
  }

  private handleVariableSolidChange(
    key: string,
    e: CustomEvent<{ type: string; value: string }>,
  ) {
    const { type, value } = e.detail;
    if (type !== 'solid' || !value?.trim()) {
      return;
    }
    const prev = this.appState.variables[key];
    if (!prev || prev.type !== 'color') {
      return;
    }
    this.patchVariable(key, {
      type: 'color',
      value: normalizeSolidCssValue(value),
    });
  }

  private handleVariableNumberInput(key: string, e: Event & { target: HTMLInputElement }) {
    const n = parseFloat(e.target.value);
    if (!Number.isFinite(n)) {
      return;
    }
    const prev = this.appState.variables[key];
    if (!prev) {
      return;
    }
    this.patchVariable(key, { ...prev, type: 'number', value: n });
  }

  private handleVariableStringInput(key: string, e: Event & { target: HTMLInputElement }) {
    const prev = this.appState.variables[key];
    if (!prev) {
      return;
    }
    this.patchVariable(key, { ...prev, type: 'string', value: e.target.value });
  }

  private addVariable() {
    const key = this.draftVarKey.trim();
    if (!key || this.appState.variables[key]) {
      return;
    }
    let value: string | number;
    if (this.draftVarType === 'color') {
      value = normalizeSolidCssValue(this.draftVarValue.trim() || '#808080');
    } else if (this.draftVarType === 'number') {
      const n = parseFloat(this.draftVarValue);
      if (!Number.isFinite(n)) {
        return;
      }
      value = n;
    } else {
      value = this.draftVarValue;
    }
    this.patchVariable(key, { type: this.draftVarType, value });
    this.draftVarKey = '';
    this.draftVarValue = '';
    this.draftVarType = 'color';
  }

  private variableTypePicker(
    key: string | 'draft',
    current: DesignVariableType,
    onPick: (t: DesignVariableType) => void,
  ) {
    const id = key === 'draft' ? 'dv-draft-type' : `dv-type-${key}`;
    return html`
      <sp-picker
        class="var-type-picker"
        id=${id}
        size="s"
        label=${msg(str`Type`)}
        value=${current}
        @change=${(e: Event & { target: { value: string } }) => {
        onPick(e.target.value as DesignVariableType);
      }}
      >
        <sp-menu-item value="color">${msg(str`color`)}</sp-menu-item>
        <sp-menu-item value="number">${msg(str`number`)}</sp-menu-item>
        <sp-menu-item value="string">${msg(str`string`)}</sp-menu-item>
      </sp-picker>
    `;
  }

  private variableValueEditor(key: string, def: DesignVariable) {
    if (def.type === 'color') {
      const raw = typeof def.value === 'string' ? def.value : '#808080';
      const hex = solidHexForPicker(raw);
      const triggerId = `var-solid-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      return html`<div class="var-value">
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
          this.handleVariableSolidChange(key, e)}
              ></ic-spectrum-input-solid>
            </div>
          </sp-popover>
        </sp-overlay>
      </div>`;
    }
    if (def.type === 'number') {
      const n =
        typeof def.value === 'number'
          ? def.value
          : parseFloat(String(def.value ?? '')) || 0;
      return html`<div class="var-value">
        <sp-number-field
          size="s"
          value=${n}
          hide-stepper
          @change=${(e: Event & { target: HTMLInputElement }) =>
          this.handleVariableNumberInput(key, e)}
        ></sp-number-field>
      </div>`;
    }
    return html`<div class="var-value">
      <sp-textfield
        size="s"
        value=${String(def.value ?? '')}
        @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handleVariableStringInput(key, e)}
      ></sp-textfield>
    </div>`;
  }

  private variableRow(key: string, def: DesignVariable) {
    return html`<div class="var-row">
      <div class="var-key">
        <sp-textfield
          size="s"
          value=${key}
          title=${msg(str`变量名；节点中用 $ 引用，例如 $color.background`)}
          placeholder=${msg(str`name`)}
          @change=${(e: Event & { target: HTMLElement }) =>
        this.handleVariableKeyCommit(key, e)}
        ></sp-textfield>
      </div>
      <div class="var-row-trailing">
        ${this.variableValueEditor(key, def)}
        <sp-action-button
          quiet
          size="s"
          @click=${() => this.removeVariable(key)}
          label=${msg(str`Remove variable`)}
        >
          <sp-icon-delete slot="icon"></sp-icon-delete>
        </sp-action-button>
      </div>
    </div>`;
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

  private variablesSection() {
    const entries = Object.entries(this.appState.variables ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return html`<sp-accordion-item label=${msg(str`Variables`)} ?open=${true}>
      ${entries.map(([k, def]) => this.variableRow(k, def))}
      <div class="add-block">
        <sp-field-label for="dv-draft-key" side-aligned="start"
          >${msg(str`Add variable`)}</sp-field-label
        >
        <div class="add-row">
          <sp-textfield
            id="dv-draft-key"
            size="s"
            placeholder=${msg(str`e.g. color.background`)}
            value=${this.draftVarKey}
            @input=${(e: Event & { target: HTMLInputElement }) => {
        this.draftVarKey = e.target.value;
      }}
          ></sp-textfield>
          ${this.variableTypePicker('draft', this.draftVarType, (t) => {
        this.draftVarType = t;
        this.draftVarValue =
          t === 'color'
            ? '#808080'
            : t === 'number'
              ? '0'
              : '';
      })}
          <sp-textfield
            class="draft-value"
            size="s"
            placeholder=${msg(str`Value`)}
            value=${this.draftVarValue}
            @input=${(e: Event & { target: HTMLInputElement }) => {
        this.draftVarValue = e.target.value;
      }}
          ></sp-textfield>
          <sp-action-button
            size="s"
            @click=${() => this.addVariable()}
            ?disabled=${!this.draftVarKey.trim() ||
      !!this.appState.variables[this.draftVarKey.trim()]}
          >
            ${msg(str`Add`)}
          </sp-action-button>
        </div>
      </div>
    </sp-accordion-item>`;
  }

  render() {
    return html`
      <sp-accordion size="s" allow-multiple>
        ${this.modeSection(ThemeMode.LIGHT, msg(str`Light`))}
        ${this.modeSection(ThemeMode.DARK, msg(str`Dark`))}
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
