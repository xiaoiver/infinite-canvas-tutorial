import { live } from 'lit/directives/live.js';
import { drawingPaint, updateDrawingPreference } from './drawing-preferences';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';

@customElement('ic-spectrum-penbar-text-settings')
@localized()
export class PenbarTextSettings extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  private handleFillColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarText', {
      kind: 'paint',
      field: 'fills',
      color: (e.target as any).selected?.[0],
    });
  }

  private handleFontFamilyChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarText', {
      kind: 'fontFamily',
      value: e.target.value,
    });
  }

  private handleFontSizeChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarText', {
      kind: 'number',
      field: 'fontSize',
      value: e.target.value,
    });
  }

  private handleFontStyleChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarText', {
      kind: 'choice',
      field: 'fontStyle',
      value: e.target.value,
    });
  }

  render() {
    const { penbarText, theme } = this.appState;

    return html`<h4 style="margin: 0; margin-bottom: 8px;">
        ${msg(str`Text settings`)}
      </h4>
      <sp-field-label for="font-family">Typography</sp-field-label>
      <sp-picker
        style="width: 100%; margin-bottom: 4px;"
        label=${msg(str`Font family`)}
        .value=${live(penbarText.fontFamily)}
        @change=${this.handleFontFamilyChanged}
        id="font-family"
      >
        ${penbarText.fontFamilies.map(
          (fontFamily) =>
            html`<sp-menu-item
              .value=${live(fontFamily)}
              style="font-family: ${fontFamily};"
              >${fontFamily}</sp-menu-item
            >`,
        )}
      </sp-picker>

      <div
        class="line"
        style="display: flex; align-items: center;justify-content: space-between; gap: 4px;"
      >
        <sp-picker
          style="flex: 1;"
          label=${msg(str`Font style`)}
          .value=${live(penbarText.fontStyle)}
          @change=${this.handleFontStyleChanged}
          id="font-style"
        >
          <sp-menu-item value="normal">${msg(str`normal`)}</sp-menu-item>
          <sp-menu-item value="italic">${msg(str`italic`)}</sp-menu-item>
        </sp-picker>

        <sp-number-field
          style="width: 70px;"
          .value=${live(penbarText.fontSize)}
          @change=${this.handleFontSizeChanged}
          autocomplete="off"
          min="0"
          step="0.1"
        ></sp-number-field>
      </div>

      <sp-field-label for="fill">${msg(str`Fill`)}</sp-field-label>
      <sp-swatch-group
        id="fill"
        selects="single"
        .selected=${[drawingPaint(penbarText, 'fills')[0]?.value ?? '#000000']}
        @change=${this.handleFillColorChanged}
      >
        ${theme.colors[theme.mode].swatches.map(
          (color) => html` <sp-swatch color=${color} size="s"></sp-swatch> `,
        )}
      </sp-swatch-group> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar-text-settings': PenbarTextSettings;
  }
}
