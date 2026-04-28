import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { IconFontSerializedNode } from '@infinite-canvas-tutorial/ecs';
import {
  getRegisteredIconifyIconFamilies,
  getRegisteredIconifyIconNames,
} from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/overlay/overlay-trigger.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import 'iconify-icon';

export type IconFontControlsPatch = Partial<
  Pick<IconFontSerializedNode, 'iconFontFamily' | 'iconFontName'>
>;

export function wireIconFontString(v: unknown): string {
  if (v == null) {
    return '';
  }
  if (typeof v === 'string') {
    return v;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v);
  }
  return String(v);
}

@customElement('ic-spectrum-icon-font-controls')
@localized()
export class IconFontControls extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .iconfont-name-popover {
      padding: 0;
      min-width: 280px;
      max-width: min(100vw - 32px, 420px);
      box-sizing: border-box;
    }

    .iconfont-name-popover .iconfont-picker-toolbar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid var(--spectrum-gray-300);
    }

    .iconfont-name-popover .iconfont-icon-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, 32px);
      grid-auto-rows: 32px;
      justify-content: start;
      align-content: start;
      gap: 6px;
      padding: 8px;
      max-height: min(50vh, 360px);
      overflow: auto;
      box-sizing: border-box;
    }

    .iconfont-name-popover .iconfont-icon-grid .iconfont-icon-cell-wrap {
      display: block;
      width: 32px;
      height: 32px;
      box-sizing: border-box;
    }

    .iconfont-name-popover .iconfont-icon-grid button.iconfont-icon-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      flex: none;
      position: relative;
      overflow: hidden;
      border: 1px solid transparent;
      border-radius: var(--spectrum-corner-radius-100);
      background: transparent;
      cursor: pointer;
      color: var(--spectrum-gray-800);
    }

    .iconfont-name-popover .iconfont-icon-grid button.iconfont-icon-cell:hover {
      background: var(--spectrum-gray-200);
    }

    .iconfont-name-popover
      .iconfont-icon-grid
      button.iconfont-icon-cell.is-selected {
      border-color: var(
        --spectrum-focus-indicator-color,
        var(--spectrum-blue-500)
      );
      background: var(--spectrum-gray-200);
    }

    .iconfont-name-popover .iconfont-icon-grid button.iconfont-icon-cell iconify-icon {
      display: block;
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      pointer-events: none;
    }

    .iconfont-name-popover .iconfont-grid-empty {
      margin: 0;
      padding: 8px;
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-gray-700);
    }

    .iconfont-name-popover .iconfont-custom-id {
      padding: 0 8px 8px;
    }

    .iconfont-family-row sp-picker {
      max-width: 120px;
      min-width: 0;
    }
  `;

  @property()
  iconFontFamily: string | number | undefined;

  @property()
  iconFontName: string | number | undefined;

  /**
   * 用于 overlay trigger id 等，避免多实例与非法 id 字符。
   */
  @property({ type: String })
  instanceId = 'default';

  @state()
  private pickerFilter = '';

  get #safeId(): string {
    return this.instanceId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
  }

  #getFamilyPickerModel() {
    const families = [...getRegisteredIconifyIconFamilies()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    const raw = wireIconFontString(this.iconFontFamily).trim();
    if (!raw) {
      return { value: '', hasOrphan: false, orphan: '', families };
    }
    const found = families.find(
      (f) => f.toLowerCase() === raw.toLowerCase(),
    );
    if (found) {
      return { value: found, hasOrphan: false, orphan: '', families };
    }
    return {
      value: raw,
      hasOrphan: true,
      orphan: raw,
      families,
    };
  }

  #getGridView() {
    const familyRaw = wireIconFontString(this.iconFontFamily).trim();
    const familyKey = (familyRaw || 'lucide').toLowerCase();
    const all = getRegisteredIconifyIconNames(familyKey);
    const totalInFamily = all.length;
    const q = this.pickerFilter.trim().toLowerCase();
    const fullMatch = q
      ? all.filter((name) => name.toLowerCase().includes(q))
      : all;
    return {
      familyKey,
      displayNames: fullMatch,
      totalInFamily,
      isEmpty: fullMatch.length === 0,
    };
  }

  #isCellSelected(familyKey: string, cellName: string): boolean {
    const raw = wireIconFontString(this.iconFontName).trim();
    if (!raw) {
      return false;
    }
    if (raw.includes(':')) {
      const [p, rest] = raw.split(':', 2);
      return p.toLowerCase() === familyKey && rest === cellName;
    }
    return raw === cellName;
  }

  #emit(patch: IconFontControlsPatch) {
    this.dispatchEvent(
      new CustomEvent<IconFontControlsPatch>('ic-iconfont-controls-change', {
        bubbles: true,
        composed: true,
        detail: patch,
      }),
    );
  }

  #onFamilyChange(e: Event) {
    const t = e.target as { value?: string };
    const v = t.value?.trim() ?? '';
    this.pickerFilter = '';
    this.#emit({ iconFontFamily: v || undefined });
    this.requestUpdate();
  }

  #onNameTextChange(e: Event & { target: HTMLInputElement }) {
    const v = e.target.value.trim();
    this.#emit({ iconFontName: v || undefined });
  }

  #onFilterInput(e: Event) {
    const t = e.target as HTMLInputElement;
    this.pickerFilter = t.value;
  }

  #onPickFromGrid(shortName: string) {
    this.#emit({ iconFontName: shortName });
  }

  render() {
    const famPicker = this.#getFamilyPickerModel();
    const iconName = wireIconFontString(this.iconFontName);
    const grid = this.#getGridView();
    const triggerId = `ic-iconfont-name-pop--${this.#safeId}`;
    const familyFieldId = `ic-iconfont-family--${this.#safeId}`;

    return html`
      <div class="content layout-group style-group">
        <div class="line iconfont-family-row">
          <sp-field-label for=${familyFieldId} side-aligned="start"
            >${msg(str`Font family`)}</sp-field-label
          >
          <sp-picker
            id=${familyFieldId}
            size="s"
            .value=${famPicker.value}
            @change=${this.#onFamilyChange}
            placeholder=${msg(str`Select a registered set`)}
          >
            ${!famPicker.families.length && !famPicker.hasOrphan
        ? html`<sp-menu-item value="" disabled
                    >${msg(
          str`No sets registered (use registerIconifyIconSet)`,
        )}</sp-menu-item
                  >`
        : html`
                    ${famPicker.hasOrphan
            ? html`<sp-menu-item value=${famPicker.orphan}
                          >${msg(str`Current`)}: ${famPicker.orphan}</sp-menu-item
                        >`
            : null}
                    ${famPicker.families.map(
              (f) => html`<sp-menu-item value=${f}>${f}</sp-menu-item>`,
            )}
                  `}
          </sp-picker>
        </div>
        <div class="line iconfont-name-row">
          <sp-field-label for=${triggerId} side-aligned="start"
            >${msg(str`Name`)}</sp-field-label
          >
          <div
            class="layout-inset-inline"
            style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;justify-content:flex-end"
          >
            <sp-action-button
              id=${triggerId}
              size="s"
              class="icon-name-picker-trigger"
              style="max-width:100%;min-width:0"
            >
              <span
                style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px"
                >${iconName || msg(str`Choose icon`)}</span
              >
            </sp-action-button>
            ${repeat(
              [grid.familyKey],
              (k) => k,
              () => html`
                <sp-overlay
                  trigger=${`${triggerId}@click`}
                  placement="bottom"
                  type="auto"
                >
                  <sp-popover class="iconfont-name-popover" dialog>
                    <div class="iconfont-picker-toolbar">
                      <sp-textfield
                        size="s"
                        label=${msg(str`Filter by name`)}
                        .value=${this.pickerFilter}
                        @input=${this.#onFilterInput}
                        placeholder=${msg(str`Filter…`)}
                      ></sp-textfield>
                    </div>
                    ${grid.totalInFamily === 0
                  ? html`<p class="iconfont-grid-empty">
                        ${msg(
                    str`No icon set is registered for this family. Use registerIconifyIconSet in your app to load a JSON, then set Icon font family to the same id.`,
                  )}
                      </p>`
                  : grid.isEmpty
                    ? html`<p class="iconfont-grid-empty">
                        ${msg(str`No icon names match the current filter.`)}
                      </p>`
                    : html`
                      <div
                        class="iconfont-icon-grid"
                        role="listbox"
                        aria-label=${msg(str`Icon names`)}
                      >
                        ${grid.displayNames.map(
                      (name) => {
                        const selected = this.#isCellSelected(
                          grid.familyKey,
                          name,
                        );
                        const iconId = `${grid.familyKey}:${name}`;
                        return html`
                                <overlay-trigger
                                  class="iconfont-icon-cell-wrap"
                                  triggered-by="hover"
                                  placement="top"
                                  offset="4"
                                >
                                  <button
                                    slot="trigger"
                                    type="button"
                                    class="iconfont-icon-cell${selected
                            ? ' is-selected'
                            : ''}"
                                    aria-label=${name}
                                    role="option"
                                    @click=${() => this.#onPickFromGrid(name)}
                                  >
                                    <iconify-icon
                                      icon=${iconId}
                                      width="24"
                                      height="24"
                                      aria-hidden="true"
                                    ></iconify-icon>
                                  </button>
                                  <sp-tooltip
                                    slot="hover-content"
                                    placement="top"
                                  >
                                    ${name}
                                  </sp-tooltip>
                                </overlay-trigger>
                              `;
                      },
                    )}
                      </div>
                    `}
                    <div class="iconfont-custom-id">
                      <sp-textfield
                        size="s"
                        label=${msg(str`Custom icon id`)}
                        .value=${iconName}
                        placeholder=${msg(
                      str`Short name or full collection:name override`,
                    )}
                        @change=${this.#onNameTextChange}
                      ></sp-textfield>
                    </div>
                  </sp-popover>
                </sp-overlay>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-icon-font-controls': IconFontControls;
  }
}
