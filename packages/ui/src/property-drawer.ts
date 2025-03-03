import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { choose } from 'lit/directives/choose.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import {
  Shape,
  Circle,
  Ellipse,
  Rect,
  Polyline,
  Path,
  Text,
  RoughCircle,
  RoughEllipse,
  RoughRect,
  RoughPolyline,
  RoughPath,
  type Canvas,
} from '@infinite-canvas-tutorial/core';

import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/details/details.js';

const shapeNames = new WeakMap();
shapeNames.set(Circle, 'Circle');
shapeNames.set(Ellipse, 'Ellipse');
shapeNames.set(Rect, 'Rect');
shapeNames.set(Polyline, 'Polyline');
shapeNames.set(Path, 'Path');
shapeNames.set(Text, 'Text');
shapeNames.set(RoughCircle, 'RoughCircle');
shapeNames.set(RoughEllipse, 'RoughEllipse');
shapeNames.set(RoughRect, 'RoughRect');
shapeNames.set(RoughPolyline, 'RoughPolyline');
shapeNames.set(RoughPath, 'RoughPath');

@customElement('ic-property-drawer')
export class PropertyDrawer extends LitElement {
  static styles = css`
    sl-drawer {
      color: var(--sl-color-neutral-600);
    }
    sl-drawer::part(title) {
      padding: 0 8px;
      display: flex;
      align-items: center;
    }
    sl-drawer::part(header) {
      padding: 4px 0;
    }
    sl-drawer::part(header-actions) {
      padding: 0 8px;
    }
    sl-drawer::part(body) {
      padding: 0 8px;
    }

    sl-details {
      margin-bottom: 8px;
    }
    sl-details::part(header) {
      padding: 8px;
    }
    sl-details::part(content) {
      padding: 8px;
      padding-top: 0;
    }

    .group {
      display: flex;
      gap: 8px;
      color: var(--sl-color-neutral-600);
    }

    .group-item {
      flex: 1;
      display: flex;
      align-items: center;
    }

    .group-item > span {
      margin-right: 8px;
      font-size: var(--sl-input-label-font-size-small);
    }

    sl-input {
      min-width: 0;
    }

    sl-range::part(form-control) {
      display: flex;
    }
    sl-range::part(form-control-label) {
      margin-right: 8px;
      font-size: var(--sl-input-label-font-size-small);
      color: var(--sl-color-neutral-600);
    }
  `;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  @state()
  fill: string | ImageBitmap;

  @state()
  fillOpacity: number;

  @state()
  stroke: string;

  @state()
  strokeOpacity: number;

  @state()
  strokeWidth: number;

  @state()
  strokeDashoffset: number;

  @state()
  strokeGap: number;

  @state()
  strokeDash: number;

  @state()
  strokeAlignment: 'inner' | 'center' | 'outer';

  @state()
  strokeLinejoin: 'miter' | 'round' | 'bevel';

  #shape: Shape;

  connectedCallback() {
    super.connectedCallback();

    this.canvas.root.addEventListener('selected', (e: CustomEvent) => {
      const $drawer = this.shadowRoot!.querySelector('sl-drawer');
      const shape = e.detail as Shape;
      this.#shape = shape;

      if (shape.fill instanceof ImageBitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = shape.fill.width;
        canvas.height = shape.fill.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(shape.fill, 0, 0);
        this.fill = canvas.toDataURL();
      } else {
        this.fill = shape.fill as string;
      }

      this.fillOpacity = shape.fillOpacity;
      this.stroke = shape.stroke as string;
      this.strokeOpacity = shape.strokeOpacity;
      this.strokeWidth = shape.strokeWidth;
      this.strokeAlignment = shape.strokeAlignment;
      this.strokeLinejoin = shape.strokeLinejoin;
      this.strokeDashoffset = shape.strokeDashoffset;
      this.strokeDash = shape.strokeDasharray?.[0] || 0;
      this.strokeGap = shape.strokeDasharray?.[1] || 0;

      // @ts-ignore
      $drawer.show();
    });

    this.canvas.root.addEventListener('deselected', (e: CustomEvent) => {
      const $drawer = this.shadowRoot!.querySelector('sl-drawer');
      this.#shape = undefined;
      // @ts-ignore
      $drawer.hide();
    });
  }

