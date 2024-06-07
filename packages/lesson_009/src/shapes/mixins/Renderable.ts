import * as d3 from 'd3-color';
import { AABB } from '../AABB';

export class Renderable {
  /**
   * Whether this object is renderable.
   */
  renderable: boolean;

  /**
   * Avoid unnecessary work like updating Buffer by deferring it until needed.
   * @see https://gameprogrammingpatterns.com/dirty-flag.html
   */
  renderDirtyFlag = true;

  /**
   * The bounding box of the render.
   */
  protected renderBounds: AABB;
  renderBoundsDirtyFlag = true;

  /**
   * Account for its children.
   */
  protected bounds: AABB;
  boundsDirtyFlag = true;

  #fill: string;
  #fillRGB: d3.RGBColor;
  #stroke: string;
  #strokeRGB: d3.RGBColor;
  #strokeWidth: number;
  #opacity: number;
  #fillOpacity: number;
  #strokeOpacity: number;

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
      this.renderBoundsDirtyFlag = true;
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
}