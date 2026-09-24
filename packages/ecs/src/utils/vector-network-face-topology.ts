import type {
  VectorNetworkData,
  VectorTopologyResult,
} from './vector-network-topology';
import { vectorSegmentCubic, pointOnVectorCubic } from './vector-network-curve';
import { orientVectorLoop } from './vector-network-loop';
import {
  findVectorNetworkFaces,
  vectorNetworkFaceAtPoint,
  vectorNetworkFaceFillStates,
} from './vector-network-region';

export type VectorFaceTopologyFailure =
  | 'invalid-vertex'
  | 'invalid-network'
  | 'same-vertex'
  | 'no-shared-face'
  | 'crossing-cut'
  | 'not-interior-edge'
  | 'different-fills'
  | 'unsupported-topology';
export type VectorFaceTopologyResult =
  | Extract<VectorTopologyResult, { ok: true }>
  | { ok: false; reason: VectorFaceTopologyFailure };

const EPS = 1e-7;
const failure = (
  reason: VectorFaceTopologyFailure,
): VectorFaceTopologyResult => ({ ok: false, reason });
const clone = (network: VectorNetworkData): VectorNetworkData => ({
  vertices: network.vertices.map((v) => ({ ...v })),
  segments: network.segments.map((s) => ({
    ...s,
    ...(s.tangentStart ? { tangentStart: { ...s.tangentStart } } : {}),
    ...(s.tangentEnd ? { tangentEnd: { ...s.tangentEnd } } : {}),
  })),
  regions: (network.regions ?? []).map((r) => ({
    ...r,
    loops: r.loops.map((l) => [...l]),
  })),
});
const valid = (n: VectorNetworkData) =>
  n.vertices.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y)) &&
  n.segments.every(
    (s) =>
      Number.isInteger(s.start) &&
      Number.isInteger(s.end) &&
      !!vectorSegmentCubic(n.vertices, s),
  ) &&
  (n.regions ?? []).every(
    (r) =>
      r.loops.length && r.loops.every((l) => !!orientVectorLoop(n.segments, l)),
  );

// Roots on monotone intervals include tangencies at derivative extrema.
const coefficients = (v: number[]) => [
  v[0],
  3 * (v[1] - v[0]),
  3 * (v[2] - 2 * v[1] + v[0]),
  v[3] - 3 * v[2] + 3 * v[1] - v[0],
];
const evaluate = (c: number[], t: number) =>
  c[0] + t * (c[1] + t * (c[2] + t * c[3]));
function extrema(c: number[]) {
  const a = 3 * c[3],
    b = 2 * c[2],
    d = c[1];
  const scale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(d));
  if (Math.abs(a) < 1e-14 * scale)
    return Math.abs(b) < 1e-14 * scale ? [] : [-d / b];
  const discriminant = b * b - 4 * a * d;
  if (discriminant < 0) return [];
  // Avoid cancellation when one derivative root is much smaller than the other.
  const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant));
  return q === 0 ? [-b / (2 * a)] : [q / a, d / q];
}
function roots(c: number[]) {
  const points = [0, ...extrema(c).filter((t) => t > 0 && t < 1), 1].sort(
    (a, b) => a - b,
  );
  const found = points.filter((t) => Math.abs(evaluate(c, t)) <= EPS);
  for (let i = 1; i < points.length; i++) {
    let lo = points[i - 1],
      hi = points[i],
      flo = evaluate(c, lo);
    if (flo * evaluate(c, hi) >= 0) continue;
    for (let j = 0; j < 48; j++) {
      const mid = (lo + hi) / 2,
        value = evaluate(c, mid);
      if (value > 0 === flo > 0) {
        lo = mid;
        flo = value;
      } else hi = mid;
    }
    found.push((lo + hi) / 2);
  }
  return found;
}

/** Reject contacts with any existing edge except the two chosen endpoint incidences. */
function clearSeam(network: VectorNetworkData, from: number, to: number) {
  const a = network.vertices[from],
    b = network.vertices[to],
    dx = b.x - a.x,
    dy = b.y - a.y;
  const length = Math.hypot(dx, dy),
    ux = dx / length,
    uy = dy / length;
  if (length <= EPS) return false;
  return network.segments.every((edge) => {
    const curve = vectorSegmentCubic(network.vertices, edge)!;
    const signed = coefficients(
      curve.map((p) => ux * (p[1] - a.y) - uy * (p[0] - a.x)),
    );
    const along = coefficients(
      curve.map((p) => ux * (p[0] - a.x) + uy * (p[1] - a.y)),
    );
    if (signed.every((v) => Math.abs(v) <= EPS)) {
      const values = [
        0,
        1,
        ...extrema(along).filter((t) => t > 0 && t < 1),
      ].map((t) => evaluate(along, t));
      const lo = Math.max(0, Math.min(...values)),
        hi = Math.min(length, Math.max(...values));
      if (hi < lo - EPS) return true;
      // A collinear edge may depart away from a shared endpoint, never overlap the seam.
      if (hi - lo > EPS) return false;
      return (
        (hi <= EPS && (edge.start === from || edge.end === from)) ||
        (lo >= length - EPS && (edge.start === to || edge.end === to))
      );
    }
    return roots(signed).every((t) => {
      const p = pointOnVectorCubic(curve, t),
        s = ux * (p[0] - a.x) + uy * (p[1] - a.y);
      if (s < -EPS || s > length + EPS) return true;
      const vertex = t <= 1e-9 ? edge.start : t >= 1 - 1e-9 ? edge.end : -1;
      return (
        (vertex === from && Math.abs(s) <= EPS) ||
        (vertex === to && Math.abs(s - length) <= EPS)
      );
    });
  });
}

