import { compileNumericProperty } from './numeric-property';
import type { RepeatShape } from './type';

export interface RepeaterCopy {
  // Two nested transforms preserve T * S * R, including nonuniform scale.
  outer: { x: number; y: number; scaleX: number; scaleY: number };
  inner: { x: number; y: number; rotation: number };
  opacity: number;
}

export const hiddenRepeaterCopy: RepeaterCopy = {
  outer: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
  inner: { x: 0, y: 0, rotation: 0 },
  opacity: 0,
};

/** Lottie-web 5.13 RepeaterModifier semantics, without mutating the source tree. */
export function compileRepeater(shape: RepeatShape) {
  const tr = shape.tr;
  const count = compileNumericProperty(shape.c);
  const properties = [
    count,
    compileNumericProperty(shape.o),
    compileNumericProperty('y' in tr.p ? tr.p.x : tr.p, 0),
    compileNumericProperty('y' in tr.p ? tr.p.y : tr.p, 'y' in tr.p ? 0 : 1),
    compileNumericProperty(tr.a, 0),
    compileNumericProperty(tr.a, 1),
    compileNumericProperty(tr.r),
    compileNumericProperty(tr.s ?? { k: [100, 100] }, 0),
    compileNumericProperty(tr.s ?? { k: [100, 100] }, 1),
    compileNumericProperty(tr.so ?? { k: 100 }),
    compileNumericProperty(tr.eo ?? { k: 100 }),
  ];
  const capacity = Number.isFinite(count.upperBound)
    ? Math.max(0, Math.ceil(count.upperBound))
    : 0;
  let previous: number[] | undefined;
  let copies: RepeaterCopy[] = [];
  return {
    capacity,
    animated: properties.some((property) => property.animated),
    sample(frame: number) {
      const values = properties.map((property) => property.sample(frame));
      if (previous?.every((value, i) => value === values[i])) return copies;
      previous = values;
      copies = [];
      if (!values.every(Number.isFinite)) return copies;
      const [
        c,
        offset,
        px,
        py,
        ax,
        ay,
        degrees,
        sxPercent,
        syPercent,
        startOpacity,
        endOpacity,
      ] = values;
      const n = Math.min(capacity, Math.max(0, Math.ceil(c)));
      const sx = sxPercent / 100,
        sy = syPercent / 100;
      const rotation = (degrees * Math.PI) / 180;
      let tx = 0,
        ty = 0,
        angle = 0,
        scaleX = 1,
        scaleY = 1;
      const apply = (fraction: number, inverse: boolean, times = 1) => {
        const direction = inverse ? -1 : 1;
        tx += px * direction * fraction * times;
        ty += py * direction * fraction * times;
        angle += rotation * direction * fraction * times;
        const x = 1 + (sx - 1) * fraction,
          y = 1 + (sy - 1) * fraction;
        scaleX *= Math.pow(inverse ? 1 / x : x, times);
        scaleY *= Math.pow(inverse ? 1 / y : y, times);
      };
      const whole = Math.trunc(offset),
        fraction = offset % 1;
      apply(1, offset < 0, Math.abs(whole));
      if (fraction) apply(Math.abs(fraction), offset < 0);
      // Keep the reference's identity-crossing behavior for negative offsets.
      let iteration = whole + Math.abs(fraction);
      const reverse = shape.m === 2;
      for (let step = 0; step < n; step++) {
        const index = reverse ? n - 1 - step : step;
        const opacity =
          (n === 1
            ? startOpacity
            : startOpacity + ((endOpacity - startOpacity) * index) / (n - 1)) /
          100;
        if (iteration === 0) {
          copies[index] = { ...hiddenRepeaterCopy, opacity };
        } else {
          if (step > 0) apply(1, false);
          const cos = Math.cos(angle),
            sin = Math.sin(angle);
          copies[index] = [tx, ty, angle, scaleX, scaleY].every(Number.isFinite)
            ? {
                outer: {
                  x: tx + ax * (1 - scaleX),
                  y: ty + ay * (1 - scaleY),
                  scaleX,
                  scaleY,
                },
                inner: {
                  x: ax - cos * ax + sin * ay,
                  y: ay - sin * ax - cos * ay,
                  rotation: angle,
                },
                opacity,
              }
            : hiddenRepeaterCopy;
        }
        iteration++;
      }
      return copies;
    },
  };
}