  private handleFillChange(e: CustomEvent) {
    const { fill, fillOpacity, fillImage } = e.detail;

    this.fill = fill;
    this.fillOpacity = fillOpacity;
    this.#shape.fill = fillImage || fill;
    this.#shape.fillOpacity = fillOpacity;
    this.dispatchEvent(new CustomEvent('ic-changed'));
  }

  private handleStrokeChange(e: CustomEvent) {
    const { stroke, strokeOpacity } = e.detail;
    this.stroke = stroke;
    this.strokeOpacity = strokeOpacity;
    if (this.#shape) {
      this.#shape.stroke = stroke;
      this.#shape.strokeOpacity = strokeOpacity;
      this.dispatchEvent(new CustomEvent('ic-changed'));
    }
  }

  private handleStrokeWidthChange(e: CustomEvent) {
    const { strokeWidth } = e.detail;
    this.strokeWidth = strokeWidth;
    if (this.#shape) {
      this.#shape.strokeWidth = strokeWidth;
      this.dispatchEvent(new CustomEvent('ic-changed'));
    }
  }

  private handleStrokeAlignmentChange(e: CustomEvent) {
    const { strokeAlignment } = e.detail;
    this.strokeAlignment = strokeAlignment;
    if (this.#shape) {
      this.#shape.strokeAlignment = strokeAlignment;
      this.dispatchEvent(new CustomEvent('ic-changed'));
    }
  }

  private handleStrokeLinejoinChange(e: CustomEvent) {
    const { strokeLinejoin } = e.detail;
    this.strokeLinejoin = strokeLinejoin;
    if (this.#shape) {
      this.#shape.strokeLinejoin = strokeLinejoin;
      this.dispatchEvent(new CustomEvent('ic-changed'));
    }
  }

  private handleStrokeDashChange(e: CustomEvent) {
    const { strokeDash } = e.detail;
    this.strokeDash = strokeDash;
    if (this.#shape) {
      this.#shape.strokeDasharray = [strokeDash, this.strokeGap];
      this.dispatchEvent(new CustomEvent('ic-changed'));
    }
  }

  private handleStrokeGapChange(e: CustomEvent) {
    const { strokeGap } = e.detail;
    this.strokeGap = strokeGap;
    if (this.#shape) {
      this.#shape.strokeDasharray = [this.strokeDash, strokeGap];
      this.dispatchEvent(new CustomEvent('ic-changed'));
    }
  }

  private handleStrokeDashoffsetChange(e: CustomEvent) {
    const { strokeDashoffset } = e.detail;
    this.strokeDashoffset = strokeDashoffset;
    if (this.#shape) {
      this.#shape.strokeDashoffset = strokeDashoffset;
      this.dispatchEvent(new CustomEvent('ic-changed'));
    }
  }

