import type { VectorNetworkSerializedNode } from '../types/serialized-node';
import {
  type VectorRegionLike,
} from './vector-network-fill';
import {
  type VectorSegmentLike,
  type VectorVertexLike,
} from './vector-network-stroke';

const EPS = 1e-6;

type OrientedSegment = {
  seg: VectorSegmentLike;
  from: number;
  to: number;
};

type AdjEntry = { seg: number; other: number };

function fmt(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, '');
}

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

function orientedSegmentPath(
  vertices: VectorVertexLike[],
  seg: VectorSegmentLike,
  from: number,
  to: number,
  moveToFirst: boolean,
): string {
  const p0 = vertices[from];
  const p3 = vertices[to];
  if (!p0 || !p3) {
    return '';
  }

  let ts: VectorVertexLike | undefined;
  let te: VectorVertexLike | undefined;
  if (from === seg.start && to === seg.end) {
    ts = seg.tangentStart;
    te = seg.tangentEnd;
  } else if (from === seg.end && to === seg.start) {
    ts = seg.tangentEnd;
    te = seg.tangentStart;
  } else {
    return '';
  }

  const x0 = p0.x;
  const y0 = p0.y;
  const x3 = p3.x;
  const y3 = p3.y;
  const x1 = x0 + (ts?.x ?? 0);
  const y1 = y0 + (ts?.y ?? 0);
  const x2 = x3 + (te?.x ?? 0);
  const y2 = y3 + (te?.y ?? 0);

  const straight =
    Math.hypot(x1 - x0, y1 - y0) < EPS &&
    Math.hypot(x2 - x3, y2 - y3) < EPS;
  if (moveToFirst) {
    if (straight) {
      return `M ${fmt(x0)} ${fmt(y0)} L ${fmt(x3)} ${fmt(y3)}`;
    }
    return `M ${fmt(x0)} ${fmt(y0)} C ${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x3)} ${fmt(y3)}`;
  }
  if (straight) {
    return ` L ${fmt(x3)} ${fmt(y3)}`;
  }
  return ` C ${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x3)} ${fmt(y3)}`;
}

function collectStrokeChains(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
): OrientedSegment[][] {
  if (!vertices.length || !segments.length) {
    return [];
  }

  const vertexCount = vertices.length;
  const adj = buildAdjacency(segments, vertexCount);
  const used = new Array(segments.length).fill(false);
  const chains: OrientedSegment[][] = [];

  for (let si = 0; si < segments.length; si++) {
    if (used[si]) {
      continue;
    }
    const s = segments[si];
    const chain: OrientedSegment[] = [{ seg: s, from: s.start, to: s.end }];
    used[si] = true;

    let current = s.end;
    while (true) {
      const next = pickSingleUnusedEdge(current, adj, used);
      if (!next) {
        break;
      }
      chain.push({
        seg: segments[next.seg],
        from: current,
        to: next.other,
      });
      used[next.seg] = true;
      current = next.other;
    }

    current = s.start;
    while (true) {
      const next = pickSingleUnusedEdge(current, adj, used);
      if (!next) {
        break;
      }
      chain.unshift({
        seg: segments[next.seg],
        from: next.other,
        to: current,
      });
      used[next.seg] = true;
      current = next.other;
    }

    chains.push(chain);
  }

  return chains;
}

function chainToPathD(
  chain: OrientedSegment[],
  vertices: VectorVertexLike[],
): string {
  let d = '';
  chain.forEach(({ seg, from, to }, i) => {
    d += orientedSegmentPath(vertices, seg, from, to, i === 0);
  });
  return d;
}

function loopToPathD(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  loop: ReadonlyArray<number>,
): string {
  if (loop.length === 0) {
    return '';
  }

  let d = '';
  let prevVertexIdx = -1;
  let firstMove = true;

  for (let k = 0; k < loop.length; k++) {
    const segIdx = loop[k];
    if (segIdx < 0 || segIdx >= segments.length) {
      continue;
    }
    const seg = segments[segIdx];
    let from = seg.start;
    let to = seg.end;
    if (prevVertexIdx >= 0) {
      if (seg.start === prevVertexIdx) {
        from = seg.start;
        to = seg.end;
      } else if (seg.end === prevVertexIdx) {
        from = seg.end;
        to = seg.start;
      }
    }

    d += orientedSegmentPath(vertices, seg, from, to, firstMove);
    firstMove = false;
    prevVertexIdx = to;
  }

  return d ? `${d} Z` : '';
}

function resolveFillRule(
  regions: VectorNetworkSerializedNode['regions'],
): CanvasFillRule {
  const region = regions?.[0] as VectorRegionLike | undefined;
  if (!region) {
    return 'nonzero';
  }
  if (region.fillRule) {
    return region.fillRule;
  }
  const w = region.windingRule;
  if (w === 'EVENODD' || w === 'evenodd') {
    return 'evenodd';
  }
  return 'nonzero';
}

/** Closed region loops as one SVG path `d` (multiple subpaths). */
export function buildVectorNetworkFillPathD(
  vertices: VectorVertexLike[] | undefined,
  segments: VectorSegmentLike[] | undefined,
  regions: VectorNetworkSerializedNode['regions'],
): string {
  if (!vertices?.length || !segments?.length || !regions?.length) {
    return '';
  }

  const parts: string[] = [];
  for (const region of regions) {
    for (const loop of region.loops) {
      const loopD = loopToPathD(vertices, segments, loop);
      if (loopD) {
        parts.push(loopD);
      }
    }
  }
  return parts.join(' ');
}

/** Open / branched stroke chains as one SVG path `d` (multiple subpaths). */
export function buildVectorNetworkStrokePathD(
  vertices: VectorVertexLike[] | undefined,
  segments: VectorSegmentLike[] | undefined,
): string {
  if (!vertices?.length || !segments?.length) {
    return '';
  }

  return collectStrokeChains(vertices, segments)
    .map((chain) => chainToPathD(chain, vertices))
    .filter(Boolean)
    .join(' ');
}

export { resolveFillRule as resolveVectorNetworkFillRule };
