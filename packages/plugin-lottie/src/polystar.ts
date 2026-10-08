import BezierEasing from 'bezier-easing';
import type {
  MultiDimensional,
  OffsetKeyframe,
  PolyStarShape,
  Value,
} from './type';

export interface PolyStarPath {
  v: number[][];
  in: number[][];
  out: number[][];
  close: true;
}

const channel = (
  value: number | number[] | undefined,
  dimension: number,
  fallback = 0,
) => (Array.isArray(value) ? value[dimension] ?? value[0] : value) ?? fallback;

/** Compile once; keyframe easing belongs to the outgoing Lottie segment. */
function compileProperty(
  property: Value | MultiDimensional | undefined,
  dimension = 0,
) {
  const k = property?.k;
  if (!Array.isArray(k) || !k.length || typeof k[0] !== 'object') {
    const value = channel(k as number | number[] | undefined, dimension);
    return { animated: false, sample: (_frame: number) => value };
  }
  const frames = k as OffsetKeyframe[];
  const values = frames.map((frame, i) =>
    channel(frame.s ?? frames[i - 1]?.e, dimension),
  );
  const segments = frames.slice(0, -1).map((frame, i) => ({
    start: frame.t,
    end: frames[i + 1].t,
    from: values[i],
    to: channel(frames[i + 1].s ?? frame.e, dimension, values[i]),
    hold: frame.h === 1,
    ease: BezierEasing(
      channel(frame.o?.x, dimension, 0),
      channel(frame.o?.y, dimension, 0),
      channel(frame.i?.x, dimension, 1),
      channel(frame.i?.y, dimension, 1),
    ),
  }));
  return {
    animated: true,
    sample(frame: number) {
      if (frame <= frames[0].t) return values[0];
      for (const segment of segments) {
        if (frame < segment.end) {
          if (segment.hold) return segment.from;
          const progress = segment.ease(
            (frame - segment.start) / (segment.end - segment.start),
          );
          return segment.from + (segment.to - segment.from) * progress;
        }
      }
      return values[values.length - 1];
    },
  };
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
    compileProperty(shape.pt),
    compileProperty(shape.p, 0),
    compileProperty(shape.p, 1),
    compileProperty(shape.r),
    compileProperty(shape.or),
    compileProperty(shape.os),
    compileProperty(star ? shape.ir : undefined),
    compileProperty(star ? shape.is : undefined),
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
