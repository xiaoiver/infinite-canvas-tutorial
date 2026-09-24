import type {
  VectorNetworkData,
  VectorTopologyResult,
} from './vector-network-topology';
import { vectorSegmentCubic } from './vector-network-curve';
import { orientVectorLoop } from './vector-network-loop';

/** One occurrence, so repeated uses of an edge in a boundary remain distinguishable. */
export interface VectorEdgeUse {
  regionIndex: number;
  loopIndex: number;
  offset: number;
}
export type VectorEdgeTopologyResult =
  | (Extract<VectorTopologyResult, { ok: true }> & { selectedSegment: number })
  | {
      ok: false;
      reason:
        | 'invalid-edge'
        | 'invalid-network'
        | 'invalid-uses'
        | 'same-edge'
        | 'different-geometry'
        | 'incompatible-endpoints'
        | 'collapsed-region'
        | 'incompatible-winding';
    };
const fail = (
  reason: Extract<VectorEdgeTopologyResult, { ok: false }>['reason'],
): VectorEdgeTopologyResult => ({ ok: false, reason });
const clone = (n: VectorNetworkData): VectorNetworkData => ({
  vertices: n.vertices.map((v) => ({ ...v })),
  segments: n.segments.map((s) => ({
    ...s,
    ...(s.tangentStart ? { tangentStart: { ...s.tangentStart } } : {}),
    ...(s.tangentEnd ? { tangentEnd: { ...s.tangentEnd } } : {}),
  })),
  ...(n.regions !== undefined
    ? {
        regions: n.regions.map((r) => ({
          ...r,
          loops: r.loops.map((l) => [...l]),
        })),
      }
    : {}),
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
const edgeExists = (n: VectorNetworkData, i: number) =>
  Number.isInteger(i) && !!n.segments[i];

export function vectorEdgeUses(
  n: VectorNetworkData,
  edge: number,
): VectorEdgeUse[] {
  if (!edgeExists(n, edge)) return [];
  return (n.regions ?? []).flatMap((r, regionIndex) =>
    r.loops.flatMap((l, loopIndex) =>
      l.flatMap((e, offset) =>
        e === edge ? [{ regionIndex, loopIndex, offset }] : [],
      ),
    ),
  );
}

/** Match absolute cubic control points, allowing reversed storage direction. */
export function coincidentVectorEdges(
  n: VectorNetworkData,
  source: number,
  target: number,
): 'forward' | 'reverse' | null {
  if (!edgeExists(n, source) || !edgeExists(n, target)) return null;
  const a = vectorSegmentCubic(n.vertices, n.segments[source]),
    b = vectorSegmentCubic(n.vertices, n.segments[target]);
  if (!a || !b) return null;
  const matches = (reverse: boolean) =>
    a.every(
      (p, i) =>
        Math.hypot(
          p[0] - b[reverse ? 3 - i : i][0],
          p[1] - b[reverse ? 3 - i : i][1],
        ) <= 1e-6,
    );
  return matches(false) ? 'forward' : matches(true) ? 'reverse' : null;
}

/** Duplicate an edge and move a nonempty proper subset of region uses to it. End vertices stay shared. */
export function unglueVectorNetworkEdge(
  n: VectorNetworkData,
  edge: number,
  uses: readonly VectorEdgeUse[],
): VectorEdgeTopologyResult {
  if (!edgeExists(n, edge)) return fail('invalid-edge');
  if (!valid(n)) return fail('invalid-network');
  const key = (u: VectorEdgeUse) =>
    `${u.regionIndex}/${u.loopIndex}/${u.offset}`;
  const incident = vectorEdgeUses(n, edge),
    available = new Set(incident.map(key)),
    chosen = new Set(uses.map(key));
  if (
    !uses.length ||
    uses.length >= incident.length ||
    chosen.size !== uses.length ||
    [...chosen].some((k) => !available.has(k))
  )
    return fail('invalid-uses');
  const next = clone(n),
    selectedSegment = next.segments.length;
  const copy = clone({ vertices: [], segments: [n.segments[edge]] })
    .segments[0];
  next.segments.push(copy);
  next.regions = next.regions!.map((r, regionIndex) => ({
    ...r,
    loops: r.loops.map((l, loopIndex) =>
      l.map((e, offset) =>
        chosen.has(key({ regionIndex, loopIndex, offset }))
          ? selectedSegment
          : e,
      ),
    ),
  }));
  return {
    ok: true,
    network: next,
    selectedVertex: copy.start,
    selectedSegment,
    vertexMap: n.vertices.map((_, i) => [i]),
    segmentMap: n.segments.map((_, i) =>
      i === edge ? [i, selectedSegment] : [i],
    ),
  };
}

/** Merge only the requested coincident edges, welding coincident endpoint vertices. */
export function glueVectorNetworkEdges(
  n: VectorNetworkData,
  source: number,
  target: number,
): VectorEdgeTopologyResult {
  if (!edgeExists(n, source) || !edgeExists(n, target))
    return fail('invalid-edge');
  if (source === target) return fail('same-edge');
  if (!valid(n)) return fail('invalid-network');
  const direction = coincidentVectorEdges(n, source, target);
  if (!direction) return fail('different-geometry');
  const a = n.segments[source],
    b = n.segments[target];
  if ((a.start === a.end) !== (b.start === b.end))
    return fail('incompatible-endpoints');
  if (
    (n.regions ?? []).some((r) =>
      r.loops.some((l) => l.includes(source) && l.includes(target)),
    )
  )
    return fail('collapsed-region');
  const parent = n.vertices.map((_, i) => i);
  const root = (i: number): number =>
    parent[i] === i ? i : (parent[i] = root(parent[i]));
  const weld = (from: number, to: number) => {
    parent[root(from)] = root(to);
  };
  weld(a.start, direction === 'forward' ? b.start : b.end);
  weld(a.end, direction === 'forward' ? b.end : b.start);
  if (b.start !== b.end && root(b.start) === root(b.end))
    return fail('incompatible-endpoints');
  const next = clone(n),
    indices = new Map<number, number>();
  next.vertices = next.vertices.filter((_, i) => {
    if (root(i) !== i) return false;
    indices.set(i, indices.size);
    return true;
  });
  const vertexMap = n.vertices.map((_, i) => [indices.get(root(i))!]);
  const selectedSegment = target - (source < target ? 1 : 0);
  const segmentMap = n.segments.map((_, i) => [
    i === source ? selectedSegment : i - (i > source ? 1 : 0),
  ]);
  next.segments = next.segments
    .filter((_, i) => i !== source)
    .map((e) => ({
      ...e,
      start: vertexMap[e.start][0],
      end: vertexMap[e.end][0],
    }));
  next.regions = next.regions?.map((r) => ({
    ...r,
    loops: r.loops.map((l) => l.map((e) => segmentMap[e][0])),
  }));
  if (
    (next.regions ?? []).some((r) =>
      r.loops.some((l) => !orientVectorLoop(next.segments, l)),
    )
  )
    return fail('invalid-network');
  // Unsigned edge-index loops cannot express a reversed self-loop occurrence.
  // A uniform reversal preserves nonzero fill, but partial reversals can fill holes.
  for (let r = 0; r < (n.regions?.length ?? 0); r++) {
    const region = n.regions[r];
    const evenodd = region.fillRule
      ? region.fillRule === 'evenodd'
      : region.windingRule?.toLowerCase() === 'evenodd';
    if (evenodd) continue;
    const reversedLoops: boolean[] = [];
    for (let l = 0; l < region.loops.length; l++) {
      const before = orientVectorLoop(n.segments, region.loops[l])!;
      const after = orientVectorLoop(next.segments, next.regions[r].loops[l])!;
      const changed = before.map(
        (step, i) =>
          step.reversed !==
          (after[i].reversed !==
            (step.segmentIndex === source && direction === 'reverse')),
      );
      if (changed.some((v) => v !== changed[0]))
        return fail('incompatible-winding');
      reversedLoops.push(changed[0]);
    }
    if (reversedLoops.some((v) => v !== reversedLoops[0]))
      return fail('incompatible-winding');
  }
  return {
    ok: true,
    network: next,
    vertexMap,
    segmentMap,
    selectedSegment,
    selectedVertex: next.segments[selectedSegment].start,
  };
}
