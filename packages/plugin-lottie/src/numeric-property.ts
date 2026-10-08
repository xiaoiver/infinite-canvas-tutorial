import BezierEasing from 'bezier-easing';
import type { MultiDimensional, OffsetKeyframe, Value } from './type';

const channel = (
  value: number | number[] | undefined,
  dimension: number,
  fallback = 0,
) => (Array.isArray(value) ? value[dimension] ?? value[0] : value) ?? fallback;

/** Compile once; keyframe easing belongs to the outgoing Lottie segment. */
export function compileNumericProperty(
  property: Value | MultiDimensional | undefined,
  dimension = 0,
) {
  const k = property?.k;
  if (!Array.isArray(k) || !k.length || typeof k[0] !== 'object') {
    const value = channel(k as number | number[] | undefined, dimension);
    return {
      animated: false,
      upperBound: value,
      sample: (_frame: number) => value,
    };
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
    controls: [
      values[i] +
        (channel(frames[i + 1].s ?? frame.e, dimension, values[i]) -
          values[i]) *
          channel(frame.o?.y, dimension, 0),
      values[i] +
        (channel(frames[i + 1].s ?? frame.e, dimension, values[i]) -
          values[i]) *
          channel(frame.i?.y, dimension, 1),
    ],
    ease: BezierEasing(
      channel(frame.o?.x, dimension, 0),
      channel(frame.o?.y, dimension, 0),
      channel(frame.i?.x, dimension, 1),
      channel(frame.i?.y, dimension, 1),
    ),
  }));
  return {
    animated: true,
    // A cubic stays in the convex hull of its controls, including easing overshoot.
    upperBound: segments.reduce(
      (max, segment) =>
        segment.hold ? max : Math.max(max, ...segment.controls),
      values.reduce((max, value) => Math.max(max, value), -Infinity),
    ),
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
