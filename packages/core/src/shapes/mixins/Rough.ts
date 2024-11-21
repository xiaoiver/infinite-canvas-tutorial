import { Drawable, Options } from 'roughjs/bin/core';
import { GConstructor } from '.';
import { filterUndefined, parsePath } from '../../utils';

export interface IRough
  extends Omit<Options, 'stroke' | 'fill' | 'strokeWidth'> {
  /**
   * An optional numeric value that sets the seed for creating random values used in shape generation. This is useful for creating the exact shape when re-generating with the same parameters. The value of seed is between 1 and 2^31.
   * If seed is not defined, or set to 0, no seed is used when computing random values.
   * @see https://github.com/rough-stuff/rough/wiki#seed
   */
  seed: Options['seed'];

  /**
   * Numerical value indicating how rough the drawing is. A rectangle with the roughness of 0 would be a perfect rectangle. Default value is 1.
   * There is no upper limit to this value, but a value over 10 is mostly useless.
   * @see https://github.com/rough-stuff/rough/wiki#roughness
   */
  roughness: Options['roughness'];

  /**
   * Numerical value indicating how curvy the lines are when drawing a sketch. A value of 0 will cause straight lines. Default value is 1.
   * @see https://github.com/rough-stuff/rough/wiki#bowing
   */
  bowing: Options['bowing'];

  /**
   * Rough.js supports the following styles (Default value is hachure):
   * * hachure draws sketchy parallel lines with the same roughness as defined by the roughness and the bowing properties of the shape. It can be further configured using the fillWeight, hachureAngle, and hachureGap properties.
   * * solid is more like a conventional fill.
   * * zigzag draws zig-zag lines filling the shape
   * * cross-hatch Similar to hachure, but draws cross hatch lines (akin to two hachure fills 90 degrees from each other).
   * * dots Fills the shape with sketchy dots.
   * * dashed Similar to hachure but the individual lines are dashed. Dashes can be configured using the dashOffset and dashGap properties.
   * * zigzag-line Similar to hachure but individual lines are drawn in a zig-zag fashion. The size of the zig-zag can be configured using the zigzagOffset proeprty
   * @see https://github.com/rough-stuff/rough/wiki#fillstyle
   */
  fillStyle:
    | 'hachure'
    | 'solid'
    | 'zigzag'
    | 'cross-hatch'
    | 'dots'
    | 'dashed'
    | 'zigzag-line';

  /**
   * Numeric value representing the width of the hachure lines. Default value of the fillWeight is set to half the strokeWidth of that shape.
   * When using dots styles to fill the shape, this value represents the diameter of the dot.
   * @see https://github.com/rough-stuff/rough/wiki#fillweight
   */
  fillWeight: Options['fillWeight'];

  /**
   * Numerical value (in degrees) that defines the angle of the hachure lines. Default value is -41 degrees.
   * @see https://github.com/rough-stuff/rough/wiki#hachureangle
   */
  hachureAngle: Options['hachureAngle'];

  /**
   * Numerical value that defines the average gap, in pixels, between two hachure lines.
   * Default value of the hachureGap is set to four times the strokeWidth of that shape.
   * @see https://github.com/rough-stuff/rough/wiki#hachuregap
   */
  hachureGap: Options['hachureGap'];

  /**
   * When drawing ellipses, circles, and arcs, RoughJS approximates curveStepCount number of points to estimate the shape. Default value is 9.
   * @see https://github.com/rough-stuff/rough/wiki#curvestepcount
   */
  curveStepCount: Options['curveStepCount'];

  /**
   * When drawing ellipses, circles, and arcs, Let RoughJS know how close should the rendered dimensions be when compared to the specified one. Default value is 0.95 - which means the rendered dimensions will be at least 95% close to the specified dimensions.
   * A value of 1 will ensure that the dimensions are almost 100% accurate.
   * @see https://github.com/rough-stuff/rough/wiki#curvefitting
   */
  curveFitting: Options['curveFitting'];

  // TODO: strokeLineDash and strokeDashOffset are not supported yet

  /**
   * This property is similar to the strokeLineDash property but it affects the fills, not the stroke. eg. when you want hachure lines to be dashed.
   * @see https://github.com/rough-stuff/rough/wiki#filllinedash
   */
  fillLineDash: Options['fillLineDash'];

  /**
   * This property is similar to the strokeLineDashOffset property but it affects the fills, not the stroke.
   * @see https://github.com/rough-stuff/rough/wiki#filllinedashoffset
   */
  fillLineDashOffset: Options['fillLineDashOffset'];

  /**
   * If this property is set to true, roughjs does not apply multiple strokes to sketch the shape.
   * @see https://github.com/rough-stuff/rough/wiki#disablemultistroke
   */
  disableMultiStroke: Options['disableMultiStroke'];

  /**
   * If this property is set to true, roughjs does not apply multiple strokes to sketch the hachure lines to fill the shape.
   * @see https://github.com/rough-stuff/rough/wiki#disablemultistrokefill
   */
  disableMultiStrokeFill: Options['disableMultiStrokeFill'];

  /**
   * When drawing paths using SVG path instructions, simplification can be set to simplify the shape by the specified factor. The value can be between 0 and 1.
   * @see https://github.com/rough-stuff/rough/wiki#simplification
   */
  simplification: Options['simplification'];

  /**
   * When filling a shape using the dashed style, this property indicates the nominal length of dash (in pixels). If not set, it defaults to the hachureGap value.
   * @see https://github.com/rough-stuff/rough/wiki#dashoffset
   */
  dashOffset: Options['dashOffset'];

  /**
   * When filling a shape using the dashed style, this property indicates the nominal gap between dashes (in pixels). If not set, it defaults to the hachureGap value.
   * @see https://github.com/rough-stuff/rough/wiki#dashgap
   */
  dashGap: Options['dashGap'];

  /**
   * When filling a shape using the zigzag-line style, this property indicates the nominal width of the zig-zag triangle in each line. If not set, it defaults to the hachureGap value.
   * @see https://github.com/rough-stuff/rough/wiki#zigzagoffset
   */
  zigzagOffset: Options['zigzagOffset'];

  /**
   * When randomizing shapes do not randomize locations of the end points. e.g. end points of line or a curve. Boolean value, defaults to false
   * @see https://github.com/rough-stuff/rough/wiki#preservevertices
   */
  preserveVertices: Options['preserveVertices'];
}

