import {
  splitSegmentAt,
  type VectorNetworkData,
} from './vector-network-topology';
import {
  pointOnVectorCubic,
  splitVectorCubic,
  vectorCubicDerivative,
  vectorSegmentCubic,
  type CurvePoint,
  type VectorCubic,
} from './vector-network-curve';

type Span = { a: CurvePoint; b: CurvePoint; lo: number; hi: number };
type Hit = { edge: number; t: number };
const cross = (a: CurvePoint, b: CurvePoint) => a[0] * b[1] - a[1] * b[0];
const sub = (a: CurvePoint, b: CurvePoint): CurvePoint => [
  a[0] - b[0],
  a[1] - b[1],
];
const distance = (a: CurvePoint, b: CurvePoint) => Math.hypot(...sub(a, b));

function flatten(
  c: VectorCubic,
  lo = 0,
  hi = 1,
  depth = 0,
  out: Span[] = [],
): Span[] {
  const chord = distance(c[0], c[3]);
  const hull =
    distance(c[0], c[1]) + distance(c[1], c[2]) + distance(c[2], c[3]);
  const direction = sub(c[3], c[0]);
  const height = chord
    ? Math.max(
        Math.abs(cross(sub(c[1], c[0]), direction)),
        Math.abs(cross(sub(c[2], c[0]), direction)),
      ) / chord
    : hull;
  if (depth >= 18 || (height <= 0.01 && hull - chord <= 0.01)) {
    out.push({ a: c[0], b: c[3], lo, hi });
  } else {
    const [a, b] = splitVectorCubic(c, 0.5),
      mid = (lo + hi) / 2;
    flatten(a, lo, mid, depth + 1, out);
    flatten(b, mid, hi, depth + 1, out);
  }
  return out;
}

function crossing(a: Span, b: Span): [number, number] | null {
  for (const k of [0, 1])
    if (
      Math.max(a.a[k], a.b[k]) + 1e-8 < Math.min(b.a[k], b.b[k]) ||
      Math.max(b.a[k], b.b[k]) + 1e-8 < Math.min(a.a[k], a.b[k])
    )
      return null;
  const v = sub(a.b, a.a),
    w = sub(b.b, b.a),
    d = sub(b.a, a.a);
  const determinant = cross(v, w);
  // Coincident / collinear spans have no unique intersection to split.
  if (Math.abs(determinant) <= 1e-12 * Math.hypot(...v) * Math.hypot(...w))
    return null;
  const t = cross(d, w) / determinant,
    u = cross(d, v) / determinant;
  return t >= -1e-8 && t <= 1 + 1e-8 && u >= -1e-8 && u <= 1 + 1e-8
    ? [a.lo + t * (a.hi - a.lo), b.lo + u * (b.hi - b.lo)]
    : null;
}
function refine(
  a: VectorCubic,
  b: VectorCubic,
  t: number,
  u: number,
): [number, number] | null {
  for (let i = 0; i < 16; i++) {
    const d = sub(pointOnVectorCubic(a, t), pointOnVectorCubic(b, u));
    if (Math.hypot(...d) < 1e-9) break;
    const v = vectorCubicDerivative(a, t),
      w = vectorCubicDerivative(b, u),
      det = cross(v, w);
    if (Math.abs(det) < 1e-14) break;
    t -= cross(d, w) / det;
    u -= cross(d, v) / det;
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  }
  if (distance(pointOnVectorCubic(a, t), pointOnVectorCubic(b, u)) > 1e-6)
    return null;
  return [Math.max(0, Math.min(1, t)), Math.max(0, Math.min(1, u))];
}

/**
 * Connect transverse intersections and T junctions within one network, preserving
 * curves and region walks. Original vertex indices stay stable. Endpoint-only
 * contacts remain separate so Cut is not silently undone. Tangencies and
 * overlapping spans are not boolean operations and are deliberately left alone.
 */