  private handleRChange(e: CustomEvent) {
    const r = (e.target as any).value;
    if (this.#shape) {
      (this.#shape as Ellipse).r = r;
    }
  }
  private handleRxChange(e: CustomEvent) {
    const r = (e.target as any).value;
    if (this.#shape) {
      (this.#shape as Ellipse).rx = r;
    }
  }
  private handleRyChange(e: CustomEvent) {
    const r = (e.target as any).value;
    if (this.#shape) {
      (this.#shape as Ellipse).ry = r;
    }
  }
  private handleWidthChange(e: CustomEvent) {
    const width = (e.target as any).value;
    if (this.#shape) {
      (this.#shape as Rect).width = width;
    }
  }
  private handleHeightChange(e: CustomEvent) {
    const height = (e.target as any).value;
    if (this.#shape) {
      (this.#shape as Rect).height = height;
    }
  }

  render() {
    const shapeName = shapeNames.get(this.#shape?.constructor) || 'Shape';

    const circle = html`<div class="group">
        <sl-input
          size="small"
          type="number"
          label="cx"
          value=${(this.#shape as Ellipse)?.cx}
        ></sl-input>
        <sl-input
          size="small"
          type="number"
          label="cy"
          value=${(this.#shape as Ellipse)?.cy}
        ></sl-input>
      </div>
      <sl-input
        size="small"
        type="number"
        label="r"
        value=${(this.#shape as Ellipse)?.r}
        @sl-input=${this.handleRChange}
      ></sl-input> `;
    const ellipse = html` <div class="group">
        <sl-input
          size="small"
          type="number"
          label="cx"
          value=${(this.#shape as Ellipse)?.cx}
        ></sl-input>
        <sl-input
          size="small"
          type="number"
          label="cy"
          value=${(this.#shape as Ellipse)?.cy}
        ></sl-input>
      </div>
      <sl-input
        size="small"
        type="number"
        label="rx"
        value=${(this.#shape as Ellipse)?.rx}
        @sl-input=${this.handleRxChange}
      ></sl-input>
      <sl-input
        size="small"
        type="number"
        label="ry"
        value=${(this.#shape as Ellipse)?.ry}
        @sl-input=${this.handleRyChange}
      ></sl-input>`;

    const rect = html` <div class="group">
        <sl-input
          size="small"
          type="number"
          label="x"
          value=${(this.#shape as Rect)?.x}
        ></sl-input>
        <sl-input
          size="small"
          type="number"
          label="y"
          value=${(this.#shape as Rect)?.y}
        ></sl-input>
      </div>
      <sl-input
        size="small"
        type="number"
        label="width"
        value=${(this.#shape as Rect)?.width}
        @sl-input=${this.handleWidthChange}
      ></sl-input>
      <sl-input
        size="small"
        type="number"
        label="height"
        value=${(this.#shape as Rect)?.height}
        @sl-input=${this.handleHeightChange}
      ></sl-input>`;

    return html`
      <sl-drawer label=${shapeName} contained style="--size: 320px;">
        <sl-details summary="Fill" open>
          <ic-fill-panel
            fill=${this.fill}
            fillOpacity=${this.fillOpacity}
            @fillchanged=${this.handleFillChange}
          ></ic-fill-panel>
        </sl-details>
        <sl-details summary="Stroke">
          <ic-stroke-panel
            stroke=${this.stroke}
            strokeOpacity=${this.strokeOpacity}
            strokeWidth=${this.strokeWidth}
            strokeAlignment=${this.strokeAlignment}
            strokeLinejoin=${this.strokeLinejoin}
            strokeDash=${this.strokeDash}
            strokeGap=${this.strokeGap}
            strokeDashoffset=${this.strokeDashoffset}
            @strokechanged=${this.handleStrokeChange}
            @strokewidthchanged=${this.handleStrokeWidthChange}
            @strokealignmentchanged=${this.handleStrokeAlignmentChange}
            @strokelinejoinchanged=${this.handleStrokeLinejoinChange}
            @strokedashchanged=${this.handleStrokeDashChange}
            @strokestrokegapchanged=${this.handleStrokeGapChange}
            @strokedashoffsetchanged=${this.handleStrokeDashoffsetChange}
          ></ic-stroke-panel>
        </sl-details>
        <sl-divider></sl-divider>
        ${choose(shapeName, [
          ['Circle', () => circle],
          ['RoughCircle', () => circle],
          ['Ellipse', () => ellipse],
          ['RoughEllipse', () => ellipse],
          ['Rect', () => rect],
          ['RoughRect', () => rect],
        ])}
        <sl-divider></sl-divider>
      </sl-drawer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-property-drawer': PropertyDrawer;
  }
}
