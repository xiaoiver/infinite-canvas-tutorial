import { path2Absolute } from '@antv/util';
import type {
  VectorSegmentLike,
  VectorVertexLike,
} from './vector-network-stroke';
import type { VectorRegionLike } from './vector-network-fill';

const EPS = 1e-6;

export interface VectorNetworkData {
  vertices: VectorVertexLike[];
  segments: VectorSegmentLike[];
  regions?: VectorRegionLike[];
}

/**
 * Builds Figma-style relative tangents for a cubic edge defined by absolute
 * control points: tangentStart = c1 - p0, tangentEnd = c2 - p3.
 * Straight cubics (control points coincide with their anchors) collapse to
 * undefined so the segment is stored as a straight line.
 */
function tangentsFromCubic(
  p0: [number, number],
  c1: [number, number],
  c2: [number, number],
  p3: [number, number],
): Pick<VectorSegmentLike, 'tangentStart' | 'tangentEnd'> {
  const ts = { x: c1[0] - p0[0], y: c1[1] - p0[1] };
  const te = { x: c2[0] - p3[0], y: c2[1] - p3[1] };
  const out: Pick<VectorSegmentLike, 'tangentStart' | 'tangentEnd'> = {};
  if (Math.abs(ts.x) > EPS || Math.abs(ts.y) > EPS) {
    out.tangentStart = ts;
  }
  if (Math.abs(te.x) > EPS || Math.abs(te.y) > EPS) {
    out.tangentEnd = te;
  }
  return out;
}

/** Quadratic (single control) → cubic control points. */
function quadraticToCubic(
  p0: [number, number],
  q: [number, number],
  p3: [number, number],
): { c1: [number, number]; c2: [number, number] } {
  return {
    c1: [p0[0] + (2 / 3) * (q[0] - p0[0]), p0[1] + (2 / 3) * (q[1] - p0[1])],
    c2: [p3[0] + (2 / 3) * (q[0] - p3[0]), p3[1] + (2 / 3) * (q[1] - p3[1])],
  };
}

function samePoint(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
}

/**
 * Converts an SVG path `d` string into a Figma-style {@link VectorNetworkData}.
 * - Each subpath becomes a chain of vertices/segments.
 * - Cubic (C/S) and quadratic (Q/T) commands keep their curvature via tangents.
 * - Closed subpaths (`Z`) emit a {@link VectorRegionLike} loop so fills survive.
 */
