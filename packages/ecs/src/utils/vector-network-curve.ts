import type { VectorNetworkData } from './vector-network-topology';
import type {
  VectorSegmentLike,
  VectorVertexLike,
} from './vector-network-stroke';

export type CurvePoint = [number, number];
export type VectorCubic = [CurvePoint, CurvePoint, CurvePoint, CurvePoint];
export const mixCurvePoint = (
  a: CurvePoint,
  b: CurvePoint,
  t: number,
): CurvePoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Straight edges use a linear parameter, matching getVectorSegmentPointAt. */
export function vectorSegmentCubic(
  vertices: VectorVertexLike[],
  edge: VectorSegmentLike,
): VectorCubic | null {
  const a = vertices[edge.start],
    b = vertices[edge.end];
  if (!a || !b) return null;
  const p: CurvePoint = [a.x, a.y],
    q: CurvePoint = [b.x, b.y];
  const curved = [edge.tangentStart, edge.tangentEnd].some(
    (v) => v && Math.hypot(v.x, v.y) >= 1e-6,
  );
  const c: VectorCubic = curved
    ? [
        p,
        [a.x + (edge.tangentStart?.x ?? 0), a.y + (edge.tangentStart?.y ?? 0)],
        [b.x + (edge.tangentEnd?.x ?? 0), b.y + (edge.tangentEnd?.y ?? 0)],
        q,
      ]
    : [p, mixCurvePoint(p, q, 1 / 3), mixCurvePoint(p, q, 2 / 3), q];
  return c.flat().every(Number.isFinite) ? c : null;
}
export function splitVectorCubic(
  c: VectorCubic,
  t: number,
): [VectorCubic, VectorCubic] {
  const a = mixCurvePoint(c[0], c[1], t),
    b = mixCurvePoint(c[1], c[2], t),
    d = mixCurvePoint(c[2], c[3], t);
  const e = mixCurvePoint(a, b, t),
    f = mixCurvePoint(b, d, t),
    p = mixCurvePoint(e, f, t);
  return [
    [c[0], a, e, p],
    [p, f, d, c[3]],
  ];
}
export const pointOnVectorCubic = (c: VectorCubic, t: number): CurvePoint =>
  splitVectorCubic(c, t)[0][3];
export function vectorCubicDerivative(c: VectorCubic, t: number): CurvePoint {
  const s = 1 - t;
  return [0, 1].map(
    (i) =>
      3 *
      (s * s * (c[1][i] - c[0][i]) +
        2 * s * t * (c[2][i] - c[1][i]) +
        t * t * (c[3][i] - c[2][i])),
  ) as CurvePoint;
}

/** Minimize screen-space distance, so zoom and nonuniform scale do not bias picking. */
export function nearestVectorCurveParameter(
  c: VectorCubic,
  point: CurvePoint,
): number {
  const distance = (t: number) => {
    const p = pointOnVectorCubic(c, t);
    return (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2;
  };
  let best = 0;
  for (let i = 1; i <= 64; i++)
    if (distance(i / 64) < distance(best)) best = i / 64;
  let lo = Math.max(0, best - 1 / 64),
    hi = Math.min(1, best + 1 / 64);
  for (let i = 0; i < 32; i++) {
    const a = lo + (hi - lo) / 3,
      b = hi - (hi - lo) / 3;
    if (distance(a) < distance(b)) hi = b;
    else lo = a;
  }
  return (lo + hi) / 2;
}

/** Minimum squared control displacement subject to B(t) following the pointer. */
export function bendVectorSegment(
  network: VectorNetworkData,
  index: number,
  t: number,
  delta: CurvePoint,
): VectorNetworkData {
  const edge = network.segments[index];
  const c = edge && vectorSegmentCubic(network.vertices, edge);
  if (
    !c ||
    t <= 1e-4 ||
    t >= 1 - 1e-4 ||
    ![t, ...delta].every(Number.isFinite) ||
    Math.hypot(...delta) < 1e-9
  )
    return network;
  const a = 3 * (1 - t) ** 2 * t,
    b = 3 * (1 - t) * t * t,
    denominator = a * a + b * b;
  const segments = network.segments.map((s) => ({ ...s }));
  segments[index] = {
    ...edge,
    tangentStart: {
      x: c[1][0] - c[0][0] + (delta[0] * a) / denominator,
      y: c[1][1] - c[0][1] + (delta[1] * a) / denominator,
    },
    tangentEnd: {
      x: c[2][0] - c[3][0] + (delta[0] * b) / denominator,
      y: c[2][1] - c[3][1] + (delta[1] * b) / denominator,
    },
  };
  const vertices = network.vertices.map((v, i) =>
    i === edge.start || i === edge.end
      ? { ...v, handleMirroring: 'NONE' as const }
      : { ...v },
  );
  return { ...network, vertices, segments };
}
