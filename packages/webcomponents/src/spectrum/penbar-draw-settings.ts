import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  AppState,
  Pen,
  FillAttributes,
  RoughAttributes,
  Marker,
  MarkerAttributes,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { msg, str, localized } from '@lit/localize';

@customElement('ic-spectrum-penbar-draw-settings')
@localized()
export class PenbarDrawSettings extends LitElement {
  static styles = css`
    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      sp-field-label {
        width: 100px;
      }

      sp-number-field {
        width: 80px;
      }

      > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }

    sp-slider {
      flex: 1;
    }

    .stroke-width-field {
      position: relative;
      top: 10px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property({ type: String })
  pen:
    | Pen.DRAW_RECT
    | Pen.DRAW_ELLIPSE
    | Pen.DRAW_LINE
    | Pen.DRAW_ARROW
    | Pen.DRAW_ROUGH_RECT;

  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    const strokeWidth = parseInt(e.target.value);
    this.api.setAppState({
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        strokeWidth,
      },
    });
    this.api.record();
  }

  private handleStrokeOpacityChanged(e: Event & { target: HTMLInputElement }) {
    const strokeOpacity = parseFloat(e.target.value);
    this.api.setAppState({
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
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        stroke: strokeColor,
      },
    });
  }

  private handleFillOpacityChanged(e: Event & { target: HTMLInputElement }) {
    const fillOpacity = parseFloat(e.target.value);
    this.api.setAppState({
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
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        roughFillStyle,
      },
    });
    this.api.record();
  }

  private handleRoughBowingChanged(e: Event & { target: HTMLInputElement }) {
    const roughBowing = parseFloat(e.target.value);
    this.api.setAppState({
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        roughBowing,
      },
    });
    this.api.record();
  }

  private handleRoughRoughnessChanged(e: Event & { target: HTMLInputElement }) {
    const roughRoughness = parseFloat(e.target.value);
    this.api.setAppState({
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        roughRoughness,
      },
    });
    this.api.record();
  }

  private handleMarkerStartChanged(e: Event & { target: HTMLInputElement }) {
    const markerStart = e.target.value as Marker['start'];
    this.api.setAppState({
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        markerStart,
      },
    });
    this.api.record();
  }

  private handleMarkerEndChanged(e: Event & { target: HTMLInputElement }) {
    const markerEnd = e.target.value as Marker['end'];
    this.api.setAppState({
      [this.penbarDrawKey]: {
        ...this.api.getAppState()[this.penbarDrawKey],
        markerEnd,
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
      : this.pen === Pen.DRAW_ARROW
      ? 'penbarDrawArrow'
      : 'penbarDrawRoughRect';
  }

  get penbarDraw() {
    const {
      penbarDrawRect,
      penbarDrawEllipse,
      penbarDrawLine,
      penbarDrawArrow,
      penbarDrawRoughRect,
    } = this.appState;
    return this.pen === Pen.DRAW_RECT
      ? penbarDrawRect
      : this.pen === Pen.DRAW_ELLIPSE
      ? penbarDrawEllipse
      : this.pen === Pen.DRAW_LINE
      ? penbarDrawLine
      : this.pen === Pen.DRAW_ARROW
      ? penbarDrawArrow
      : penbarDrawRoughRect;
  }

  render() {
    const { theme } = this.appState;
    return html`<h4 style="margin: 0; margin-bottom: 8px;">
        ${msg(str`Draw shapes settings`)}
      </h4>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${when(
          this.pen === Pen.DRAW_RECT ||
            this.pen === Pen.DRAW_ELLIPSE ||
            this.pen === Pen.DRAW_ROUGH_RECT,
          () => html`
            <div>
              <sp-field-label for="fill">${msg(str`Fill`)}</sp-field-label>
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
            </div>

            <div class="line">
              <sp-slider
                label=${msg(str`Fill opacity`)}
                size="s"
                max="1"
                min="0"
                value=${(this.penbarDraw as FillAttributes).fillOpacity}
                step="0.01"
                editable
                @change=${this.handleFillOpacityChanged}
              ></sp-slider>
            </div>
          `,
        )}

        <div>
          <sp-field-label for="stroke">${msg(str`Stroke`)}</sp-field-label>
          <sp-swatch-group
            id="stroke"
            selects="single"
            .selected=${[this.penbarDraw.stroke]}
            @change=${this.handleStrokeColorChanged}
          >
            ${theme.colors[theme.mode].swatches.map(
              (color) =>
                html` <sp-swatch color=${color} size="s"></sp-swatch> `,
            )}
          </sp-swatch-group>
        </div>
        <div class="line">
          <sp-slider
            label=${msg(str`Stroke width`)}
            size="s"
            max="20"
            min="0"
            value=${this.penbarDraw.strokeWidth}
            step="1"
            editable
            format-options='{
              "style": "unit",
              "unit": "px"
            }'
            @change=${this.handleStrokeWidthChanged}
          ></sp-slider>
        </div>

        <div class="line">
          <sp-slider
            size="s"
            label=${msg(str`Stroke opacity`)}
            max="1"
            min="0"
            value=${this.penbarDraw.strokeOpacity}
            step="0.01"
            editable
            @change=${this.handleStrokeOpacityChanged}
          ></sp-slider>
        </div>

        ${when(
          this.pen === Pen.DRAW_ARROW,
          () => html`
            <div class="line">
              <sp-field-label for="marker-start" side-aligned="start"
                >${msg(str`Marker start`)}</sp-field-label
              >
              <sp-picker
                style="width: 80px;"
                label=${msg(str`Marker start`)}
                value=${(this.penbarDraw as MarkerAttributes).markerStart}
                @change=${this.handleMarkerStartChanged}
                id="marker-start"
              >
                ${['none', 'line'].map(
                  (markerType) =>
                    html`<sp-menu-item value=${markerType}
                      >${markerType}</sp-menu-item
                    >`,
                )}
              </sp-picker>
            </div>

            <div class="line">
              <sp-field-label for="marker-end" side-aligned="start"
                >${msg(str`Marker end`)}</sp-field-label
              >
              <sp-picker
                style="width: 80px;"
                label=${msg(str`Marker end`)}
                value=${(this.penbarDraw as MarkerAttributes).markerEnd}
                @change=${this.handleMarkerEndChanged}
                id="marker-end"
              >
                ${['none', 'line'].map(
                  (markerType) =>
                    html`<sp-menu-item value=${markerType}
                      >${markerType}</sp-menu-item
                    >`,
                )}
              </sp-picker>
            </div>
          `,
        )}
        ${when(
          this.pen === Pen.DRAW_ROUGH_RECT,
          () => html`
            <div>
              <sp-field-label for="rough-fill-style"
                >${msg(str`Rough fill style`)}</sp-field-label
              >
              <sp-picker
                label=${msg(str`Rough fill style`)}
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
            </div>

            <div class="line">
              <sp-slider
                size="s"
                label=${msg(str`Bowing`)}
                value=${(this.penbarDraw as RoughAttributes).roughBowing}
                step="0.1"
                min="0"
                max="10"
                editable
                @change=${this.handleRoughBowingChanged}
              ></sp-slider>
            </div>

            <div class="line">
              <sp-slider
                size="s"
                label=${msg(str`Roughness`)}
                value=${(this.penbarDraw as RoughAttributes).roughRoughness}
                step="0.1"
                min="0"
                max="10"
                editable
                @change=${this.handleRoughRoughnessChanged}
              ></sp-slider>
            </div>
          `,
        )}
      </div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar-draw-settings': PenbarDrawSettings;
  }
}
