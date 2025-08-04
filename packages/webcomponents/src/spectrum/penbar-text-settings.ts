import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

@customElement('ic-spectrum-penbar-text-settings')
export class PenbarTextSettings extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  private handleFillColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();

    const fillColor = (e.target as any).selected[0];
    this.api.setAppState({
      ...this.api.getAppState(),
      penbarText: {
        ...this.api.getAppState().penbarText,
        fill: fillColor,
      },
    });
  }

  private handleFontFamilyChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    const fontFamily = e.target.value;
    this.api.setAppState({
      ...this.api.getAppState(),
      penbarText: { ...this.api.getAppState().penbarText, fontFamily },
    });
  }

  private handleFontSizeChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    const fontSize = (e.target as any).value;
    this.api.setAppState({
      ...this.api.getAppState(),
      penbarText: { ...this.api.getAppState().penbarText, fontSize },
    });
  }

  private handleFontStyleChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    const fontStyle = e.target.value;
    this.api.setAppState({
      ...this.api.getAppState(),
      penbarText: { ...this.api.getAppState().penbarText, fontStyle },
    });
  }

  render() {
    const { penbarText, theme } = this.appState;

    return html`<h4 style="margin: 0; margin-bottom: 8px;">Text settings</h4>
      <sp-field-label for="font-family">Typography</sp-field-label>
      <sp-picker
        style="width: 100%; margin-bottom: 4px;"
        label="Font family"
        value=${penbarText.fontFamily}
        @change=${this.handleFontFamilyChanged}
        id="font-family"
      >
        <sp-menu-item value="system-ui" style="font-family: system-ui;"
          >system-ui</sp-menu-item
        >
        <sp-menu-item value="serif" style="font-family: serif;"
          >serif</sp-menu-item
        >
        <sp-menu-item value="monospace" style="font-family: monospace;"
          >monospace</sp-menu-item
        >
      </sp-picker>

      <div
        class="line"
        style="display: flex; align-items: center;justify-content: space-between;"
      >
        <sp-picker
          label="Font style"
          value=${penbarText.fontStyle}
          @change=${this.handleFontStyleChanged}
          id="font-style"
        >
          <sp-menu-item value="normal">normal</sp-menu-item>
          <sp-menu-item value="italic">italic</sp-menu-item>
        </sp-picker>

        <sp-number-field
          style="width: 80px;"
          value=${penbarText.fontSize}
          @change=${this.handleFontSizeChanged}
          autocomplete="off"
          min="0"
        ></sp-number-field>
      </div>

      <sp-field-label for="fill">Fill</sp-field-label>
      <sp-swatch-group
        id="fill"
        selects="single"
        .selected=${[penbarText.fill]}
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