export function Rough<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  abstract class Rough extends Base implements IRough {
    strokePoints: [number, number][][] = [];
    fillPoints: [number, number][][] = [];
    fillPathPoints: [number, number][][] = [];
    drawableSets: Drawable['sets'];

    #roughness: IRough['roughness'];
    #bowing: IRough['bowing'];
    #fillStyle: IRough['fillStyle'];
    #seed: IRough['seed'];
    #fillWeight: IRough['fillWeight'];
    #hachureAngle: IRough['hachureAngle'];
    #hachureGap: IRough['hachureGap'];
    #curveStepCount: IRough['curveStepCount'];
    #curveFitting: IRough['curveFitting'];
    #disableMultiStroke: IRough['disableMultiStroke'];
    #disableMultiStrokeFill: IRough['disableMultiStrokeFill'];
    #simplification: IRough['simplification'];
    #dashOffset: IRough['dashOffset'];
    #dashGap: IRough['dashGap'];
    #zigzagOffset: IRough['zigzagOffset'];
    #preserveVertices: IRough['preserveVertices'];
    #fillLineDash: IRough['fillLineDash'];
    #fillLineDashOffset: IRough['fillLineDashOffset'];

    constructor(attributes: Partial<IRough> = {}) {
      super(attributes);

      const {
        seed,
        bowing,
        roughness,
        fillStyle,
        fillWeight,
        hachureAngle,
        hachureGap,
        curveStepCount,
        curveFitting,
        disableMultiStroke,
        disableMultiStrokeFill,
        simplification,
        dashOffset,
        dashGap,
        zigzagOffset,
        preserveVertices,
        fillLineDash,
        fillLineDashOffset,
      } = attributes;

      this.#seed = seed ?? 1;
      this.#bowing = bowing ?? 1;
      this.#roughness = roughness ?? 1;
      this.#fillStyle = fillStyle ?? 'hachure';
      this.#fillWeight = fillWeight;
      this.#hachureAngle = hachureAngle ?? -41;
      this.#hachureGap = hachureGap;
      this.#curveStepCount = curveStepCount ?? 9;
      this.#curveFitting = curveFitting ?? 0.95;
      this.#disableMultiStroke = disableMultiStroke;
      this.#disableMultiStrokeFill = disableMultiStrokeFill;
      this.#simplification = simplification ?? 0;
      this.#dashOffset = dashOffset;
      this.#dashGap = dashGap;
      this.#zigzagOffset = zigzagOffset;
      this.#preserveVertices = preserveVertices;
      this.#fillLineDash = fillLineDash;
      this.#fillLineDashOffset = fillLineDashOffset;

      this.generate();
    }

    get seed() {
      return this.#seed;
    }
    set seed(seed: number) {
      if (this.#seed !== seed) {
        this.#seed = seed;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get roughness() {
      return this.#roughness;
    }
    set roughness(roughness: number) {
      if (this.#roughness !== roughness) {
        this.#roughness = roughness;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get bowing() {
      return this.#bowing;
    }
    set bowing(bowing: number) {
      if (this.#bowing !== bowing) {
        this.#bowing = bowing;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get fillStyle() {
      return this.#fillStyle;
    }
    set fillStyle(fillStyle: IRough['fillStyle']) {
      if (this.#fillStyle !== fillStyle) {
        this.#fillStyle = fillStyle;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get fillWeight() {
      return this.#fillWeight;
    }
    set fillWeight(fillWeight: number) {
      if (this.#fillWeight !== fillWeight) {
        this.#fillWeight = fillWeight;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get hachureAngle() {
      return this.#hachureAngle;
    }
    set hachureAngle(hachureAngle: number) {
      if (this.#hachureAngle !== hachureAngle) {
        this.#hachureAngle = hachureAngle;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get hachureGap() {
      return this.#hachureGap;
    }
    set hachureGap(hachureGap: number) {
      if (this.#hachureGap !== hachureGap) {
        this.#hachureGap = hachureGap;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get curveStepCount() {
      return this.#curveStepCount;
    }
    set curveStepCount(curveStepCount: number) {
      if (this.#curveStepCount !== curveStepCount) {
        this.#curveStepCount = curveStepCount;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get curveFitting() {
      return this.#curveFitting;
    }
    set curveFitting(curveFitting: number) {
      if (this.#curveFitting !== curveFitting) {
        this.#curveFitting = curveFitting;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get disableMultiStroke() {
      return this.#disableMultiStroke;
    }
    set disableMultiStroke(disableMultiStroke: boolean) {
      if (this.#disableMultiStroke !== disableMultiStroke) {
        this.#disableMultiStroke = disableMultiStroke;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get disableMultiStrokeFill() {
      return this.#disableMultiStrokeFill;
    }
    set disableMultiStrokeFill(disableMultiStrokeFill: boolean) {
      if (this.#disableMultiStrokeFill !== disableMultiStrokeFill) {
        this.#disableMultiStrokeFill = disableMultiStrokeFill;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get simplification() {
      return this.#simplification;
    }
    set simplification(simplification: number) {
      if (this.#simplification !== simplification) {
        this.#simplification = simplification;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get dashOffset() {
      return this.#dashOffset;
    }
    set dashOffset(dashOffset: number) {
      if (this.#dashOffset !== dashOffset) {
        this.#dashOffset = dashOffset;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get dashGap() {
      return this.#dashGap;
    }
    set dashGap(dashGap: number) {
      if (this.#dashGap !== dashGap) {
        this.#dashGap = dashGap;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get zigzagOffset() {
      return this.#zigzagOffset;
    }
    set zigzagOffset(zigzagOffset: number) {
      if (this.#zigzagOffset !== zigzagOffset) {
        this.#zigzagOffset = zigzagOffset;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get preserveVertices() {
      return this.#preserveVertices;
    }
    set preserveVertices(preserveVertices: boolean) {
      if (this.#preserveVertices !== preserveVertices) {
        this.#preserveVertices = preserveVertices;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get fillLineDash() {
      return this.#fillLineDash;
    }
    set fillLineDash(fillLineDash: number[]) {
      if (
        !this.#fillLineDash?.length ||
        !this.#fillLineDash.every((dash, index) => dash === fillLineDash[index])
      ) {
        this.#fillLineDash = fillLineDash;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get fillLineDashOffset() {
      return this.#fillLineDashOffset;
    }
    set fillLineDashOffset(fillLineDashOffset: number) {
      if (this.#fillLineDashOffset !== fillLineDashOffset) {
        this.#fillLineDashOffset = fillLineDashOffset;
        this.renderDirtyFlag = true;
        this.geometryDirtyFlag = true;
        this.generate();
      }
    }

    get roughOptions(): Options {
      const {
        fill,
        stroke,
        strokeWidth,
        seed,
        bowing,
        roughness,
        fillStyle,
        fillWeight,
        hachureAngle,
        hachureGap,
        curveStepCount,
        curveFitting,
        disableMultiStroke,
        disableMultiStrokeFill,
        simplification,
        dashOffset,
        dashGap,
        zigzagOffset,
        preserveVertices,
        strokeDasharray,
        strokeDashoffset,
        fillLineDash,
        fillLineDashOffset,
      } = this;
      return filterUndefined({
        fill: fill as string,
        stroke,
        strokeWidth,
        seed,
        bowing,
        roughness,
        fillStyle,
        fillWeight,
        hachureAngle,
        hachureGap,
        curveStepCount,
        curveFitting,
        disableMultiStroke,
        disableMultiStrokeFill,
        simplification,
        dashOffset,
        dashGap,
        zigzagOffset,
        preserveVertices,
        strokeLineDash: strokeDasharray,
        strokeLineDashOffset: strokeDashoffset,
        fillLineDash,
        fillLineDashOffset,
      });
    }

    /**
     * generate rough shape
     */
    generate() {
      const drawable = this.generateDrawable();

      this.drawableSets = drawable.sets;
      this.strokePoints = [];
      this.fillPoints = [];
      this.fillPathPoints = [];

      this.drawableSets.forEach((set) => {
        const { subPaths } = parsePath(set);
        const points = subPaths.map((subPath) =>
          subPath
            .getPoints()
            .map((point) => [point[0], point[1]] as [number, number]),
        );

        if (set.type === 'path') {
          this.strokePoints = points;
        } else if (set.type === 'fillPath') {
          this.fillPathPoints = points;
        } else if (set.type === 'fillSketch') {
          this.fillPoints = points;
        }
      });
    }

    abstract generateDrawable(): Drawable;
  }
  return Rough;
}
