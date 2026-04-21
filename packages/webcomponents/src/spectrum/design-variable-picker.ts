import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  cssColorToHex,
  isGradient,
  type AppState,
  type DesignVariable,
} from '@infinite-canvas-tutorial/ecs';
import { appStateContext } from '../context';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/swatch/sp-swatch.js';

export type DesignVariablePickDetail = { key: string };

@customElement('ic-spectrum-design-variable-picker')
@localized()
export class DesignVariablePicker extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
    }

    sp-picker {
      width: 100%;
    }

    .menu-item-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hint {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-gray-700);
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  /** 只列出匹配类型的变量 */
  @property({ type: String, attribute: 'match-type' })
  matchType: 'color' | 'number' | 'all' = 'all';

  @property({ type: String })
  label = '';

  /** 当前绑定的变量键（不含 `$`）；与 `AppState.variables` 中某项一致时高亮选中 */
  @property({ type: String, attribute: 'selected-key' })
  selectedKey = '';

  private get entries(): [string, DesignVariable][] {
    const map = this.appState?.variables ?? {};
    const list = Object.entries(map);
    if (this.matchType === 'all') {
      return list;
    }
    return list.filter(([, def]) => def.type === this.matchType);
  }

  /** 仅在当前列表中存在对应项时显示为选中，避免无效键残留 */
  private get pickerValue(): string {
    const k = this.selectedKey.trim();
    if (!k) {
      return '';
    }
    return this.entries.some(([name]) => name === k) ? k : '';
  }

  /** 供 `sp-swatch`：纯色走 hex，渐变保留原串 */
  private swatchColor(def: DesignVariable): string {
    if (def.type !== 'color' || typeof def.value !== 'string') {
      return '#888888';
    }
    const v = def.value.trim();
    if (!v || v === 'none') {
      return '#888888';
    }
    if (isGradient(v)) {
      return v;
    }
    return cssColorToHex(v);
  }

  private handleChange(e: Event & { target: { value: string } }) {
    const key = e.target.value;
    if (!key) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<DesignVariablePickDetail>('ic-variable-pick', {
        detail: { key },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const entries = this.entries;

    if (entries.length === 0) {
      return html`<span class="hint">${msg(str`No design variables`)}</span>`;
    }

    return html`
      <sp-picker
        size="s"
        style="width: 240px"
        value=${this.pickerValue}
        @change=${this.handleChange}
      >
        <span slot="label">${msg(str`Attach a variable`)}</span>
        ${entries.map(([k, def]) => {
      const isColor = def.type === 'color';
      return html`<sp-menu-item value=${k}>
            ${isColor
          ? html`<sp-swatch
          slot="icon" 
                  class="dv-swatch"
                  color=${this.swatchColor(def)}
                  size="s"
                ></sp-swatch>`
          : null}
            <span class="menu-item-label">${k}</span>
          </sp-menu-item>`;
    })}
      </sp-picker>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-design-variable-picker': DesignVariablePicker;
  }
}
