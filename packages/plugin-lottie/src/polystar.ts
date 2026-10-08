import type { PolyStarShape } from './type';
import { compileNumericProperty } from './numeric-property';

export interface PolyStarPath {
  v: number[][];
  in: number[][];
  out: number[][];
  close: true;
}

/**
 * Lottie-web's PolyStar construction, including integer point counts and absolute
 * tangent handles. Generate geometry after parameter interpolation: morphing two
 * paths would shrink rotating stars and interpolate incompatible point counts.
 * @see https://github.com/airbnb/lottie-web/blob/v5.13.0/player/js/utils/shapes/ShapeProperty.js
 */
export function compilePolyStar(shape: PolyStarShape) {
  const star = shape.sy === 1;
  const properties = [
    compileNumericProperty(shape.pt),
    compileNumericProperty(shape.p, 0),
    compileNumericProperty(shape.p, 1),
    compileNumericProperty(shape.r),
    compileNumericProperty(shape.or),
    compileNumericProperty(shape.os),
    compileNumericProperty(star ? shape.ir : undefined),
    compileNumericProperty(star ? shape.is : undefined),
  ];
  let previous: number[] | undefined;
  let path: PolyStarPath;
  return {
    animated: properties.some((property) => property.animated),
    sample(frame: number): PolyStarPath {
      const values = properties.map((property) => property.sample(frame));
      if (previous?.every((value, i) => value === values[i])) return path;
      previous = values;
      const [
        points,
        px,
        py,
        rotation,
        outerRadius,
        outerRoundness,
        innerRadius,
        innerRoundness,
      ] = values;
      const count = Math.max(0, Math.floor(points)) * (star ? 2 : 1);
      path = { v: [], in: [], out: [], close: true };
      if (!values.every(Number.isFinite) || !count) return path;
      const direction = shape.d === 3 ? -1 : 1;
      const step = ((Math.PI * 2) / count) * direction;
      let angle = -Math.PI / 2 + (rotation * Math.PI) / 180;
      for (let i = 0; i < count; i++, angle += step) {
        const inner = star && i % 2 === 1;
        const radius = inner ? innerRadius : outerRadius;
        const roundness = (inner ? innerRoundness : outerRoundness) / 100;
        const x = radius * Math.cos(angle),
          y = radius * Math.sin(angle);
        const length = Math.hypot(x, y);
        const handle =
          ((Math.PI * 2 * radius) / (count * (star ? 2 : 4))) *
          roundness *
          direction;
        const tx = length ? (y / length) * handle : 0;
        const ty = length ? (-x / length) * handle : 0;
        path.v.push([px + x, py + y]);
        path.in.push([px + x + tx, py + y + ty]);
        path.out.push([px + x - tx, py + y - ty]);
      }
      return path;
    },
  };
}