export function splitVectorNetworkIntersections(
  network: VectorNetworkData,
  affected?: ReadonlySet<number>,
): VectorNetworkData {
  const curves = network.segments.map((s) =>
    vectorSegmentCubic(network.vertices, s),
  );
  const bounds = curves.map(
    (c) =>
      c && [
        Math.min(...c.map((p) => p[0])),
        Math.min(...c.map((p) => p[1])),
        Math.max(...c.map((p) => p[0])),
        Math.max(...c.map((p) => p[1])),
      ],
  );
  const spans = curves.map((c) => (c ? flatten(c) : []));
  const groups: { point: CurvePoint; hits: Hit[] }[] = [];
  const interior = (t: number) => t > 1e-6 && t < 1 - 1e-6;
  for (let i = 0; i < curves.length; i++)
    for (let j = i; j < curves.length; j++) {
      const a = curves[i],
        b = curves[j];
      if (!a || !b || (affected && !affected.has(i) && !affected.has(j)))
        continue;
      const ab = bounds[i]!,
        bb = bounds[j]!;
      if (
        ab[2] < bb[0] - 1e-8 ||
        bb[2] < ab[0] - 1e-8 ||
        ab[3] < bb[1] - 1e-8 ||
        bb[3] < ab[1] - 1e-8
      )
        continue;
      if (
        i !== j &&
        (a.every((p, k) => distance(p, b[k]) < 1e-8) ||
          a.every((p, k) => distance(p, b[3 - k]) < 1e-8))
      )
        continue;
      for (let m = 0; m < spans[i].length; m++)
        for (let n = i === j ? m + 2 : 0; n < spans[j].length; n++) {
          const seed = crossing(spans[i][m], spans[j][n]);
          const root = seed && refine(a, b, ...seed);
          if (!root) continue;
          const [t, u] = root;
          if (
            (!interior(t) && !interior(u)) ||
            (i === j && Math.abs(t - u) < 1e-5)
          )
            continue;
          const v = vectorCubicDerivative(a, t),
            w = vectorCubicDerivative(b, u);
          if (
            Math.abs(cross(v, w)) <=
            1e-7 * Math.hypot(...v) * Math.hypot(...w)
          )
            continue;
          const point = pointOnVectorCubic(a, t);
          let group = groups.find((g) => distance(g.point, point) <= 1e-6);
          if (!group) groups.push((group = { point, hits: [] }));
          for (const hit of [
            { edge: i, t },
            { edge: j, t: u },
          ])
            if (
              !group.hits.some(
                (h) => h.edge === hit.edge && Math.abs(h.t - hit.t) < 1e-6,
              )
            )
              group.hits.push(hit);
        }
    }
  if (!groups.length) return network;
  const next: VectorNetworkData = {
    vertices: network.vertices.map((v) => ({ ...v })),
    segments: network.segments.map((s) => ({ ...s })),
    regions: network.regions?.map((r) => ({
      ...r,
      loops: r.loops.map((l) => [...l]),
    })),
  };
  const cuts = new Map<number, { t: number; vertex: number }[]>();
  for (const group of groups) {
    const endpoint = group.hits.find((h) => !interior(h.t));
    const vertex = endpoint
      ? network.segments[endpoint.edge][endpoint.t < 0.5 ? 'start' : 'end']
      : next.vertices.length;
    if (!endpoint) next.vertices.push({ x: group.point[0], y: group.point[1] });
    for (const hit of group.hits)
      if (interior(hit.t)) {
        const list = cuts.get(hit.edge) ?? [];
        list.push({ t: hit.t, vertex });
        cuts.set(hit.edge, list);
      }
  }
  for (const [edge, list] of cuts) {
    let end = 1;
    for (const cut of list.sort((a, b) => b.t - a.t)) {
      const split = splitSegmentAt(next, edge, cut.t / end);
      if (split < 0) continue;
      // The split only appends one temporary vertex. Reuse the shared junction.
      for (const s of [
        next.segments[edge],
        next.segments[next.segments.length - 1],
      ]) {
        if (s.start === split) s.start = cut.vertex;
        if (s.end === split) s.end = cut.vertex;
      }
      next.vertices.pop();
      end = cut.t;
    }
  }
  return next;
}