export function pathToVectorNetwork(
  d: string,
  fillRule: CanvasFillRule = 'nonzero',
): VectorNetworkData {
  const vertices: VectorVertexLike[] = [];
  const segments: VectorSegmentLike[] = [];
  const loops: number[][] = [];

  if (!d) {
    return { vertices, segments };
  }

  const commands = path2Absolute(d) as Array<[string, ...number[]]>;

  let current: [number, number] = [0, 0];
  let currentIndex = -1;
  let subpathStart: [number, number] = [0, 0];
  let subpathStartIndex = -1;
  let subpathSegments: number[] = [];
  // Reflected control point state for S / T smooth commands.
  let prevCubicControl: [number, number] | null = null;
  let prevQuadControl: [number, number] | null = null;

  const pushVertex = (p: [number, number]): number => {
    vertices.push({ x: p[0], y: p[1] });
    return vertices.length - 1;
  };

  const addSegment = (
    start: number,
    end: number,
    tangents?: Pick<VectorSegmentLike, 'tangentStart' | 'tangentEnd'>,
  ) => {
    segments.push({ start, end, ...(tangents ?? {}) });
    subpathSegments.push(segments.length - 1);
  };

  const flushSubpath = (closed: boolean) => {
    if (closed && subpathSegments.length > 0) {
      loops.push([...subpathSegments]);
    }
    subpathSegments = [];
  };

  for (const command of commands) {
    const type = command[0];
    const data = command.slice(1) as number[];

    switch (type) {
      case 'M': {
        flushSubpath(false);
        current = [data[0], data[1]];
        currentIndex = pushVertex(current);
        subpathStart = current;
        subpathStartIndex = currentIndex;
        prevCubicControl = null;
        prevQuadControl = null;
        // Additional coordinate pairs after M behave like L.
        for (let i = 2; i < data.length; i += 2) {
          const next: [number, number] = [data[i], data[i + 1]];
          const idx = pushVertex(next);
          addSegment(currentIndex, idx);
          current = next;
          currentIndex = idx;
        }
        break;
      }
      case 'L': {
        for (let i = 0; i < data.length; i += 2) {
          const next: [number, number] = [data[i], data[i + 1]];
          const idx = pushVertex(next);
          addSegment(currentIndex, idx);
          current = next;
          currentIndex = idx;
        }
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      case 'H': {
        for (let i = 0; i < data.length; i++) {
          const next: [number, number] = [data[i], current[1]];
          const idx = pushVertex(next);
          addSegment(currentIndex, idx);
          current = next;
          currentIndex = idx;
        }
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      case 'V': {
        for (let i = 0; i < data.length; i++) {
          const next: [number, number] = [current[0], data[i]];
          const idx = pushVertex(next);
          addSegment(currentIndex, idx);
          current = next;
          currentIndex = idx;
        }
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      case 'C': {
        for (let i = 0; i < data.length; i += 6) {
          const c1: [number, number] = [data[i], data[i + 1]];
          const c2: [number, number] = [data[i + 2], data[i + 3]];
          const next: [number, number] = [data[i + 4], data[i + 5]];
          const idx = pushVertex(next);
          addSegment(currentIndex, idx, tangentsFromCubic(current, c1, c2, next));
          current = next;
          currentIndex = idx;
          prevCubicControl = c2;
        }
        prevQuadControl = null;
        break;
      }
      case 'S': {
        for (let i = 0; i < data.length; i += 4) {
          const c1: [number, number] = prevCubicControl
            ? [2 * current[0] - prevCubicControl[0], 2 * current[1] - prevCubicControl[1]]
            : [current[0], current[1]];
          const c2: [number, number] = [data[i], data[i + 1]];
          const next: [number, number] = [data[i + 2], data[i + 3]];
          const idx = pushVertex(next);
          addSegment(currentIndex, idx, tangentsFromCubic(current, c1, c2, next));
          current = next;
          currentIndex = idx;
          prevCubicControl = c2;
        }
        prevQuadControl = null;
        break;
      }
      case 'Q': {
        for (let i = 0; i < data.length; i += 4) {
          const q: [number, number] = [data[i], data[i + 1]];
          const next: [number, number] = [data[i + 2], data[i + 3]];
          const { c1, c2 } = quadraticToCubic(current, q, next);
          const idx = pushVertex(next);
          addSegment(currentIndex, idx, tangentsFromCubic(current, c1, c2, next));
          current = next;
          currentIndex = idx;
          prevQuadControl = q;
        }
        prevCubicControl = null;
        break;
      }
      case 'T': {
        for (let i = 0; i < data.length; i += 2) {
          const q: [number, number] = prevQuadControl
            ? [2 * current[0] - prevQuadControl[0], 2 * current[1] - prevQuadControl[1]]
            : [current[0], current[1]];
          const next: [number, number] = [data[i], data[i + 1]];
          const { c1, c2 } = quadraticToCubic(current, q, next);
          const idx = pushVertex(next);
          addSegment(currentIndex, idx, tangentsFromCubic(current, c1, c2, next));
          current = next;
          currentIndex = idx;
          prevQuadControl = q;
        }
        prevCubicControl = null;
        break;
      }
      case 'Z':
      case 'z': {
        if (currentIndex !== subpathStartIndex && subpathStartIndex >= 0) {
          // Avoid a duplicate vertex when the final point already equals start.
          if (samePoint(current, subpathStart)) {
            // Re-point the last segment back to the subpath start vertex.
            const last = segments[segments.length - 1];
            if (last && last.end === currentIndex) {
              last.end = subpathStartIndex;
              vertices.pop();
              currentIndex = subpathStartIndex;
            } else {
              addSegment(currentIndex, subpathStartIndex);
            }
          } else {
            addSegment(currentIndex, subpathStartIndex);
          }
        }
        current = subpathStart;
        currentIndex = subpathStartIndex;
        prevCubicControl = null;
        prevQuadControl = null;
        flushSubpath(true);
        break;
      }
      default:
        // Unsupported commands (e.g. A) are skipped; callers should normalize
        // such paths to cubic beforehand if arc fidelity is required.
        break;
    }
  }

  flushSubpath(false);

  const data: VectorNetworkData = { vertices, segments };
  if (loops.length > 0) {
    data.regions = [{ fillRule, loops }];
  }
  return data;
}

function isStraightSegment(seg: VectorSegmentLike): boolean {
  const ts = seg.tangentStart;
  const te = seg.tangentEnd;
  return (
    (!ts || (Math.abs(ts.x) < EPS && Math.abs(ts.y) < EPS)) &&
    (!te || (Math.abs(te.x) < EPS && Math.abs(te.y) < EPS))
  );
}

/**
 * Splits the segment at index `segmentIndex` at parameter `t` (0..1), inserting
 * a new vertex. Loops in `regions` referencing the segment are rewritten so the
 * inserted segment index follows the original in topological order.
 * Returns the index of the newly inserted vertex.
 *
 * For straight segments the split is a simple midpoint; for cubic segments the
 * tangents are reassigned so the visual curve is preserved (de Casteljau).
 */
export function splitSegmentAt(
  network: VectorNetworkData,
  segmentIndex: number,
  t = 0.5,
): number {
  const { vertices, segments } = network;
  const seg = segments[segmentIndex];
  if (!seg) {
    return -1;
  }
  const clampedT = Math.min(1 - EPS, Math.max(EPS, t));

  let newVertex: VectorVertexLike;
  let firstHalf: VectorSegmentLike;
  let secondHalf: VectorSegmentLike;

  if (isStraightSegment(seg)) {
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    newVertex = {
      x: a.x + (b.x - a.x) * clampedT,
      y: a.y + (b.y - a.y) * clampedT,
    };
    firstHalf = { start: seg.start, end: -1 };
    secondHalf = { start: -1, end: seg.end };
  } else {
    // de Casteljau subdivision of the cubic at clampedT.
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    const p0: [number, number] = [a.x, a.y];
    const p3: [number, number] = [b.x, b.y];
    const p1: [number, number] = [
      p0[0] + (seg.tangentStart?.x ?? 0),
      p0[1] + (seg.tangentStart?.y ?? 0),
    ];
    const p2: [number, number] = [
      p3[0] + (seg.tangentEnd?.x ?? 0),
      p3[1] + (seg.tangentEnd?.y ?? 0),
    ];
    const lerp = (
      u: [number, number],
      v: [number, number],
    ): [number, number] => [
      u[0] + (v[0] - u[0]) * clampedT,
      u[1] + (v[1] - u[1]) * clampedT,
    ];
    const p01 = lerp(p0, p1);
    const p12 = lerp(p1, p2);
    const p23 = lerp(p2, p3);
    const p012 = lerp(p01, p12);
    const p123 = lerp(p12, p23);
    const mid = lerp(p012, p123);
    newVertex = { x: mid[0], y: mid[1] };
    firstHalf = {
      start: seg.start,
      end: -1,
      tangentStart: { x: p01[0] - p0[0], y: p01[1] - p0[1] },
      tangentEnd: { x: p012[0] - mid[0], y: p012[1] - mid[1] },
    };
    secondHalf = {
      start: -1,
      end: seg.end,
      tangentStart: { x: p123[0] - mid[0], y: p123[1] - mid[1] },
      tangentEnd: { x: p23[0] - p3[0], y: p23[1] - p3[1] },
    };
  }

  const newVertexIndex = vertices.length;
  vertices.push(newVertex);
  firstHalf.end = newVertexIndex;
  secondHalf.start = newVertexIndex;

  // Replace the original segment with the first half, append the second half.
  segments[segmentIndex] = firstHalf;
  const secondIndex = segments.length;
  segments.push(secondHalf);

  // Keep region loops consistent: insert the new segment index right after the
  // original wherever it appears.
  if (network.regions) {
    for (const region of network.regions) {
      const loops = region.loops as number[][];
      for (let li = 0; li < loops.length; li++) {
        const loop = loops[li];
        const out: number[] = [];
        for (const s of loop) {
          out.push(s);
          if (s === segmentIndex) {
            out.push(secondIndex);
          }
        }
        loops[li] = out;
      }
    }
  }

  return newVertexIndex;
}

/**
 * Removes a vertex and re-indexes the network. Segments touching the vertex are
 * dropped. When the vertex had exactly two segments (degree 2) the two edges are
 * healed into a single straight segment connecting the neighbours (Figma-style
 * "delete and heal"). Region loops referencing removed segments are dropped.
 */
export function deleteVertex(
  network: VectorNetworkData,
  vertexIndex: number,
): VectorNetworkData {
  const { vertices, segments } = network;
  if (vertexIndex < 0 || vertexIndex >= vertices.length) {
    return network;
  }

  // Collect incident segments.
  const incident: number[] = [];
  segments.forEach((s, i) => {
    if (s.start === vertexIndex || s.end === vertexIndex) {
      incident.push(i);
    }
  });

  const healed: VectorSegmentLike[] = [];
  if (incident.length === 2) {
    const [iA, iB] = incident;
    const segA = segments[iA];
    const segB = segments[iB];
    const otherA = segA.start === vertexIndex ? segA.end : segA.start;
    const otherB = segB.start === vertexIndex ? segB.end : segB.start;
    if (otherA !== otherB && otherA !== vertexIndex && otherB !== vertexIndex) {
      healed.push({ start: otherA, end: otherB });
    }
  }

  const removedSegments = new Set(incident);
  const keptSegments: VectorSegmentLike[] = [];
  segments.forEach((s, i) => {
    if (!removedSegments.has(i)) {
      keptSegments.push(s);
    }
  });
  keptSegments.push(...healed);

  // Re-index vertices (drop the removed one).
  const remap = new Map<number, number>();
  const newVertices: VectorVertexLike[] = [];
  vertices.forEach((v, i) => {
    if (i === vertexIndex) {
      return;
    }
    remap.set(i, newVertices.length);
    newVertices.push(v);
  });

  const newSegments: VectorSegmentLike[] = [];
  for (const s of keptSegments) {
    const start = remap.get(s.start);
    const end = remap.get(s.end);
    if (start === undefined || end === undefined || start === end) {
      continue;
    }
    newSegments.push({ ...s, start, end });
  }

  // Drop regions that referenced removed segments; rebuilding faces is left to
  // the caller (e.g. via region detection).
  const result: VectorNetworkData = {
    vertices: newVertices,
    segments: newSegments,
  };
  return result;
}
