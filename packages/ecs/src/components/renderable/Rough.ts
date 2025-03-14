import { Entity, field, Type } from '@lastolivegames/becsy';
import { Drawable, Options } from 'roughjs/bin/core';
import { Stroke } from './Stroke';
import { FillSolid } from './Fill';
import { filterUndefined } from '../../utils';

export class Rough {
  /**
   * An optional numeric value that sets the seed for creating random values used in shape generation. This is useful for creating the exact shape when re-generating with the same parameters. The value of seed is between 1 and 2^31.
   * If seed is not defined, or set to 0, no seed is used when computing random values.
   *
   * Default to `1`
   * @see https://github.com/rough-stuff/rough/wiki#seed
   */
  @field({ type: Type.float32, default: 1 })
  declare seed: Options['seed'];

  /**
   * Numerical value indicating how rough the drawing is. A rectangle with the roughness of 0 would be a perfect rectangle. Default value is 1.
   * There is no upper limit to this value, but a value over 10 is mostly useless.
   *
   * Default to `1`
   * @see https://github.com/rough-stuff/rough/wiki#roughness
   */
  @field({ type: Type.float32, default: 1 })
  declare roughness: Options['roughness'];

  /**
   * Numerical value indicating how curvy the lines are when drawing a sketch. A value of 0 will cause straight lines. Default value is 1.
   *
   * Default to `1`
   * @see https://github.com/rough-stuff/rough/wiki#bowing
   */
  @field({ type: Type.float32, default: 1 })
  declare bowing: Options['bowing'];

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
  @field({
    type: Type.staticString([
      'hachure',
      'solid',
      'zigzag',
      'cross-hatch',
      'dots',
      'dashed',
      'zigzag-line',
    ]),
    default: 'hachure',
  })
  declare fillStyle:
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
  @field({ type: Type.float32 })
  declare fillWeight: Options['fillWeight'];

  /**
   * Numerical value (in degrees) that defines the angle of the hachure lines. Default value is -41 degrees.
   * @see https://github.com/rough-stuff/rough/wiki#hachureangle
   */
  @field({ type: Type.float32, default: -41 })
  declare hachureAngle: Options['hachureAngle'];

  /**
   * Numerical value that defines the average gap, in pixels, between two hachure lines.
   * Default value of the hachureGap is set to four times the strokeWidth of that shape.
   * @see https://github.com/rough-stuff/rough/wiki#hachuregap
   */
  @field({ type: Type.float32 })
  declare hachureGap: Options['hachureGap'];

  /**
   * When drawing ellipses, circles, and arcs, RoughJS approximates curveStepCount number of points to estimate the shape. Default value is 9.
   * @see https://github.com/rough-stuff/rough/wiki#curvestepcount
   */
  @field({ type: Type.float32, default: 9 })
  declare curveStepCount: Options['curveStepCount'];

  /**
   * When drawing ellipses, circles, and arcs, Let RoughJS know how close should the rendered dimensions be when compared to the specified one. Default value is 0.95 - which means the rendered dimensions will be at least 95% close to the specified dimensions.
   * A value of 1 will ensure that the dimensions are almost 100% accurate.
   * @see https://github.com/rough-stuff/rough/wiki#curvefitting
   */
  @field({ type: Type.float32, default: 0.95 })
  declare curveFitting: Options['curveFitting'];

  // TODO: strokeLineDash and strokeDashOffset are not supported yet

  /**
   * This property is similar to the strokeLineDash property but it affects the fills, not the stroke. eg. when you want hachure lines to be dashed.
   * @see https://github.com/rough-stuff/rough/wiki#filllinedash
   */
  @field({ type: Type.float32 })
  declare fillLineDash: Options['fillLineDash'];

  /**
   * This property is similar to the strokeLineDashOffset property but it affects the fills, not the stroke.
   * @see https://github.com/rough-stuff/rough/wiki#filllinedashoffset
   */
  @field({ type: Type.float32 })
  declare fillLineDashOffset: Options['fillLineDashOffset'];

  /**
   * If this property is set to true, roughjs does not apply multiple strokes to sketch the shape.
   * @see https://github.com/rough-stuff/rough/wiki#disablemultistroke
   */
  @field({ type: Type.boolean, default: false })
  declare disableMultiStroke: Options['disableMultiStroke'];

  /**
   * If this property is set to true, roughjs does not apply multiple strokes to sketch the hachure lines to fill the shape.
   * @see https://github.com/rough-stuff/rough/wiki#disablemultistrokefill
   */
  @field({ type: Type.boolean, default: false })
  declare disableMultiStrokeFill: Options['disableMultiStrokeFill'];

  /**
   * When drawing paths using SVG path instructions, simplification can be set to simplify the shape by the specified factor. The value can be between 0 and 1.
   * @see https://github.com/rough-stuff/rough/wiki#simplification
   */
  @field({ type: Type.float32 })
  declare simplification: Options['simplification'];

  /**
   * When filling a shape using the dashed style, this property indicates the nominal length of dash (in pixels). If not set, it defaults to the hachureGap value.
   * @see https://github.com/rough-stuff/rough/wiki#dashoffset
   */
  @field({ type: Type.float32 })
  declare dashOffset: Options['dashOffset'];

  /**
   * When filling a shape using the dashed style, this property indicates the nominal gap between dashes (in pixels). If not set, it defaults to the hachureGap value.
   * @see https://github.com/rough-stuff/rough/wiki#dashgap
   */
  @field({ type: Type.float32 })
  declare dashGap: Options['dashGap'];

  /**
   * When filling a shape using the zigzag-line style, this property indicates the nominal width of the zig-zag triangle in each line. If not set, it defaults to the hachureGap value.
   * @see https://github.com/rough-stuff/rough/wiki#zigzagoffset
   */
  @field({ type: Type.float32 })
  declare zigzagOffset: Options['zigzagOffset'];

  /**
   * When randomizing shapes do not randomize locations of the end points. e.g. end points of line or a curve. Boolean value, defaults to false
   * @see https://github.com/rough-stuff/rough/wiki#preservevertices
   */
  @field({ type: Type.boolean, default: false })
  declare preserveVertices: Options['preserveVertices'];
}

export class ComputedRough {
  @field({ type: Type.object, default: [] })
  declare strokePoints: [number, number][][];

  @field({ type: Type.object, default: [] })
  declare fillPoints: [number, number][][];

  @field({ type: Type.object, default: [] })
  declare fillPathPoints: [number, number][][];

  @field({ type: Type.object })
  declare drawableSets: Drawable['sets'];
}

export function getRoughOptions(entity: Entity): Options {
  const rough = entity.read(Rough);
  const fillComponent = entity.has(FillSolid)
    ? entity.read(FillSolid)
    : { value: 'none' };
  const strokeComponent = entity.has(Stroke)
    ? entity.read(Stroke)
    : { color: 'none', width: 0, dasharray: [], dashoffset: 0 };
  const { color, width, dasharray, dashoffset } = strokeComponent;
  const { value: fill } = fillComponent;
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
  } = rough;

  return filterUndefined({
    fill,
    stroke: color,
    strokeWidth: width,
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
    strokeLineDash: dasharray,
    strokeLineDashOffset: dashoffset,
    fillLineDash,
    fillLineDashOffset,
  });
}
