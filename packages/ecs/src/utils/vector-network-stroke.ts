import { vec2 } from 'gl-matrix';
import { CubicBezierCurve } from './curve/cubic-bezier-curve';

const EPS = 1e-6;

/** Figma-style: P1 = start + tangentStart, P2 = end + tangentEnd (relative offsets). */
export interface VectorVertexLike {
  x: number;
  y: number;
  /** Per-vertex stroke cap (open chain endpoints use the corresponding vertex). */
  strokeLinecap?: CanvasLineCap;
  /** Per-vertex stroke join (graph corners; tessellation interior uses global join). */
  strokeLinejoin?: CanvasLineJoin;
}

export interface VectorSegmentLike {
  start: number;
  end: number;
  tangentStart?: VectorVertexLike;
  tangentEnd?: VectorVertexLike;
}

function reverseFlatPoints(flat: number[]): number[] {
  const out: number[] = [];
  for (let i = flat.length - 2; i >= 0; i -= 2) {
    out.push(flat[i], flat[i + 1]);
  }
  return out;
}

function appendWithoutDuplicateJoin(
  base: number[],
  extension: number[],
): void {
  if (extension.length === 0) {
    return;
  }
  if (base.length >= 2) {
    const lx = base[base.length - 2];
    const ly = base[base.length - 1];
    const fx = extension[0];
    const fy = extension[1];
    if (
      Math.abs(lx - fx) < EPS &&
      Math.abs(ly - fy) < EPS
    ) {
      base.push(...extension.slice(2));
      return;
    }
  }
  base.push(...extension);
}

function prependWithoutDuplicateJoin(
  base: number[],
  prefix: number[],
): void {
  if (prefix.length === 0) {
    return;
  }
  if (base.length >= 2 && prefix.length >= 2) {
    const bx = base[0];
    const by = base[1];
    const lx = prefix[prefix.length - 2];
    const ly = prefix[prefix.length - 1];
    if (
      Math.abs(lx - bx) < EPS &&
      Math.abs(ly - by) < EPS
    ) {
      base.unshift(...prefix.slice(0, -2));
      return;
    }
  }
  base.unshift(...prefix);
}

function isStraightCubic(
  p0: vec2,
  p1: vec2,
  p2: vec2,
  p3: vec2,
): boolean {
  return (
    vec2.squaredDistance(p0, p1) < EPS * EPS &&
    vec2.squaredDistance(p2, p3) < EPS * EPS
  );
}

function divisionsForCubic(
  p0: vec2,
  p1: vec2,
  p2: vec2,
  p3: vec2,
): number {
  if (isStraightCubic(p0, p1, p2, p3)) {
    return 1;
  }
  const chord = vec2.distance(p0, p3);
  const hull =
    vec2.distance(p0, p1) + vec2.distance(p1, p2) + vec2.distance(p2, p3);
  const approx = Math.max(chord, hull * 0.35);
  let d = Math.ceil(approx / 6);
  d = Math.min(64, Math.max(8, d));
  return d;
}

/**
 * Samples one network segment as defined in storage (start → end).
 */
export function tessellateVectorSegment(
  vertices: VectorVertexLike[],
  seg: VectorSegmentLike,
): number[] {
  const a = vertices[seg.start];
  const b = vertices[seg.end];
  if (!a || !b) {
    return [];
  }

  const p0 = vec2.fromValues(a.x, a.y);
  const p3 = vec2.fromValues(b.x, b.y);

  const ts = seg.tangentStart;
  const te = seg.tangentEnd;
  const p1 = vec2.create();
  const p2 = vec2.create();
  vec2.add(p1, p0, vec2.fromValues(ts?.x ?? 0, ts?.y ?? 0));
  vec2.add(p2, p3, vec2.fromValues(te?.x ?? 0, te?.y ?? 0));

  if (vec2.squaredDistance(p0, p3) < EPS * EPS) {
    return [p0[0], p0[1], p3[0], p3[1]];
  }

  const divisions = divisionsForCubic(p0, p1, p2, p3);
  const curve = new CubicBezierCurve(
    vec2.clone(p0),
    vec2.clone(p1),
    vec2.clone(p2),
    vec2.clone(p3),
  );

  const pts = curve.getPoints(divisions);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    out.push(pts[i][0], pts[i][1]);
  }
  return out;
}

function tessellateOriented(
  vertices: VectorVertexLike[],
  seg: VectorSegmentLike,
  from: number,
  to: number,
): number[] {
  const pts = tessellateVectorSegment(vertices, seg);
  if (pts.length === 0) {
    return [];
  }
  if (seg.start === from && seg.end === to) {
    return pts;
  }
  if (seg.end === from && seg.start === to) {
    return reverseFlatPoints(pts);
  }
  return [];
}

