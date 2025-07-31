import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  Pen,
  FillAttributes,
  RoughAttributes,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { when } from 'lit/directives/when.js';

@customElement('ic-spectrum-penbar-draw-settings')
export class PenbarDrawSettings extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property({ type: String })
  pen: Pen.DRAW_RECT | Pen.DRAW_ELLIPSE | Pen.DRAW_LINE | Pen.DRAW_ROUGH_RECT;

  private handleStrokeWidthChanging(e: Event & { target: HTMLInputElement }) {
    const nextElementSibling = e.target.nextElementSibling as HTMLInputElement;
    if (nextElementSibling) {
      nextElementSibling.value = e.target.value;
    }
  }
  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    const strokeWidth = parseInt(e.target.value);
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        strokeWidth,
      },
    });
    this.api.record();
  }

  private handleStrokeOpacityChanging(e: Event & { target: HTMLInputElement }) {
    const nextElementSibling = e.target.nextElementSibling as HTMLInputElement;
    if (nextElementSibling) {
      nextElementSibling.value = e.target.value;
    }
  }
  private handleStrokeOpacityChanged(e: Event & { target: HTMLInputElement }) {
    const strokeOpacity = parseFloat(e.target.value);
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        strokeOpacity,
      },
    });
    this.api.record();
  }

  private handleStrokeColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();

    const strokeColor = (e.target as any).selected[0];
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        stroke: strokeColor,
      },
    });
  }

  private handleFillOpacityChanging(e: Event & { target: HTMLInputElement }) {
    const nextElementSibling = e.target.nextElementSibling as HTMLInputElement;
    if (nextElementSibling) {
      nextElementSibling.value = e.target.value;
    }
  }
  private handleFillOpacityChanged(e: Event & { target: HTMLInputElement }) {
    const fillOpacity = parseFloat(e.target.value);
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        fillOpacity,
      },
    });
    this.api.record();
  }

  private handleFillColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();

    const fillColor = (e.target as any).selected[0];
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        fill: fillColor,
      },
    });
  }

  private handleRoughFillStyleChanged(
    e: Event & { target: HTMLSelectElement },
  ) {
    e.stopPropagation();

    const roughFillStyle = e.target.value;
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        roughFillStyle,
      },
    });
    this.api.record();
  }

  private handleRoughBowingChanging(e: Event & { target: HTMLInputElement }) {
    const nextElementSibling = e.target.nextElementSibling as HTMLInputElement;
    if (nextElementSibling) {
      nextElementSibling.value = e.target.value;
    }
  }
  private handleRoughBowingChanged(e: Event & { target: HTMLInputElement }) {
    const roughBowing = parseFloat(e.target.value);
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        roughBowing,
      },
    });
    this.api.record();
  }

  private handleRoughRoughnessChanging(
    e: Event & { target: HTMLInputElement },
  ) {
    const nextElementSibling = e.target.nextElementSibling as HTMLInputElement;
    if (nextElementSibling) {
      nextElementSibling.value = e.target.value;
    }
  }
  private handleRoughRoughnessChanged(e: Event & { target: HTMLInputElement }) {
    const roughRoughness = parseFloat(e.target.value);
    this.api.setAppState({
      ...this.api.getAppState(),
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        roughRoughness,
      },
    });
    this.api.record();
  }

  get penbarDrawKey() {
    return this.pen === Pen.DRAW_RECT
      ? 'penbarDrawRect'
      : this.pen === Pen.DRAW_ELLIPSE
      ? 'penbarDrawEllipse'
      : this.pen === Pen.DRAW_LINE
      ? 'penbarDrawLine'
      : 'penbarDrawRoughRect';
  }

  get penbarDraw() {
    const {
      penbarDrawRect,
      penbarDrawEllipse,
      penbarDrawLine,
      penbarDrawRoughRect,
    } = this.appState;
    return this.pen === Pen.DRAW_RECT
      ? penbarDrawRect
      : this.pen === Pen.DRAW_ELLIPSE
      ? penbarDrawEllipse
      : this.pen === Pen.DRAW_LINE
      ? penbarDrawLine
      : penbarDrawRoughRect;
  }

  render() {
    const { theme } = this.appState;
    return html`<h4 style="margin: 0; margin-bottom: 8px;">
        Draw shapes settings
      </h4>

      ${when(
        this.pen === Pen.DRAW_RECT ||
          this.pen === Pen.DRAW_ELLIPSE ||
          this.pen === Pen.DRAW_ROUGH_RECT,
        () => html`
          <sp-field-label for="fill">Fill</sp-field-label>
          <sp-swatch-group
            id="fill"
            selects="single"
            .selected=${[(this.penbarDraw as FillAttributes).fill]}
            @change=${this.handleFillColorChanged}
          >
            ${theme.colors[theme.mode].swatches.map(
              (color) =>
                html` <sp-swatch color=${color} size="s"></sp-swatch> `,
            )}
          </sp-swatch-group>
          <div
            style="display: flex; align-items: center;justify-content: space-between;"
          >
            <sp-slider
              step="0.1"
              min="0"
              max="1"
              style="flex: 1;margin-right: 8px;"
              label="Fill opacity"
              label-visibility="text"
              value=${(this.penbarDraw as FillAttributes).fillOpacity}
              @input=${this.handleFillOpacityChanging}
              @change=${this.handleFillOpacityChanged}
            ></sp-slider>
            <sp-number-field
              style="position: relative;top: 10px; width: 80px;"
              value=${(this.penbarDraw as FillAttributes).fillOpacity}
              @change=${this.handleFillOpacityChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              max="1"
            ></sp-number-field>
          </div>
        `,
      )}

      <sp-field-label for="stroke">Stroke</sp-field-label>
      <sp-swatch-group
        id="stroke"
        selects="single"
        .selected=${[this.penbarDraw.stroke]}
        @change=${this.handleStrokeColorChanged}
      >
        ${theme.colors[theme.mode].swatches.map(
          (color) => html` <sp-swatch color=${color} size="s"></sp-swatch> `,
        )}
      </sp-swatch-group>
      <div
        style="display: flex; align-items: center;justify-content: space-between;"
      >
        <sp-slider
          step="1"
          min="0"
          max="100"
          style="flex: 1;margin-right: 8px;"
          label="Stroke width"
          label-visibility="text"
          value=${this.penbarDraw.strokeWidth}
          @input=${this.handleStrokeWidthChanging}
          @change=${this.handleStrokeWidthChanged}
        ></sp-slider>
        <sp-number-field
          style="position: relative;top: 10px; width: 80px;"
          value=${this.penbarDraw.strokeWidth}
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
        style="display: flex; align-items: center;justify-content: space-between;"
      >
        <sp-slider
          step="0.1"
          min="0"
          max="1"
          style="flex: 1;margin-right: 8px;"
          label="Stroke opacity"
          label-visibility="text"
          value=${this.penbarDraw.strokeOpacity}
          @input=${this.handleStrokeOpacityChanging}
          @change=${this.handleStrokeOpacityChanged}
        ></sp-slider>
        <sp-number-field
          style="position: relative;top: 10px; width: 80px;"
          value=${this.penbarDraw.strokeOpacity}
          @change=${this.handleStrokeOpacityChanged}
          hide-stepper
          autocomplete="off"
          min="0"
          max="1"
        ></sp-number-field>
      </div>

      ${when(
        this.pen === Pen.DRAW_ROUGH_RECT,
        () => html`
          <sp-field-label for="rough-fill-style"
            >Rough fill style</sp-field-label
          >
          <sp-picker
            label="Rough fill style"
            value=${(this.penbarDraw as RoughAttributes).roughFillStyle}
            @change=${this.handleRoughFillStyleChanged}
            id="rough-fill-style"
          >
            <sp-menu-item value="hachure">Hachure</sp-menu-item>
            <sp-menu-item value="solid">Solid</sp-menu-item>
            <sp-menu-item value="zigzag">Zigzag</sp-menu-item>
            <sp-menu-item value="cross-hatch">Cross hatch</sp-menu-item>
            <sp-menu-item value="dots">Dots</sp-menu-item>
            <sp-menu-item value="dashed">Dashed</sp-menu-item>
          </sp-picker>

          <div
            style="display: flex; align-items: center;justify-content: space-between;"
          >
            <sp-slider
              step="0.1"
              min="0"
              max="10"
              style="flex: 1;margin-right: 8px;"
              label="Bowing"
              label-visibility="text"
              value=${(this.penbarDraw as RoughAttributes).roughBowing}
              @input=${this.handleRoughBowingChanging}
              @change=${this.handleRoughBowingChanged}
            ></sp-slider>
            <sp-number-field
              style="position: relative;top: 10px; width: 80px;"
              value=${(this.penbarDraw as RoughAttributes).roughBowing}
              @change=${this.handleRoughBowingChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              max="10"
            ></sp-number-field>
          </div>

          <div
            style="display: flex; align-items: center;justify-content: space-between;"
          >
            <sp-slider
              step="0.1"
              min="0"
              max="10"
              style="flex: 1;margin-right: 8px;"
              label="Roughness"
              label-visibility="text"
              value=${(this.penbarDraw as RoughAttributes).roughRoughness}
              @input=${this.handleRoughRoughnessChanging}
              @change=${this.handleRoughRoughnessChanged}
            ></sp-slider>
            <sp-number-field
              style="position: relative;top: 10px; width: 80px;"
              value=${(this.penbarDraw as RoughAttributes).roughRoughness}
              @change=${this.handleRoughRoughnessChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              max="10"
            ></sp-number-field>
          </div>
        `,
      )} `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar-draw-settings': PenbarDrawSettings;
  }
}
