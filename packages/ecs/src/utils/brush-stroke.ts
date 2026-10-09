import { getStrokePoints } from 'perfect-freehand';
import type { PointerSample } from '../components/Input';
import type { BrushPoint } from '../components/geometry/Brush';

export interface BrushStrokePoint {
  x: number;
  y: number;
  pressure: number;
}

const clampPressure = (pressure: number) =>
  Math.max(0.05, Math.min(1, pressure));

/** Pressure is sampled in screen space, independently of zoom and render FPS. */
export class BrushPressure {
  private previous: PointerSample;
  value: number;

  constructor(sample: PointerSample) {
    this.previous = sample;
    this.value =
      sample.pointerType === 'pen' && Number.isFinite(sample.pressure)
        ? clampPressure(sample.pressure)
        : 0.5;
  }

  update(sample: PointerSample): number {
    const previous = this.previous;
    const elapsed = sample.timeStamp - previous.timeStamp;
    if (elapsed <= 0 || !Number.isFinite(elapsed)) return this.value;
    this.previous = sample;
    const distance = Math.hypot(sample.x - previous.x, sample.y - previous.y);
    if (distance === 0) return this.value;
    const speed = distance / elapsed; // CSS pixels / millisecond
    const target =
      sample.pointerType === 'pen' && Number.isFinite(sample.pressure)
        ? // Pen release pressure is zero; retain the last contact width.
          sample.phase === 'up'
          ? this.value
          : clampPressure(sample.pressure)
        : 0.2 + 0.6 / (1 + speed / 0.75);
    // Time-based smoothing gives the same response at different sampling rates.
    this.value += (target - this.value) * (1 - Math.exp(-elapsed / 32));
    return this.value;
  }
}

export function brushStrokePoints(
  points: BrushStrokePoint[],
  strokeWidth: number,
  last = false,
): BrushPoint[] {
  if (points.length < 2) return [];
  // perfect-freehand interpolates two-point strokes without their pressure.
  // Supply our own midpoint so short strokes retain the measured widths too.
  const input =
    points.length === 2
      ? [
          points[0],
          {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
            pressure: (points[0].pressure + points[1].pressure) / 2,
          },
          points[1],
        ]
      : points;
  const width = Number.isFinite(strokeWidth) ? Math.max(0, strokeWidth) : 0;
  const result: BrushPoint[] = [];
  for (const { point, pressure } of getStrokePoints(input, {
    size: width,
    last,
  })) {
    let radius = pressure * width;
    const previous = result[result.length - 1];
    if (previous) {
      // The brush shader joins neighboring circles by their common tangents.
      // Keep a steep pressure change from enclosing the neighboring circle.
      const limit =
        0.9 * Math.hypot(point[0] - previous.x, point[1] - previous.y);
      radius = Math.max(
        previous.radius - limit,
        Math.min(previous.radius + limit, radius),
      );
    }
    result.push({ x: point[0], y: point[1], radius });
  }
  return result;
}
