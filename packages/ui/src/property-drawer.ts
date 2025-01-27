import * as d3 from 'd3-color';
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
  RoughCircle,
  RoughEllipse,
  RoughRect,
  RoughPolyline,
  RoughPath,
  type Canvas,
} from '@infinite-canvas-tutorial/core';

import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/color-picker/color-picker.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';

const shapeNames = new WeakMap();
shapeNames.set(Circle, 'Circle');
shapeNames.set(Ellipse, 'Ellipse');
shapeNames.set(Rect, 'Rect');
shapeNames.set(Polyline, 'Polyline');
shapeNames.set(Path, 'Path');
shapeNames.set(RoughCircle, 'RoughCircle');
shapeNames.set(RoughEllipse, 'RoughEllipse');
shapeNames.set(RoughRect, 'RoughRect');
shapeNames.set(RoughPolyline, 'RoughPolyline');
shapeNames.set(RoughPath, 'RoughPath');

@customElement('ic-property-drawer')
export class PropertyDrawer extends LitElement {
  static styles = css`
    .group {
      display: flex;
      gap: 8px;
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
    }
  `;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  @state()
  shape: Shape;

  connectedCallback() {
    super.connectedCallback();

    this.canvas.root.addEventListener('selected', (e: CustomEvent) => {
      const $drawer = this.shadowRoot!.querySelector('sl-drawer');
      const shape = e.detail as Shape;
      this.shape = shape;
      // @ts-ignore
      $drawer.show();
    });

    this.canvas.root.addEventListener('deselected', (e: CustomEvent) => {
      const $drawer = this.shadowRoot!.querySelector('sl-drawer');
      this.shape = undefined;
      // @ts-ignore
      $drawer.hide();
    });
  }

  private handleStrokeChange(e: CustomEvent) {
    const { rgb, opacity } = rgbaToRgbAndOpacity(
      (e.target as any).getFormattedValue('rgba') as string,
    );
    if (this.shape) {
      this.shape.stroke = rgb;
      this.shape.strokeOpacity = opacity;
    }
  }

  private handleFillChange(e: CustomEvent) {
    const { rgb, opacity } = rgbaToRgbAndOpacity(
      (e.target as any).getFormattedValue('rgba') as string,
    );
    if (this.shape) {
      this.shape.fill = rgb;
      this.shape.fillOpacity = opacity;
    }
  }

  private handleOpacityChange(e: CustomEvent) {
    const opacity = (e.target as any).value;
    if (this.shape) {
      this.shape.opacity = opacity;
    }
  }

  private handleRChange(e: CustomEvent) {
    const r = (e.target as any).value;
    if (this.shape) {
      (this.shape as Ellipse).r = r;
    }
  }
  private handleRxChange(e: CustomEvent) {
    const r = (e.target as any).value;
    if (this.shape) {
      (this.shape as Ellipse).rx = r;
    }
  }
  private handleRyChange(e: CustomEvent) {
    const r = (e.target as any).value;
    if (this.shape) {
      (this.shape as Ellipse).ry = r;
    }
  }

  render() {
    const shapeName = shapeNames.get(this.shape?.constructor) || 'Shape';

    const circle = html`<div class="group">
        <sl-input
          size="small"
          type="number"
          label="cx"
          value=${(this.shape as Ellipse)?.cx}
        ></sl-input>
        <sl-input
          size="small"
          type="number"
          label="cy"
          value=${(this.shape as Ellipse)?.cy}
        ></sl-input>
      </div>
      <sl-input
        size="small"
        type="number"
        label="r"
        value=${(this.shape as Ellipse)?.r}
        @sl-input=${this.handleRChange}
      ></sl-input> `;
    const ellipse = html` <div class="group">
        <sl-input
          size="small"
          type="number"
          label="cx"
          value=${(this.shape as Ellipse)?.cx}
        ></sl-input>
        <sl-input
          size="small"
          type="number"
          label="cy"
          value=${(this.shape as Ellipse)?.cy}
        ></sl-input>
      </div>
      <sl-input
        size="small"
        type="number"
        label="rx"
        value=${(this.shape as Ellipse)?.rx}
        @sl-input=${this.handleRxChange}
      ></sl-input>
      <sl-input
        size="small"
        type="number"
        label="ry"
        value=${(this.shape as Ellipse)?.ry}
        @sl-input=${this.handleRyChange}
      ></sl-input>`;

    return html`
      <sl-drawer
        label=${shapeName}
        contained
        class="drawer-contained"
        style="--size: 40%;"
      >
        <div class="group">
          <div class="group-item">
            <span>Fill</span>
            <sl-color-picker
              hoist
              size="small"
              value=${rgbAndOpacityToRgba(
                this.shape?.fill as string,
                this.shape?.fillOpacity,
              )}
              @sl-input=${this.handleFillChange}
              opacity
              label="Select a color"
              swatches="#d0021b; #f5a623; #f8e71c; #8b572a; #7ed321; #417505; #bd10e0; #9013fe; #4a90e2; #50e3c2; #b8e986; #000; #444; #888; #ccc; #fff;"
            ></sl-color-picker>
          </div>
          <div class="group-item">
            <span>Stroke</span>
            <sl-color-picker
              hoist
              size="small"
              value=${rgbAndOpacityToRgba(
                this.shape?.stroke,
                this.shape?.strokeOpacity,
              )}
              @sl-input=${this.handleStrokeChange}
              opacity
              label="Select a color"
              swatches="#d0021b; #f5a623; #f8e71c; #8b572a; #7ed321; #417505; #bd10e0; #9013fe; #4a90e2; #50e3c2; #b8e986; #000; #444; #888; #ccc; #fff;"
            ></sl-color-picker>
          </div>
        </div>
        <sl-range
          step="0.1"
          min="0"
          max="1"
          value=${this.shape?.opacity}
          @sl-input=${this.handleOpacityChange}
        >
          <span slot="label">Opacity</span>
        </sl-range>
        <sl-divider></sl-divider>
        ${choose(shapeName, [
          ['Circle', () => circle],
          ['RoughCircle', () => circle],
          ['Ellipse', () => ellipse],
          ['RoughEllipse', () => ellipse],
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

function rgbaToRgbAndOpacity(rgba: string) {
  const { r, g, b, opacity } = d3.rgb(rgba);
  return {
    rgb: `rgb(${r}, ${g}, ${b})`,
    opacity,
  };
}

function rgbAndOpacityToRgba(rgb: string, opacity: number) {
  const { r, g, b } = d3.rgb(rgb);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
