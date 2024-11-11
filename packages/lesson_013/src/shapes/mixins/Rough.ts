import { Drawable, Options } from 'roughjs/bin/core';
import { GConstructor } from '.';
import { parsePath } from '../../utils';

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
}

export function Rough<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  abstract class Rough extends Base implements IRough {
    strokePoints: [number, number][][] = [];
    fillPoints: [number, number][][] = [];
    fillPathPoints: [number, number][][] = [];

    #roughness: IRough['roughness'];
    #bowing: IRough['bowing'];
    #fillStyle: IRough['fillStyle'];
    #seed: IRough['seed'];
    #fillWeight: IRough['fillWeight'];

    constructor(attributes: Partial<IRough> = {}) {
      super(attributes);

      const { seed, bowing, roughness, fillStyle, fillWeight } = attributes;

      this.#seed = seed ?? 1;
      this.#bowing = bowing;
      this.#roughness = roughness;
      this.#fillStyle = fillStyle;
      this.#fillWeight = fillWeight;

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

    /**
     * generate rough shape
     */
    generate() {
      const drawable = this.generateDrawable();

      this.strokePoints = [];
      this.fillPoints = [];
      this.fillPathPoints = [];

      drawable.sets.forEach((set) => {
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
