import * as d3 from 'd3-color';
import { AABB } from '../AABB';
import { GConstructor } from '.';

export interface IRenderable {
  /**
   * Whether this object is renderable.
   */
  renderable: boolean;

  visible: boolean;

  cullable: boolean;

  batchable: boolean;

  culled: boolean;

  globalRenderOrder: number;

  /**
   * Avoid unnecessary work like updating Buffer by deferring it until needed.
   * @see https://gameprogrammingpatterns.com/dirty-flag.html
   */
  renderDirtyFlag: boolean;

  /**
   * The bounding box of the render.
   */
  renderBounds: AABB;

  renderBoundsDirtyFlag: boolean;

  /**
   * Account for its children.
   */
  bounds: AABB;
  boundsDirtyFlag: boolean;

  /**
   * It's a presentation attribute that defines the color used to paint the element.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill
   */
  fill: string;

  /**
   * It is a presentation attribute defining the color used to paint the outline of the shape.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke
   */
  stroke: string;

  /**
   * It is a presentation attribute defining the width of the stroke to be applied to the shape.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-width
   */
  strokeWidth: number;

  /**
   * It specifies the transparency of an object or of a group of objects,
   * that is, the degree to which the background behind the element is overlaid.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/opacity
   */
  opacity: number;

  /**
   * It is a presentation attribute defining the opacity of the paint server (color, gradient, pattern, etc.) applied to a shape.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-opacity
   */
  fillOpacity: number;

  /**
   * It is a presentation attribute defining the opacity of the paint server (color, gradient, pattern, etc.) applied to the stroke of a shape.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-opacity
   */
  strokeOpacity: number;

  fillRGB: d3.RGBColor;
  strokeRGB: d3.RGBColor;
}

export function Renderable<TBase extends GConstructor>(Base: TBase) {
  // @ts-ignore
  return class Renderable extends Base implements IRenderable {
    renderable: boolean;
    visible: boolean;
    cullable: boolean;
    culled: boolean;
    batchable: boolean;
    renderDirtyFlag = true;
    renderBounds: AABB;
    renderBoundsDirtyFlag = true;
    bounds: AABB;
    boundsDirtyFlag = true;
    globalRenderOrder: number;

    #fill: string;
    #fillRGB: d3.RGBColor;
    #stroke: string;
    #strokeRGB: d3.RGBColor;
    #strokeWidth: number;
    #opacity: number;
    #fillOpacity: number;
    #strokeOpacity: number;

    constructor(
      attributes: Partial<
        Pick<
          IRenderable,
          | 'fill'
          | 'stroke'
          | 'strokeOpacity'
          | 'opacity'
          | 'fillOpacity'
          | 'renderable'
          | 'cullable'
          | 'batchable'
          | 'visible'
          | 'strokeWidth'
        >
      > = {},
    ) {
      super(attributes);

      const {
        renderable,
        visible,
        cullable,
        batchable,
        fill,
        stroke,
        strokeWidth,
        opacity,
        fillOpacity,
        strokeOpacity,
      } = attributes;

      this.renderable = renderable ?? true;
      this.visible = visible ?? true;
      this.cullable = cullable ?? true;
      this.batchable = batchable ?? true;
      this.fill = fill ?? 'black';
      this.stroke = stroke ?? 'black';
      this.strokeWidth = strokeWidth ?? 0;
      this.opacity = opacity ?? 1;
      this.fillOpacity = fillOpacity ?? 1;
      this.strokeOpacity = strokeOpacity ?? 1;
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
  };
}