/** -1 = tessellation interior (use global stroke linejoin). */
type VertexId = number | -1;

function tessellateVectorSegmentWithVertexIds(
  vertices: VectorVertexLike[],
  seg: VectorSegmentLike,
): { xy: number[]; vid: VertexId[] } {
  const xy = tessellateVectorSegment(vertices, seg);
  const n = xy.length / 2;
  if (n === 0) {
    return { xy, vid: [] };
  }
  const vid: VertexId[] = new Array(n).fill(-1);
  vid[0] = seg.start;
  vid[n - 1] = seg.end;
  return { xy, vid };
}

function reverseVid(vid: VertexId[]): VertexId[] {
  return [...vid].reverse();
}

function tessellateOrientedWithVertexIds(
  vertices: VectorVertexLike[],
  seg: VectorSegmentLike,
  from: number,
  to: number,
): { xy: number[]; vid: VertexId[] } {
  const { xy, vid } = tessellateVectorSegmentWithVertexIds(vertices, seg);
  if (xy.length === 0) {
    return { xy, vid: [] };
  }
  if (seg.start === from && seg.end === to) {
    return { xy, vid };
  }
  if (seg.end === from && seg.start === to) {
    return { xy: reverseFlatPoints(xy), vid: reverseVid(vid) };
  }
  return { xy: [], vid: [] };
}

function appendWithoutDuplicateJoinWithVertexIds(
  base: number[],
  baseVid: VertexId[],
  extension: number[],
  extVid: VertexId[],
): void {
  if (extension.length === 0) {
    return;
  }
  if (base.length >= 2) {
    const lx = base[base.length - 2];
    const ly = base[base.length - 1];
    const fx = extension[0];
    const fy = extension[1];
    if (
      Math.abs(lx - fx) < EPS &&
      Math.abs(ly - fy) < EPS
    ) {
      base.push(...extension.slice(2));
      baseVid.push(...extVid.slice(1));
      return;
    }
  }
  base.push(...extension);
  baseVid.push(...extVid);
}

function prependWithoutDuplicateJoinWithVertexIds(
  base: number[],
  baseVid: VertexId[],
  prefix: number[],
  prefixVid: VertexId[],
): void {
  if (prefix.length === 0) {
    return;
  }
  if (base.length >= 2 && prefix.length >= 2) {
    const bx = base[0];
    const by = base[1];
    const lx = prefix[prefix.length - 2];
    const ly = prefix[prefix.length - 1];
    if (
      Math.abs(lx - bx) < EPS &&
      Math.abs(ly - by) < EPS
    ) {
      base.unshift(...prefix.slice(0, -2));
      baseVid.unshift(...prefixVid.slice(0, -1));
      return;
    }
  }
  base.unshift(...prefix);
  baseVid.unshift(...prefixVid);
}

function strokeMetaForChainPoints(
  vertices: VectorVertexLike[],
  vid: VertexId[],
  n: number,
): { linejoin: (CanvasLineJoin | undefined)[]; linecap: (CanvasLineCap | undefined)[] } {
  const linejoin: (CanvasLineJoin | undefined)[] = new Array(n);
  const linecap: (CanvasLineCap | undefined)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    linejoin[i] = undefined;
    linecap[i] = undefined;
    const vi = vid[i];
    if (vi < 0) {
      continue;
    }
    const vx = vertices[vi];
    if (!vx) {
      continue;
    }
    if (i === 0 || i === n - 1) {
      if (vx.strokeLinecap !== undefined) {
        linecap[i] = vx.strokeLinecap;
      }
    }
    if (i > 0 && i < n - 1 && vi >= 0) {
      if (vx.strokeLinejoin !== undefined) {
        linejoin[i] = vx.strokeLinejoin;
      }
    }
  }
  return { linejoin, linecap };
}

export type VectorNetworkStrokePointMeta = {
  /** Length = points.length / 2, aligned with [x,y] pairs (including NaN separators). */
  linejoin?: (CanvasLineJoin | undefined)[];
  linecap?: (CanvasLineCap | undefined)[];
};

/**
 * Same as {@link vectorNetworkToFlatStrokePoints} plus optional per-vertex stroke overrides
 * from {@link VectorVertexLike.strokeLinecap} / {@link VectorVertexLike.strokeLinejoin}.
 */
