import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';

@customElement('ic-spectrum-penbar-pencil-settings')
@localized()
export class PenbarPencilSettings extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  private handleStrokeWidthChanging(e: Event & { target: HTMLInputElement }) {
    const nextElementSibling = e.target.nextElementSibling as HTMLInputElement;
    if (nextElementSibling) {
      nextElementSibling.value = e.target.value;
    }
  }

  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    const strokeWidth = parseInt(e.target.value);
    this.api.setAppState({
      penbarPencil: {
        ...this.api.getAppState().penbarPencil,
        strokeWidth,
      },
    });
    this.api.record();
  }

  private handleStrokeColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();

    const strokeColor = (e.target as any).selected[0];
    this.api.setAppState({
      penbarPencil: {
        ...this.api.getAppState().penbarPencil,
        stroke: strokeColor,
      },
    });
  }

  private handleFreehandChanged(e: Event & { target: HTMLInputElement }) {
    const freehand = (e.target as any).checked;
    this.api.setAppState({
      penbarPencil: {
        ...this.api.getAppState().penbarPencil,
        freehand,
      },
    });
  }

  render() {
    const { penbarPencil, theme } = this.appState;

    return html`<h4 style="margin: 0; margin-bottom: 8px;">
        ${msg(str`Pencil settings`)}
      </h4>
      <sp-field-label for="stroke">${msg(str`Stroke`)}</sp-field-label>
      <sp-swatch-group
        id="stroke"
        selects="single"
        .selected=${[penbarPencil.stroke]}
        @change=${this.handleStrokeColorChanged}
      >
        ${theme.colors[theme.mode].swatches.map(
          (color) => html` <sp-swatch color=${color} size="s"></sp-swatch> `,
        )}
      </sp-swatch-group>
      <div
        class="line"
        style="display: flex; align-items: center;justify-content: space-between;"
      >
        <sp-slider
          style="flex: 1;margin-right: 8px;"
          label=${msg(str`Stroke width`)}
          label-visibility="text"
          value=${penbarPencil.strokeWidth}
          @input=${this.handleStrokeWidthChanging}
          @change=${this.handleStrokeWidthChanged}
        ></sp-slider>
        <sp-number-field
          style="position: relative;top: 10px; width: 80px;"
          value=${penbarPencil.strokeWidth}
          @change=${this.handleStrokeWidthChanged}
          hide-stepper
          autocomplete="off"
          min="0"
          format-options='{
        "style": "unit",
        "unit": "px"
      }'
        ></sp-number-field>
      </div>
      <div
        class="line"
        style="display: flex; align-items: center;justify-content: space-between;"
      >
        <sp-switch
          label=${msg(str`Freehand`)}
          .checked=${penbarPencil.freehand}
          @change=${this.handleFreehandChanged}
          >${msg(str`Freehand`)}</sp-switch
        >
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar-pencil-settings': PenbarPencilSettings;
  }
}
