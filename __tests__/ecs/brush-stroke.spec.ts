import {
  BrushPressure,
  brushStrokePoints,
} from '../../packages/ecs/src/utils/brush-stroke';
import type { PointerSample } from '../../packages/ecs/src/components/Input';

const sample = (
  x: number,
  timeStamp: number,
  extra: Partial<PointerSample> = {},
): PointerSample => ({
  x,
  y: 0,
  timeStamp,
  pressure: 0.5,
  pointerType: 'mouse',
  phase: 'move',
  ...extra,
});

describe('brush pressure', () => {
  it.each(['mouse', 'touch'] as const)(
    'makes fast %s strokes thinner on the same path',
    (pointerType) => {
      const draw = (interval: number) => {
        const pressure = new BrushPressure(sample(0, 0, { pointerType }));
        for (let i = 1; i <= 20; i++)
          pressure.update(sample(i * 12, i * interval, { pointerType }));
        return pressure.value;
      };
      expect(draw(80)).toBeGreaterThan(draw(6) * 1.5);
    },
  );

  it('uses elapsed time rather than sample count for smoothing', () => {
    const draw = (interval: number) => {
      const pressure = new BrushPressure(sample(0, 0));
      for (let time = interval; time <= 320; time += interval)
        pressure.update(sample(time * 1.5, time));
      return pressure.value;
    };
    expect(draw(4)).toBeCloseTo(draw(16), 10);
    expect(draw(32)).toBeCloseTo(draw(16), 10);
  });

  it('uses real pen pressure at any speed and keeps contact width on release', () => {
    for (const distance of [2, 80]) {
      const pressure = new BrushPressure(
        sample(0, 0, { pointerType: 'pen', pressure: 0.8 }),
      );
      expect(
        pressure.update(
          sample(distance, 40, { pointerType: 'pen', pressure: 0.8 }),
        ),
      ).toBe(0.8);
      expect(
        pressure.update(
          sample(distance + 1, 41, {
            pointerType: 'pen',
            pressure: 0,
            phase: 'up',
          }),
        ),
      ).toBe(0.8);
      expect(
        pressure.update(
          sample(distance + 20, 200, { pointerType: 'pen', pressure: 0.2 }),
        ),
      ).toBeLessThan(0.25);
    }
  });

  it('ignores repeated/out-of-order timestamps and remains finite without device pressure', () => {
    const pressure = new BrushPressure(sample(0, 100));
    for (const timeStamp of [100, 90, NaN]) {
      expect(pressure.update(sample(10, timeStamp))).toBe(0.5);
    }
    const value = pressure.update(
      sample(20, 120, { pointerType: 'pen', pressure: NaN }),
    );
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
    expect(pressure.update(sample(20, 200))).toBe(value);
    expect(new BrushPressure(sample(0, 0)).value).toBe(0.5);
  });
});

describe('brush geometry', () => {
  it('preserves pressure and the final endpoint in a two-sample stroke', () => {
    const points = brushStrokePoints(
      [
        { x: 0, y: 0, pressure: 0.2 },
        { x: 100, y: 10, pressure: 0.8 },
      ],
      20,
      true,
    );
    expect(points[0].radius).toBe(4);
    expect(points[points.length - 1]).toEqual({ x: 100, y: 10, radius: 16 });
    expect(brushStrokePoints([], 20)).toEqual([]);
  });

  it('keeps neighboring circles joinable when pen pressure changes abruptly', () => {
    const points = brushStrokePoints(
      [
        { x: 0, y: 0, pressure: 0.05 },
        { x: 1, y: 0, pressure: 1 },
        { x: 2, y: 0, pressure: 0.05 },
      ],
      100,
      true,
    );
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      expect(Math.abs(a.radius - b.radius)).toBeLessThan(
        Math.hypot(a.x - b.x, a.y - b.y),
      );
    }
    expect(points.every((p) => Number.isFinite(p.radius) && p.radius > 0)).toBe(
      true,
    );
  });
});
