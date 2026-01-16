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
    const strokeWidth = parseInt(e.target.value);
    this.api.setAppState({
      penbarBrush: {
        ...this.api.getAppState().penbarBrush,
        strokeWidth,
      },
    });
    this.api.record();
  }

  private handleStrokeColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();

    const strokeColor = (e.target as any).selected[0];
    this.api.setAppState({
      penbarBrush: {
        ...this.api.getAppState().penbarBrush,
        stroke: strokeColor,
      },
    });
  }

  private handleStampIntervalChanged(e: Event & { target: HTMLInputElement }) {
    const stampInterval = parseFloat(e.target.value);
    this.api.setAppState({
      penbarBrush: {
        ...this.api.getAppState().penbarBrush,
        stampInterval,
      },
    });
    this.api.record();
  }

  private handleStampNoiseFactorChanged(
    e: Event & { target: HTMLInputElement },
  ) {
    const stampNoiseFactor = parseFloat(e.target.value);
    this.api.setAppState({
      penbarBrush: {
        ...this.api.getAppState().penbarBrush,
        stampNoiseFactor,
      },
    });
    this.api.record();
  }

  private handleStampRotationFactorChanged(
    e: Event & { target: HTMLInputElement },
  ) {
    const stampRotationFactor = parseFloat(e.target.value);
    this.api.setAppState({
      penbarBrush: {
        ...this.api.getAppState().penbarBrush,
        stampRotationFactor,
      },
    });
    this.api.record();
  }

  private handleStampChanged(e: Event & { target: HTMLInputElement }) {}

  render() {
    const { penbarBrush, theme } = this.appState;

    return html`<h4 style="margin: 0; margin-bottom: 8px;">
        ${msg(str`Brush settings`)}
      </h4>
      <sp-field-label for="stroke">${msg(str`Stroke`)}</sp-field-label>
      <sp-swatch-group
        id="stroke"
        selects="single"
        .selected=${[penbarBrush.stroke]}
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
          value=${penbarBrush.stamp}
          @change=${this.handleStampChanged}
          id="font-family"
        >
          ${penbarBrush.stamps.map(
            (stamp) =>
              html`<sp-menu-item value=${stamp}>
                <img src=${stamp} style="width: 20px; height: 20px;" />
                ${stamp}
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
          value=${penbarBrush.strokeWidth}
          step="1"
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
          value=${penbarBrush.stampInterval}
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
          min="0.1"
          value=${penbarBrush.stampNoiseFactor}
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
          min="0.1"
          value=${penbarBrush.stampRotationFactor}
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
