import { live } from 'lit/directives/live.js';
import { drawingPaint, updateDrawingPreference } from './drawing-preferences';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  AppState,
  Pen,
  FillAttributes,
  RoughAttributes,
  MarkerAttributes,
  type IconFontAttributes,
  type StrokeAttributes,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { msg, str, localized } from '@lit/localize';
import './icon-font-controls.js';
import type { IconFontControlsPatch } from './icon-font-controls';

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
        width: 70px;
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
    | Pen.DRAW_TRIANGLE
    | Pen.DRAW_PENTAGON
    | Pen.DRAW_HEXAGON
    | Pen.DRAW_ELLIPSE
    | Pen.DRAW_LINE
    | Pen.DRAW_ARROW
    | Pen.DRAW_ROUGH_RECT
    | Pen.DRAW_ROUGH_ELLIPSE
    | Pen.DRAW_ROUGH_LINE
    | Pen.DRAW_ICONFONT;

  private handleStrokeWidthChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'number',
      field: 'strokeWidth',
      value: e.target.value,
    });
  }

  private handleStrokeColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'paint',
      field: 'strokes',
      color: (e.target as any).selected?.[0],
    });
  }

  private handleStrokeOpacityChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'paint',
      field: 'strokes',
      opacity: e.target.value,
    });
  }

  private handleFillOpacityChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'paint',
      field: 'fills',
      opacity: e.target.value,
    });
  }

  private handleFillColorChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'paint',
      field: 'fills',
      color: (e.target as any).selected?.[0],
    });
  }

  private handleRoughFillStyleChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'choice',
      field: 'roughFillStyle',
      value: e.target.value,
    });
  }

  private handleRoughBowingChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'number',
      field: 'roughBowing',
      value: e.target.value,
    });
  }

  private handleRoughRoughnessChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'number',
      field: 'roughRoughness',
      value: e.target.value,
    });
  }

  private handleMarkerStartChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'choice',
      field: 'markerStart',
      value: e.target.value,
    });
  }

  private handleMarkerEndChanged(e: Event & { target: HTMLInputElement }) {
    e.stopPropagation();
    updateDrawingPreference(this, this.penbarDrawKey, {
      kind: 'choice',
      field: 'markerEnd',
      value: e.target.value,
    });
  }

  private handlePenbarIconFontControlsPatch(
    e: CustomEvent<IconFontControlsPatch>,
  ) {
    e.stopPropagation();
    if (this.pen === Pen.DRAW_ICONFONT) {
      updateDrawingPreference(this, 'penbarDrawIconfont', {
        kind: 'icon',
        value: e.detail,
      });
    }
  }

  get penbarDrawKey() {
    return this.pen === Pen.DRAW_RECT
      ? 'penbarDrawRect'
      : this.pen === Pen.DRAW_TRIANGLE
      ? 'penbarDrawTriangle'
      : this.pen === Pen.DRAW_PENTAGON
      ? 'penbarDrawPentagon'
      : this.pen === Pen.DRAW_HEXAGON
      ? 'penbarDrawHexagon'
      : this.pen === Pen.DRAW_ELLIPSE
      ? 'penbarDrawEllipse'
      : this.pen === Pen.DRAW_LINE
      ? 'penbarDrawLine'
      : this.pen === Pen.DRAW_ARROW
      ? 'penbarDrawArrow'
      : this.pen === Pen.DRAW_ROUGH_RECT
      ? 'penbarDrawRoughRect'
      : this.pen === Pen.DRAW_ROUGH_ELLIPSE
      ? 'penbarDrawRoughEllipse'
      : this.pen === Pen.DRAW_ROUGH_LINE
      ? 'penbarDrawRoughLine'
      : 'penbarDrawIconfont';
  }

  get penbarDraw() {
    return this.appState[this.penbarDrawKey];
  }

  render() {
    const { theme } = this.appState;
    return html`<h4 style="margin: 0; margin-bottom: 8px;">
        ${msg(str`Draw shapes settings`)}
      </h4>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${when(
          this.pen === Pen.DRAW_RECT ||
            this.pen === Pen.DRAW_TRIANGLE ||
            this.pen === Pen.DRAW_PENTAGON ||
            this.pen === Pen.DRAW_HEXAGON ||
            this.pen === Pen.DRAW_ELLIPSE ||
            this.pen === Pen.DRAW_ROUGH_RECT ||
            this.pen === Pen.DRAW_ROUGH_ELLIPSE ||
            this.pen === Pen.DRAW_ROUGH_LINE ||
            this.pen === Pen.DRAW_ICONFONT,
          () => html`
            <div>
              <sp-field-label for="fill">${msg(str`Fill`)}</sp-field-label>
              <sp-swatch-group
                id="fill"
                selects="single"
                .selected=${[
                  drawingPaint(this.penbarDraw, 'fills')[0]?.value ?? '#000000',
                ]}
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
                .value=${live(
                  drawingPaint(this.penbarDraw, 'fills')[0]?.opacity ?? 1,
                )}
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
            .selected=${[drawingPaint(this.penbarDraw, 'strokes')[0]?.value]}
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
            .value=${live(this.penbarDraw.strokeWidth)}
            step="0.1"
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
            .value=${live(
              drawingPaint(this.penbarDraw, 'strokes')[0]?.opacity ?? 1,
            )}
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
                style="width: 70px;"
                label=${msg(str`Marker start`)}
                .value=${live(
                  (this.penbarDraw as MarkerAttributes).markerStart,
                )}
                @change=${this.handleMarkerStartChanged}
                id="marker-start"
              >
                ${['none', 'line', 'triangle', 'diamond'].map(
                  (markerType) =>
                    html`<sp-menu-item .value=${live(markerType)}
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
                style="width: 70px;"
                label=${msg(str`Marker end`)}
                .value=${live((this.penbarDraw as MarkerAttributes).markerEnd)}
                @change=${this.handleMarkerEndChanged}
                id="marker-end"
              >
                ${['none', 'line', 'triangle', 'diamond'].map(
                  (markerType) =>
                    html`<sp-menu-item .value=${live(markerType)}
                      >${markerType}</sp-menu-item
                    >`,
                )}
              </sp-picker>
            </div>
          `,
        )}
        ${when(this.pen === Pen.DRAW_ICONFONT, () => {
          const p = this.penbarDraw as Partial<
            FillAttributes & StrokeAttributes & IconFontAttributes
          >;
          return html`
            <div>
              <h4
                style="margin: 8px 0 4px; font-size: var(--spectrum-font-size-100);"
              >
                ${msg(str`Icon font`)}
              </h4>
              <ic-spectrum-icon-font-controls
                .iconFontFamily=${p.iconFontFamily}
                .iconFontName=${p.iconFontName}
                instanceId="penbar-draw-iconfont"
                @ic-iconfont-controls-change=${this
                  .handlePenbarIconFontControlsPatch}
              ></ic-spectrum-icon-font-controls>
            </div>
          `;
        })}
        ${when(
          this.pen === Pen.DRAW_ROUGH_RECT,
          () => html`
            <div>
              <sp-field-label for="rough-fill-style"
                >${msg(str`Rough fill style`)}</sp-field-label
              >
              <sp-picker
                label=${msg(str`Rough fill style`)}
                .value=${live(
                  (this.penbarDraw as RoughAttributes).roughFillStyle,
                )}
                @change=${this.handleRoughFillStyleChanged}
                id="rough-fill-style"
              >
                <sp-menu-item value="hachure">Hachure</sp-menu-item>
                <sp-menu-item value="solid">Solid</sp-menu-item>
                <sp-menu-item value="zigzag">Zigzag</sp-menu-item>
                <sp-menu-item value="cross-hatch">Cross hatch</sp-menu-item>
                <sp-menu-item value="dots">Dots</sp-menu-item>
                <sp-menu-item value="dashed">Dashed</sp-menu-item>
                <sp-menu-item value="watercolor">Watercolor</sp-menu-item>
              </sp-picker>
            </div>

            <div class="line">
              <sp-slider
                size="s"
                label=${msg(str`Bowing`)}
                .value=${live((this.penbarDraw as RoughAttributes).roughBowing)}
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
                .value=${live(
                  (this.penbarDraw as RoughAttributes).roughRoughness,
                )}
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