/** Add a straight seam inside one planar face, splitting it or joining two boundary components. */
export function cutVectorNetworkFace(
  network: VectorNetworkData,
  from: number,
  to: number,
): VectorFaceTopologyResult {
  if (![from, to].every((i) => Number.isInteger(i) && !!network.vertices[i]))
    return failure('invalid-vertex');
  if (from === to) return failure('same-vertex');
  if (!valid(network)) return failure('invalid-network');
  const faces = findVectorNetworkFaces(network.vertices, network.segments);
  const a = network.vertices[from],
    b = network.vertices[to];
  const face = vectorNetworkFaceAtPoint(faces, [
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
  ]);
  if (!face) return failure('no-shared-face');
  const walks = face.region.loops.map((loop) =>
    orientVectorLoop(network.segments, loop),
  );
  if (walks.some((walk) => !walk)) return failure('unsupported-topology');
  const boundaries = walks.map((walk) => walk!.map((e) => e.from));
  const fromBoundary = boundaries.findIndex((b) => b.includes(from));
  const toBoundary = boundaries.findIndex((b) => b.includes(to));
  if (fromBoundary === -1 || toBoundary === -1)
    return failure('no-shared-face');
  if (!clearSeam(network, from, to)) return failure('crossing-cut');
  // Joining different boundary components opens a hole without adding a face.
  // Later cuts may split that face: its walk now visits the bridge twice.
  const joinsBoundaries = fromBoundary !== toBoundary;
  const next = clone(network);
  next.segments.push({ start: from, end: to });
  const resultFaces = findVectorNetworkFaces(next.vertices, next.segments);
  if (resultFaces.length !== faces.length + (joinsBoundaries ? 0 : 1))
    return failure('unsupported-topology');
  const filled = vectorNetworkFaceFillStates(
    network.vertices,
    network.segments,
    network.regions,
    resultFaces,
  );
  if (filled.some((state) => state === null))
    return failure('unsupported-topology');
  next.regions = resultFaces.filter((_, i) => filled[i]).map((f) => f.region);
  return {
    ok: true,
    network: next,
    selectedVertex: from,
    vertexMap: network.vertices.map((_, i) => [i]),
    segmentMap: network.segments.map((_, i) => [i]),
  };
}

/** Remove a shared edge between equally filled faces, or a bridge joining boundary components. */
export function uncutVectorNetworkEdge(
  network: VectorNetworkData,
  edgeIndex: number,
): VectorFaceTopologyResult {
  if (!Number.isInteger(edgeIndex) || !network.segments[edgeIndex])
    return failure('not-interior-edge');
  if (!valid(network)) return failure('invalid-network');
  const faces = findVectorNetworkFaces(network.vertices, network.segments);
  const incident = faces.filter((f) =>
    f.region.loops.some((l) => l.includes(edgeIndex)),
  );
  const uses = incident.map(
    (f) => f.region.loops.flat().filter((e) => e === edgeIndex).length,
  );
  const bridge = incident.length === 1 && uses[0] === 2;
  if (!bridge && (incident.length !== 2 || uses.some((count) => count !== 1)))
    return failure('not-interior-edge');
  const states = vectorNetworkFaceFillStates(
    network.vertices,
    network.segments,
    network.regions,
    incident,
  );
  if (states.some((state) => state === null))
    return failure('unsupported-topology');
  if (!bridge && states[0] !== states[1]) return failure('different-fills');
  const next = clone(network);
  next.segments.splice(edgeIndex, 1);
  const resultFaces = findVectorNetworkFaces(next.vertices, next.segments);
  if (resultFaces.length !== faces.length - (bridge ? 0 : 1))
    return failure('unsupported-topology');
  if (bridge) {
    const boundaryCount = (fs: typeof faces) =>
      fs.reduce((count, f) => count + f.region.loops.length, 0);
    // A dangling stroke also appears twice in a face walk. Only remove seams
    // that actually separate boundary components, preserving dangling artwork.
    if (boundaryCount(resultFaces) !== boundaryCount(faces) + 1)
      return failure('not-interior-edge');
  }
  const filled = vectorNetworkFaceFillStates(
    network.vertices,
    network.segments,
    network.regions,
    resultFaces,
  );
  if (filled.some((state) => state === null))
    return failure('unsupported-topology');
  next.regions = resultFaces.filter((_, i) => filled[i]).map((f) => f.region);
  return {
    ok: true,
    network: next,
    selectedVertex: network.segments[edgeIndex].start,
    vertexMap: network.vertices.map((_, i) => [i]),
    segmentMap: network.segments.map((_, i) =>
      i === edgeIndex ? [] : [i > edgeIndex ? i - 1 : i],
    ),
  };
}
