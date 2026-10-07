import { live } from 'lit/directives/live.js';
import { drawingPaint, updateDrawingPreference } from './drawing-preferences';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';

@customElement('ic-spectrum-penbar-brush-settings')
@localized()
export class PenbarBrushSettings extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarBrush', {
      kind: 'number',
      field: 'strokeWidth',
      value: e.target.value,
    });
  }

  private handleStrokeColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarBrush', {
      kind: 'paint',
      field: 'strokes',
      color: (e.target as any).selected?.[0],
    });
  }

  private handleStampIntervalChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarBrush', {
      kind: 'number',
      field: 'stampInterval',
      value: e.target.value,
    });
  }

  private handleStampNoiseFactorChanged(
    e: Event & { target: HTMLInputElement },
  ) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarBrush', {
      kind: 'number',
      field: 'stampNoiseFactor',
      value: e.target.value,
    });
  }

  private handleStampRotationFactorChanged(
    e: Event & { target: HTMLInputElement },
  ) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarBrush', {
      kind: 'number',
      field: 'stampRotationFactor',
      value: e.target.value,
    });
  }

  private handleStampChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, 'penbarBrush', {
      kind: 'stamp',
      value: e.target.value,
    });
  }

  render() {
    const { penbarBrush, theme } = this.appState;

    return html`<h4 style="margin: 0; margin-bottom: 8px;">
        ${msg(str`Brush settings`)}
      </h4>
      <sp-field-label for="stroke">${msg(str`Stroke`)}</sp-field-label>
      <sp-swatch-group
        id="stroke"
        selects="single"
        .selected=${[drawingPaint(penbarBrush, 'strokes')[0]?.value]}
        @change=${this.handleStrokeColorChanged}
      >
        ${theme.colors[theme.mode].swatches.map(
          (color) => html` <sp-swatch color=${color} size="s"></sp-swatch> `,
        )}
      </sp-swatch-group>

      <div class="line">
        <sp-picker
          style="width: 100%; margin-bottom: 4px; margin-top: 4px;"
          label=${msg(str`Stamp`)}
          .value=${live(penbarBrush.stamps.find((stamp) => stamp.active)?.src)}
          @change=${this.handleStampChanged}
          id="font-family"
        >
          ${penbarBrush.stamps.map(
            (stamp) =>
              html`<sp-menu-item
                .value=${live(stamp.src)}
                style="display: flex; align-items: center; gap: 4px;"
              >
                <img src=${stamp.src} style="width: 20px; height: 20px;" />
                <span>${stamp.name}</span>
              </sp-menu-item>`,
          )}
        </sp-picker>
      </div>
      <div class="line" style="display: flex; align-items: center;">
        <sp-slider
          style="flex: 1;"
          size="s"
          label=${msg(str`Stroke width`)}
          max="80"
          min="0"
          .value=${live(penbarBrush.strokeWidth)}
          step="0.1"
          editable
          format-options='{
        "style": "unit",
        "unit": "px"
      }'
          @change=${this.handleStrokeWidthChanged}
        ></sp-slider>
      </div>
      <div class="line" style="display: flex; align-items: center;">
        <sp-slider
          style="flex: 1;"
          size="s"
          label=${msg(str`Stamp interval`)}
          max="1"
          min="0.1"
          .value=${live(penbarBrush.stampInterval)}
          step="0.1"
          editable
          @change=${this.handleStampIntervalChanged}
        ></sp-slider>
      </div>
      <div class="line" style="display: flex; align-items: center;">
        <sp-slider
          style="flex: 1;"
          size="s"
          label=${msg(str`Stamp noise factor`)}
          max="1"
          min="0"
          .value=${live(penbarBrush.stampNoiseFactor)}
          step="0.1"
          editable
          @change=${this.handleStampNoiseFactorChanged}
        ></sp-slider>
      </div>
      <div class="line" style="display: flex; align-items: center;">
        <sp-slider
          style="flex: 1;"
          size="s"
          label=${msg(str`Stamp rotation factor`)}
          max="1"
          min="0"
          .value=${live(penbarBrush.stampRotationFactor)}
          step="0.1"
          editable
          @change=${this.handleStampRotationFactorChanged}
        ></sp-slider>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar-brush-settings': PenbarBrushSettings;
  }
}
