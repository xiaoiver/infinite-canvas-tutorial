import * as d3 from 'd3-color';
import { Shape, ShapeAttributes, isFillOrStrokeAffected } from './Shape';
import { distanceBetweenPoints } from '../utils';
import { AABB } from './AABB';

export interface CircleAttributes extends ShapeAttributes {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
}

export class Circle extends Shape {
  #cx: number;
  #cy: number;
  #r: number;
  #fill: string;
  #fillRGB: d3.RGBColor;
  #stroke: string;
  #strokeRGB: d3.RGBColor;
  #strokeWidth: number;
  #opacity: number;
  #fillOpacity: number;
  #strokeOpacity: number;

  constructor(config: Partial<CircleAttributes> = {}) {
    super(config);

    const {
      cx,
      cy,
      r,
      fill,
      stroke,
      strokeWidth,
      opacity,
      fillOpacity,
      strokeOpacity,
    } = config;

    this.cx = cx ?? 0;
    this.cy = cy ?? 0;
    this.r = r ?? 0;
    this.fill = fill ?? 'black';
    this.stroke = stroke ?? 'black';
    this.strokeWidth = strokeWidth ?? 0;
    this.opacity = opacity ?? 1;
    this.fillOpacity = fillOpacity ?? 1;
    this.strokeOpacity = strokeOpacity ?? 1;
  }

  get cx() {
    return this.#cx;
  }

  set cx(cx: number) {
    if (this.#cx !== cx) {
      this.#cx = cx;
      this.renderDirtyFlag = true;
    }
  }

  get cy() {
    return this.#cy;
  }

  set cy(cy: number) {
    if (this.#cy !== cy) {
      this.#cy = cy;
      this.renderDirtyFlag = true;
    }
  }

  get r() {
    return this.#r;
  }

  set r(r: number) {
    if (this.#r !== r) {
      this.#r = r;
      this.renderDirtyFlag = true;
    }
  }

  get fill() {
    return this.#fill;
  }

  set fill(fill: string) {
    if (this.#fill !== fill) {
      this.#fill = fill;
      this.#fillRGB = d3.rgb(fill);
      this.renderDirtyFlag = true;
    }
  }

  get fillRGB() {
    return this.#fillRGB;
  }

  get stroke() {
    return this.#stroke;
  }

  set stroke(stroke: string) {
    if (this.#stroke !== stroke) {
      this.#stroke = stroke;
      this.#strokeRGB = d3.rgb(stroke);
      this.renderDirtyFlag = true;
    }
  }

  get strokeRGB() {
    return this.#strokeRGB;
  }

  get strokeWidth() {
    return this.#strokeWidth;
  }

  set strokeWidth(strokeWidth: number) {
    if (this.#strokeWidth !== strokeWidth) {
      this.#strokeWidth = strokeWidth;
      this.renderDirtyFlag = true;
    }
  }

  get opacity() {
    return this.#opacity;
  }

  set opacity(opacity: number) {
    if (this.#opacity !== opacity) {
      this.#opacity = opacity;
      this.renderDirtyFlag = true;
    }
  }

  get fillOpacity() {
    return this.#fillOpacity;
  }

  set fillOpacity(fillOpacity: number) {
    if (this.#fillOpacity !== fillOpacity) {
      this.#fillOpacity = fillOpacity;
      this.renderDirtyFlag = true;
    }
  }

  get strokeOpacity() {
    return this.#strokeOpacity;
  }

  set strokeOpacity(strokeOpacity: number) {
    if (this.#strokeOpacity !== strokeOpacity) {
      this.#strokeOpacity = strokeOpacity;
      this.renderDirtyFlag = true;
    }
  }

  containsPoint(x: number, y: number) {
    const halfLineWidth = this.#strokeWidth / 2;
    const absDistance = distanceBetweenPoints(this.#cx, this.#cy, x, y);

    const [hasFill, hasStroke] = isFillOrStrokeAffected(
      this.pointerEvents,
      this.#fill,
      this.#stroke,
    );
    if (hasFill) {
      return absDistance <= this.#r;
    }
    if (hasStroke) {
      return (
        absDistance >= this.#r - halfLineWidth &&
        absDistance <= this.#r + halfLineWidth
      );
    }
    return false;
  }

  getGeometryBounds() {
    if (this.geometryBoundsDirtyFlag) {
      this.geometryBoundsDirtyFlag = false;
      this.geometryBounds = new AABB(
        this.#cx - this.#r,
        this.#cy - this.#r,
        this.#cx + this.#r,
        this.#cy + this.#r,
      );
    }
    return this.geometryBounds;
  }

  getRenderBounds() {
    if (this.renderBoundsDirtyFlag) {
      const halfLineWidth = this.#strokeWidth / 2;
      this.renderBoundsDirtyFlag = false;
      this.renderBounds = new AABB(
        this.#cx - this.#r - halfLineWidth,
        this.#cy - this.#r - halfLineWidth,
        this.#cx + this.#r + halfLineWidth,
        this.#cy + this.#r + halfLineWidth,
      );
    }
    return this.renderBounds;
  }
}
