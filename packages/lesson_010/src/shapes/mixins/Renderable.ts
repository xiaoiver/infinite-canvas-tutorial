import * as d3 from 'd3-color';
import { AABB } from '../AABB';
import { GConstructor } from '.';
import { isString } from '../../utils';

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
   *
   * Enhanced with the following features:
   * * base64 image is also supported.
   * * HTMLImageElement is also supported.
   */
  fill: string | TexImageSource;

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
   * This property allows to align a stroke along the outline of the current object.
   * @see https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
   *
   * * `center`: This value indicates that the stroke for each subpath is positioned along the outline of the current stroke. The extends of the stroke increase to both sides of the outline accordingly dependent on the `stroke-width`.
   * * `inner`: This value indicates that the stroke area is defined by the outline of each subpath of the current object and the computed value of the `stroke-width` property as offset orthogonal from the outline into the fill area of each subpath. The `stroke-linejoin` property must be ignored.
   * * `outer`: This value indicates that the stroke area is defined by the outline of each subpath of the current object and the computed value of the `stroke-width` property as offset orthogonal from the outline away from the fill area of each subpath.
   */
  strokeAlignment: 'center' | 'inner' | 'outer';

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

  /**
   * Specifies color for the shadow.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow#color
   */
  dropShadowColor: string;
  dropShadowColorRGB: d3.RGBColor;

  /**
   * Horizontal offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowOffsetX: number;

  /**
   * Vertical offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowOffsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed. If not specified, it will be set to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowBlurRadius: number;

  /**
   * Specifies color for the inner shadow.
   */
  innerShadowColor: string;
  innerShadowColorRGB: d3.RGBColor;

  /**
   * Horizontal offset
   */
  innerShadowOffsetX: number;

  /**
   * Vertical offset
   */
  innerShadowOffsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed. If not specified, it will be set to `0`.
   */
  innerShadowBlurRadius: number;
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

    #fill: string | TexImageSource;
    #fillRGB: d3.RGBColor;
    #stroke: string;
    #strokeRGB: d3.RGBColor;
    #strokeWidth: number;
    #strokeAlignment: 'center' | 'inner' | 'outer';
    #opacity: number;
    #fillOpacity: number;
    #strokeOpacity: number;
    #innerShadowColor: string;
    #innerShadowColorRGB: d3.RGBColor;
    #innerShadowOffsetX: number;
    #innerShadowOffsetY: number;
    #innerShadowBlurRadius: number;

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
          | 'strokeAlignment'
          | 'innerShadowColor'
          | 'innerShadowOffsetX'
          | 'innerShadowOffsetY'
          | 'innerShadowBlurRadius'
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
        strokeAlignment,
        opacity,
        fillOpacity,
        strokeOpacity,
        innerShadowColor,
        innerShadowOffsetX,
        innerShadowOffsetY,
        innerShadowBlurRadius,
      } = attributes;

      this.renderable = renderable ?? true;
      this.visible = visible ?? true;
      this.cullable = cullable ?? true;
      this.batchable = batchable ?? true;
      this.fill = fill ?? 'black';
      this.stroke = stroke ?? 'black';
      this.strokeWidth = strokeWidth ?? 0;
      this.strokeAlignment = strokeAlignment ?? 'center';
      this.opacity = opacity ?? 1;
      this.fillOpacity = fillOpacity ?? 1;
      this.strokeOpacity = strokeOpacity ?? 1;
      this.innerShadowColor = innerShadowColor ?? 'black';
      this.innerShadowOffsetX = innerShadowOffsetX ?? 0;
      this.innerShadowOffsetY = innerShadowOffsetY ?? 0;
      this.innerShadowBlurRadius = innerShadowBlurRadius ?? 0;
    }

    get fill() {
      return this.#fill;
    }
    set fill(fill: string | TexImageSource) {
      if (this.#fill !== fill) {
        this.#fill = fill;

        if (isString(fill)) {
          this.#fillRGB = d3.rgb(fill);
        } else {
          // if (!fill.complete) {
          //   fill.onload = () => {
          //     this.renderDirtyFlag = true;
          //   };
          // }
        }
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

    get strokeAlignment() {
      return this.#strokeAlignment;
    }
    set strokeAlignment(strokeAlignment: 'center' | 'inner' | 'outer') {
      if (this.#strokeAlignment !== strokeAlignment) {
        this.#strokeAlignment = strokeAlignment;
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

    get innerShadowColor() {
      return this.#innerShadowColor;
    }
    set innerShadowColor(innerShadowColor: string) {
      if (this.#innerShadowColor !== innerShadowColor) {
        this.#innerShadowColor = innerShadowColor;
        this.#innerShadowColorRGB = d3.rgb(innerShadowColor);
        this.renderDirtyFlag = true;
      }
    }

    get innerShadowColorRGB() {
      return this.#innerShadowColorRGB;
    }

    get innerShadowOffsetX() {
      return this.#innerShadowOffsetX;
    }
    set innerShadowOffsetX(innerShadowOffsetX: number) {
      if (this.#innerShadowOffsetX !== innerShadowOffsetX) {
        this.#innerShadowOffsetX = innerShadowOffsetX;
        this.renderDirtyFlag = true;
      }
    }

    get innerShadowOffsetY() {
      return this.#innerShadowOffsetY;
    }
    set innerShadowOffsetY(innerShadowOffsetY: number) {
      if (this.#innerShadowOffsetY !== innerShadowOffsetY) {
        this.#innerShadowOffsetY = innerShadowOffsetY;
        this.renderDirtyFlag = true;
      }
    }

    get innerShadowBlurRadius() {
      return this.#innerShadowBlurRadius;
    }
    set innerShadowBlurRadius(innerShadowBlurRadius: number) {
      if (this.#innerShadowBlurRadius !== innerShadowBlurRadius) {
        this.#innerShadowBlurRadius = innerShadowBlurRadius;
        this.renderDirtyFlag = true;
      }
    }
  };
}