export function vectorNetworkToFlatStrokePointsWithMeta(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
): { points: number[] } & VectorNetworkStrokePointMeta {
  if (!vertices?.length || !segments?.length) {
    return { points: [] };
  }

  const vertexCount = vertices.length;
  const adj = buildAdjacency(segments, vertexCount);
  const used = new Array(segments.length).fill(false);
  const out: number[] = [];
  const linejoinOut: (CanvasLineJoin | undefined)[] = [];
  const linecapOut: (CanvasLineCap | undefined)[] = [];

  for (let si = 0; si < segments.length; si++) {
    if (used[si]) {
      continue;
    }

    const s = segments[si];
    const chain0 = tessellateOrientedWithVertexIds(vertices, s, s.start, s.end);
    const chain = chain0.xy;
    const chainVid = chain0.vid;
    used[si] = true;

    let current = s.end;
    while (true) {
      const next = pickSingleUnusedEdge(current, adj, used);
      if (!next) {
        break;
      }
      const piece = tessellateOrientedWithVertexIds(
        vertices,
        segments[next.seg],
        current,
        next.other,
      );
      appendWithoutDuplicateJoinWithVertexIds(
        chain,
        chainVid,
        piece.xy,
        piece.vid,
      );
      used[next.seg] = true;
      current = next.other;
    }

    current = s.start;
    while (true) {
      const next = pickSingleUnusedEdge(current, adj, used);
      if (!next) {
        break;
      }
      const piece = tessellateOrientedWithVertexIds(
        vertices,
        segments[next.seg],
        current,
        next.other,
      );
      prependWithoutDuplicateJoinWithVertexIds(
        chain,
        chainVid,
        piece.xy,
        piece.vid,
      );
      used[next.seg] = true;
      current = next.other;
    }

    if (chain.length === 0) {
      continue;
    }

    const nPt = chain.length / 2;
    const strokeMeta = strokeMetaForChainPoints(vertices, chainVid, nPt);

    if (out.length > 0) {
      out.push(NaN, NaN);
      linejoinOut.push(undefined);
      linecapOut.push(undefined);
    }
    for (let k = 0; k < nPt; k++) {
      linejoinOut.push(strokeMeta.linejoin[k]);
      linecapOut.push(strokeMeta.linecap[k]);
    }
    out.push(...chain);
  }

  const hasAny =
    linejoinOut.some((v) => v !== undefined) ||
    linecapOut.some((v) => v !== undefined);
  if (!hasAny || out.length === 0) {
    return { points: out };
  }
  return {
    points: out,
    linejoin: linejoinOut,
    linecap: linecapOut,
  };
}

type AdjEntry = { seg: number; other: number };

function buildAdjacency(
  segments: VectorSegmentLike[],
  vertexCount: number,
): AdjEntry[][] {
  const adj: AdjEntry[][] = Array.from({ length: vertexCount }, () => []);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (
      s.start < 0 ||
      s.end < 0 ||
      s.start >= vertexCount ||
      s.end >= vertexCount
    ) {
      continue;
    }
    adj[s.start].push({ seg: i, other: s.end });
    adj[s.end].push({ seg: i, other: s.start });
  }
  return adj;
}

function pickSingleUnusedEdge(
  v: number,
  adj: AdjEntry[][],
  used: boolean[],
): AdjEntry | null {
  const list = adj[v];
  if (!list) {
    return null;
  }
  let found: AdjEntry | null = null;
  for (const e of list) {
    if (used[e.seg]) {
      continue;
    }
    if (found) {
      return null;
    }
    found = e;
  }
  return found;
}

/**
 * Expands a vector network into flat stroke coordinates for polyline rendering.
 * - Cubic edges are tessellated (Figma tangent convention).
 * - Edges meeting at degree-2 vertices are merged into one subpath (joins instead of caps).
 * - Branches (degree ≥ 3) start new subpaths (NaN separators).
 */
export function vectorNetworkToFlatStrokePoints(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
): number[] {
  return vectorNetworkToFlatStrokePointsWithMeta(vertices, segments).points;
}

/**
 * Axis-aligned bounds of segment control hulls (for stroke/fit).
 */
export function expandBoundsWithVectorSegments(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let nx = minX;
  let ny = minY;
  let xx = maxX;
  let xy = maxY;

  const expand = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    nx = Math.min(nx, x);
    ny = Math.min(ny, y);
    xx = Math.max(xx, x);
    xy = Math.max(xy, y);
  };

  for (const seg of segments) {
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    if (!a || !b) {
      continue;
    }
    const p0x = a.x;
    const p0y = a.y;
    const p3x = b.x;
    const p3y = b.y;
    const p1x = p0x + (seg.tangentStart?.x ?? 0);
    const p1y = p0y + (seg.tangentStart?.y ?? 0);
    const p2x = p3x + (seg.tangentEnd?.x ?? 0);
    const p2y = p3y + (seg.tangentEnd?.y ?? 0);
    expand(p0x, p0y);
    expand(p1x, p1y);
    expand(p2x, p2y);
    expand(p3x, p3y);
  }

  return { minX: nx, minY: ny, maxX: xx, maxY: xy };
}
