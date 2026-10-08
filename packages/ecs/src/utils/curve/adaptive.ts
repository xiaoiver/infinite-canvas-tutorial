import { Curve } from './curve';
import { CurvePath } from './curve-path';
import { CubicBezierCurve } from './cubic-bezier-curve';
import { QuadraticBezierCurve } from './quadratic-bezier-curve';
import { EllipseCurve } from './ellipse-curve';

type Point = [number, number];
export type PathPoints = Point[][];

// Physical pixels. Half is reserved for the centerline, half for stroke joins.
export const PATH_PIXEL_ERROR = 0.25;
const MAX_DEPTH = 16;
// Per SVG command. Pathological zoom/coordinates may exhaust the quality budget,
// but must not allocate unbounded geometry or drop the command's endpoint.
const MAX_SEGMENTS = 4096;
const TAU = Math.PI * 2;
const pointAt = (curve: Curve, t: number) => curve.getPoint(t, [0, 0]) as Point;

function controls(curve: Curve): Point[] | undefined {
  if (curve instanceof CubicBezierCurve)
    return [curve.v0, curve.v1, curve.v2, curve.v3].map((p) => [p[0], p[1]]);
  if (curve instanceof QuadraticBezierCurve)
    return [curve.v0, curve.v1, curve.v2].map((p) => [p[0], p[1]]);
}

function arcSweep(curve: EllipseCurve) {
  const delta = curve.aEndAngle - curve.aStartAngle;
  if (Math.abs(delta) < Number.EPSILON) return 0;
  const positive = ((delta % TAU) + TAU) % TAU || TAU;
  return curve.aClockwise ? positive - TAU || -TAU : positive;
}

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2),
      )
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function angle(a: Point, b: Point) {
  const length = Math.hypot(...a) * Math.hypot(...b);
  return length
    ? Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / length)))
    : 0;
}

/** Render-only sampling; Curve.getPoints/getLength and text layout stay view-independent. */
export function flattenPath(
  subPaths: CurvePath[],
  scale: number,
  strokeRadius = 0,
): PathPoints {
  const tolerance = PATH_PIXEL_ERROR / 2 / Math.max(scale, 1e-12);
  // A circumscribed stroke join differs from its arc by r * (sec(theta) - 1).
  const turnLimit =
    strokeRadius > 0
      ? Math.min(0.25, Math.acos(1 / (1 + PATH_PIXEL_ERROR / 2 / strokeRadius)))
      : Math.PI;
  const endLimit =
    strokeRadius > 0
      ? Math.min(turnLimit, PATH_PIXEL_ERROR / 2 / strokeRadius)
      : Math.PI;

  return subPaths.map((path) => {
    const points: Point[] = [];
    let splitsLeft = MAX_SEGMENTS - 1;
    const append = (p: Point) => {
      const last = points[points.length - 1];
      // Merge numerical seams in arcs and vertices that collapse in the GPU's
      // Float32 buffer. A relative epsilon would erase visible high-zoom detail.
      if (
        last &&
        (Math.hypot(p[0] - last[0], p[1] - last[1]) <= tolerance * 1e-3 ||
          (Math.fround(p[0]) === Math.fround(last[0]) &&
            Math.fround(p[1]) === Math.fround(last[1])))
      ) {
        points[points.length - 1] = p;
      } else {
        points.push(p);
      }
    };
    const bezier = (
      p: Point[],
      depth: number,
      start: boolean,
      end: boolean,
    ) => {
      const first = p[0],
        last = p[p.length - 1];
      const flat = p.every(
        (v) => distanceToSegment(v, first, last) <= tolerance,
      );
      let tangentsOK = true;
      if (flat && strokeRadius > 0) {
        const edges = p
          .slice(1)
          .map((v, i): Point => [v[0] - p[i][0], v[1] - p[i][1]])
          .filter((v) => v[0] !== 0 || v[1] !== 0);
        const chord: Point = [last[0] - first[0], last[1] - first[1]];
        tangentsOK =
          edges.every((a) => edges.every((b) => angle(a, b) <= turnLimit)) &&
          (!start || !edges.length || angle(edges[0], chord) <= endLimit) &&
          (!end ||
            !edges.length ||
            angle(edges[edges.length - 1], chord) <= endLimit);
      }
      if (depth === MAX_DEPTH || splitsLeft === 0 || (flat && tangentsOK)) {
        append(last);
        return;
      }
      splitsLeft--;
      // de Casteljau retains loops, inflections and collinear reversals.
      const left = [first],
        right = [last];
      let row = p;
      while (row.length > 1) {
        row = row
          .slice(1)
          .map(
            (v, i): Point => [(row[i][0] + v[0]) / 2, (row[i][1] + v[1]) / 2],
          );
        left.push(row[0]);
        right.unshift(row[row.length - 1]);
      }
      bezier(left, depth + 1, start, false);
      bezier(right, depth + 1, false, end);
    };
    path.curves.forEach((curve) => {
      splitsLeft = MAX_SEGMENTS - 1;
      append(pointAt(curve, 0));
      const p = controls(curve);
      if (p) {
        bezier(p, 0, true, true);
      } else if (curve instanceof EllipseCurve) {
        const sweep = Math.abs(arcSweep(curve));
        const maxRadius = Math.max(
          Math.abs(curve.xRadius),
          Math.abs(curve.yRadius),
        );
        const minRadius = Math.min(
          Math.abs(curve.xRadius),
          Math.abs(curve.yRadius),
        );
        const arc = (a: number, b: number, depth: number) => {
          const delta = sweep * (b - a);
          // ||f''|| * dt^2 / 8 bounds the chord error even across a full circle.
          const flat = (maxRadius * delta * delta) / 8 <= tolerance;
          const turn =
            minRadius > 0 ? (delta * maxRadius) / minRadius : Math.PI;
          if (
            depth === MAX_DEPTH ||
            splitsLeft === 0 ||
            (flat &&
              (strokeRadius === 0 ||
                turn <= (a === 0 || b === 1 ? endLimit : turnLimit)))
          ) {
            append(pointAt(curve, b));
          } else {
            splitsLeft--;
            const mid = (a + b) / 2;
            arc(a, mid, depth + 1);
            arc(mid, b, depth + 1);
          }
        };
        arc(0, 1, 0);
      } else {
        append(pointAt(curve, 1));
      }
    });
    if (path.autoClose && points.length > 1) append(points[0]);
    return points;
  });
}

