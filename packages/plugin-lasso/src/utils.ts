import { isPolygonsIntersect } from '@antv/util';
import {
  API,
  Circle,
  ComputedVisibility,
  Ellipse,
  GlobalTransform,
  Polyline,
  Rect,
  UI,
} from '@infinite-canvas-tutorial/ecs';

/** Reject taps and straight strokes, but allow self-intersecting lassos. */
export function isValidLassoPath(points: [number, number][]) {
  if (points.length < 3 || points.some((p) => !p.every(Number.isFinite)))
    return false;
  const [x, y] = points[0];
  const next = points.find((p) => p[0] !== x || p[1] !== y);
  return (
    !!next &&
    points.some(
      (p) =>
        Math.abs((next[0] - x) * (p[1] - y) - (next[1] - y) * (p[0] - x)) >
        1e-8,
    )
  );
}

export function selectByLassoPath(api: API, lassoPath: [number, number][]) {
  if (!isValidLassoPath(lassoPath)) return [];
  const lassoBounds = lassoPath.reduce(
    (acc, item) => {
      return [
        Math.min(acc[0], item[0]),
        Math.min(acc[1], item[1]),
        Math.max(acc[2], item[0]),
        Math.max(acc[3], item[1]),
      ];
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  ) as [number, number, number, number];

  const elements = api
    .elementsFromBBox(
      lassoBounds[0],
      lassoBounds[1],
      lassoBounds[2],
      lassoBounds[3],
    )
    .filter(
      (e) =>
        !e.has(UI) &&
        e.has(ComputedVisibility) &&
        e.read(ComputedVisibility).visible,
    );

  // elementsFromBBox already excludes locked geometry.
  const selectedElements = [];

  elements.forEach((e) => {
    if (!e.has(GlobalTransform)) return;
    const points: [number, number][] = [];
    if (e.has(Rect)) {
      const { x, y, width, height } = e.read(Rect);
      points.push(
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      );
    } else if (e.has(Polyline)) {
      points.push(...e.read(Polyline).points);
    } else if (e.has(Ellipse) || e.has(Circle)) {
      const ellipse = e.has(Ellipse) ? e.read(Ellipse) : undefined;
      const circle = !ellipse ? e.read(Circle) : undefined;
      const { cx, cy } = ellipse ?? circle;
      const rx = ellipse?.rx ?? circle.r;
      const ry = ellipse?.ry ?? circle.r;
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
      }
    }

    if (points.length === 0) {
      return;
    }

    const m = e.read(GlobalTransform).matrix;
    const worldPoints = points.map(([x, y]): [number, number] => [
      m.m00 * x + m.m10 * y + m.m20,
      m.m01 * x + m.m11 * y + m.m21,
    ]);
    // Polylines are open: do not create an invisible closing edge or interior.
    const intersects = e.has(Polyline)
      ? worldPoints
          .slice(1)
          .some((point, index) =>
            isPolygonsIntersect(lassoPath, [worldPoints[index], point]),
          )
      : isPolygonsIntersect(lassoPath, worldPoints);
    if (intersects) {
      selectedElements.push(e);
    }
  });

  return selectedElements;
}
