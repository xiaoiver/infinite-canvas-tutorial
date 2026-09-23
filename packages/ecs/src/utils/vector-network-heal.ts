import type {
  VectorSegmentLike,
  VectorVertexLike,
} from './vector-network-stroke';

type Point = [number, number];
type Cubic = [Point, Point, Point, Point];

const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function controls(
  vertices: VectorVertexLike[],
  segment: VectorSegmentLike,
  reversed: boolean,
): Cubic {
  const a = vertices[reversed ? segment.end : segment.start];
  const b = vertices[reversed ? segment.start : segment.end];
  const ts = reversed ? segment.tangentEnd : segment.tangentStart;
  const te = reversed ? segment.tangentStart : segment.tangentEnd;
  const p0: Point = [a.x, a.y];
  const p3: Point = [b.x, b.y];
  // Stored straight edges have linear parameterization, not eased cubics.
  if (!ts?.x && !ts?.y && !te?.x && !te?.y) {
    return [p0, lerp(p0, p3, 1 / 3), lerp(p0, p3, 2 / 3), p3];
  }
  return [
    p0,
    [a.x + (ts?.x ?? 0), a.y + (ts?.y ?? 0)],
    [b.x + (te?.x ?? 0), b.y + (te?.y ?? 0)],
    p3,
  ];
}

function split(c: Cubic, t: number): [Cubic, Cubic] {
  const a = lerp(c[0], c[1], t);
  const b = lerp(c[1], c[2], t);
  const d = lerp(c[2], c[3], t);
  const e = lerp(a, b, t);
  const f = lerp(b, d, t);
  const p = lerp(e, f, t);
  return [
    [c[0], a, e, p],
    [p, f, d, c[3]],
  ];
}

/** Convex-hull bound on the difference of two curves with the same parameter. */
function errorBound(candidate: Cubic, a: Cubic, b: Cubic, t: number): number {
  const halves = split(candidate, t);
  return Math.max(
    ...a.map((p, i) => distance(p, halves[0][i])),
    ...b.map((p, i) => distance(p, halves[1][i])),
  );
}

function fit(a: Cubic, b: Cubic, join: number): Cubic {
  let aa = 0;
  let ab = 0;
  let bb = 0;
  const rhsA: Point = [0, 0];
  const rhsB: Point = [0, 0];
  for (let half = 0; half < 2; half++) {
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const sample = split(half === 0 ? a : b, u)[0][3];
      const t = half === 0 ? u * join : join + u * (1 - join);
      const w0 = (1 - t) ** 3;
      const w1 = 3 * (1 - t) ** 2 * t;
      const w2 = 3 * (1 - t) * t * t;
      const w3 = t ** 3;
      aa += w1 * w1;
      ab += w1 * w2;
      bb += w2 * w2;
      for (let axis = 0; axis < 2; axis++) {
        const residual = sample[axis] - w0 * a[0][axis] - w3 * b[3][axis];
        rhsA[axis] += w1 * residual;
        rhsB[axis] += w2 * residual;
      }
    }
  }
  const det = aa * bb - ab * ab;
  const p1: Point = [0, 0];
  const p2: Point = [0, 0];
  for (let axis = 0; axis < 2; axis++) {
    p1[axis] = (rhsA[axis] * bb - rhsB[axis] * ab) / det;
    p2[axis] = (rhsB[axis] * aa - rhsA[axis] * ab) / det;
  }
  return [a[0], p1, p2, b[3]];
}

/** Join oriented incident cubics, restoring exact subdivisions where possible. */
export function healVectorSegments(
  vertices: VectorVertexLike[],
  first: VectorSegmentLike,
  second: VectorSegmentLike,
  vertex: number,
  maxError?: number,
): VectorSegmentLike | null {
  const start = first.start === vertex ? first.end : first.start;
  const end = second.start === vertex ? second.end : second.start;
  if (!vertices[start] || !vertices[end]) return null;
  const straight = (s: VectorSegmentLike) =>
    !s.tangentStart?.x &&
    !s.tangentStart?.y &&
    !s.tangentEnd?.x &&
    !s.tangentEnd?.y;
  if (straight(first) && straight(second)) {
    return { start, end };
  }
  const a = controls(vertices, first, first.start === vertex);
  const b = controls(vertices, second, second.end === vertex);
  const all = [...a, ...b];
  const scale = Math.max(
    Math.max(...all.map((p) => p[0])) - Math.min(...all.map((p) => p[0])),
    Math.max(...all.map((p) => p[1])) - Math.min(...all.map((p) => p[1])),
    1e-6,
  );
  const tolerance = maxError ?? scale * 0.05;
  if (!(tolerance >= 0)) return null;

  // Subdivision scales the derivative at the shared endpoint by t / (1-t).
  // At a stationary join, use the second or third derivative instead.
  let left = a.map((p) => [...p] as Point);
  let right = b.map((p) => [...p] as Point);
  let join = 0.5;
  for (let order = 1; order <= 3; order++) {
    left = left.slice(1).map((p, i) => [p[0] - left[i][0], p[1] - left[i][1]]);
    right = right
      .slice(1)
      .map((p, i) => [p[0] - right[i][0], p[1] - right[i][1]]);
    const l = Math.hypot(...left[left.length - 1]) ** (1 / order);
    const r = Math.hypot(...right[0]) ** (1 / order);
    if (l > scale ** (1 / order) * 1e-10 && r > scale ** (1 / order) * 1e-10) {
      join = l / (l + r);
      break;
    }
  }
  const toSegment = (c: Cubic): VectorSegmentLike => ({
    start,
    end,
    tangentStart: { x: c[1][0] - c[0][0], y: c[1][1] - c[0][1] },
    tangentEnd: { x: c[2][0] - c[3][0], y: c[2][1] - c[3][1] },
  });
  const restored: Cubic = [
    a[0],
    lerp(a[0], a[1], 1 / join),
    lerp(b[3], b[2], 1 / (1 - join)),
    b[3],
  ];
  const restoredError = errorBound(restored, a, b, join);
  if (restoredError <= Math.min(tolerance, scale * 1e-7)) {
    return toSegment(restored);
  }

  let best: Cubic | null = null;
  let bestError = Infinity;
  for (const t of [
    join,
    ...Array.from({ length: 31 }, (_, i) => (i + 1) / 32),
  ]) {
    const candidate = fit(a, b, t);
    const error = errorBound(candidate, a, b, t);
    if (error < bestError) {
      best = candidate;
      bestError = error;
    }
  }
  return best && bestError <= tolerance ? toSegment(best) : null;
}
