import { live } from 'lit/directives/live.js';
import { drawingPaint, updateDrawingPreference } from './drawing-preferences';
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

  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarPencil', {
      kind: 'number',
      field: 'strokeWidth',
      value: e.target.value,
    });
  }

  private handleStrokeColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarPencil', {
      kind: 'paint',
      field: 'strokes',
      color: (e.target as any).selected?.[0],
    });
  }

  private handleFreehandChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarPencil', {
      kind: 'freehand',
      value: (e.target as any).checked,
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
        .selected=${[drawingPaint(penbarPencil, 'strokes')[0]?.value]}
        @change=${this.handleStrokeColorChanged}
      >
        ${theme.colors[theme.mode].swatches.map(
          (color) => html` <sp-swatch color=${color} size="s"></sp-swatch> `,
        )}
      </sp-swatch-group>
      <div class="line" style="display: flex; align-items: center;">
        <sp-slider
          style="flex: 1;"
          size="s"
          label=${msg(str`Stroke width`)}
          max="100"
          min="0"
          .value=${live(penbarPencil.strokeWidth)}
          step="0.1"
          editable
          format-options='{
        "style": "unit",
        "unit": "px"
      }'
          @change=${this.handleStrokeWidthChanged}
        ></sp-slider>
      </div>
      <div
        class="line"
        style="display: flex; align-items: center;justify-content: space-between;"
      >
        <sp-switch
          label=${msg(str`Freehand`)}
          .checked=${live(penbarPencil.freehand ?? false)}
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
