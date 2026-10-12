import earcut from 'earcut';
import { hasSelfTouchingContour } from './path-rendering';
import { triangulate } from './tessy';

/**
 * Earcut's hole indices already require resolved topology. Compound SVG paths
 * instead specify winding/parity, independent of contour order or orientation.
 * Use libtess for those paths, keeping Earcut for a single nonzero contour.
 * Rough paint deliberately keeps its separate mesh path: overlapping strokes
 * may need to accumulate alpha rather than become a union of filled regions.
 */
export function buildPathFillMesh(
  rawContours: [number, number][][],
  fillRule: CanvasFillRule = 'nonzero',
  method: 'earcut' | 'libtess' = 'earcut',
): { points: number[]; indices: number[] } {
  const contours = rawContours.filter((points) => points.length >= 3);
  if (!contours.length) return { points: [], indices: [] };
  if (
    method === 'earcut' &&
    fillRule === 'nonzero' &&
    contours.length === 1 &&
    !hasSelfTouchingContour(contours)
  ) {
    const points = contours[0].flat();
    return { points, indices: earcut(points) };
  }
  const points: number[] = triangulate(contours, fillRule);
  return {
    points,
    indices: Array.from({ length: points.length / 2 }, (_, i) => i),
  };
}