function quadraticRoots(a: number, b: number, c: number) {
  if (a === 0) return b === 0 ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  // Avoid cancellation when the two roots differ greatly in magnitude.
  const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return q === 0 ? [-b / (2 * a)] : [q / a, c / q];
}

/** Exact extrema of SVG lines, quadratic/cubic Beziers and rotated ellipse arcs. */
export function curvePathBounds(subPaths: CurvePath[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const include = (p: Point) => {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  };
  subPaths.forEach((path) =>
    path.curves.forEach((curve) => {
      include(pointAt(curve, 0));
      include(pointAt(curve, 1));
      const p = controls(curve);
      if (p) {
        for (const axis of [0, 1]) {
          const v = p.map((point) => point[axis]);
          const roots =
            p.length === 4
              ? quadraticRoots(
                  -v[0] + 3 * v[1] - 3 * v[2] + v[3],
                  2 * (v[0] - 2 * v[1] + v[2]),
                  v[1] - v[0],
                )
              : quadraticRoots(0, v[0] - 2 * v[1] + v[2], v[1] - v[0]);
          roots.forEach((t) => {
            if (t > 0 && t < 1) include(pointAt(curve, t));
          });
        }
      } else if (curve instanceof EllipseCurve) {
        const cos = Math.cos(curve.aRotation),
          sin = Math.sin(curve.aRotation);
        const x = Math.atan2(-curve.yRadius * sin, curve.xRadius * cos);
        const y = Math.atan2(curve.yRadius * cos, curve.xRadius * sin);
        const sweep = arcSweep(curve);
        for (const theta of [x, x + Math.PI, y, y + Math.PI]) {
          const distance =
            ((((theta - curve.aStartAngle) * Math.sign(sweep)) % TAU) + TAU) %
            TAU;
          if (sweep !== 0 && distance <= Math.abs(sweep))
            include(pointAt(curve, distance / Math.abs(sweep)));
        }
      }
    }),
  );
  return { minX, minY, maxX, maxY };
}
