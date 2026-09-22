import { path2Absolute } from '@antv/util';
import { mat3, vec2 } from 'gl-matrix';
import { CubicBezierCurve } from './curve/cubic-bezier-curve';
import type {
  VectorSegmentLike,
  VectorVertexLike,
} from './vector-network-stroke';
import { expandBoundsWithVectorSegments } from './vector-network-stroke';
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
              // Only drop the now-orphaned vertex if it is the last one in the
              // array; otherwise popping would shift indices referenced by
              // other segments. Leaving an unreferenced vertex is harmless.
              if (currentIndex === vertices.length - 1) {
                vertices.pop();
              }
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

/** Parametric point on a vector-network segment in local coordinates. */
export function getVectorSegmentPointAt(
  vertices: VectorVertexLike[],
  seg: VectorSegmentLike,
  t: number,
): [number, number] | null {
  const a = vertices[seg.start];
  const b = vertices[seg.end];
  if (!a || !b) {
    return null;
  }

  if (isStraightSegment(seg)) {
    return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
  }

  const p0 = vec2.fromValues(a.x, a.y);
  const p3 = vec2.fromValues(b.x, b.y);
  const p1 = vec2.create();
  const p2 = vec2.create();
  vec2.add(p1, p0, vec2.fromValues(seg.tangentStart?.x ?? 0, seg.tangentStart?.y ?? 0));
  vec2.add(p2, p3, vec2.fromValues(seg.tangentEnd?.x ?? 0, seg.tangentEnd?.y ?? 0));
  const point = new CubicBezierCurve(
    vec2.clone(p0),
    vec2.clone(p1),
    vec2.clone(p2),
    vec2.clone(p3),
  ).getPoint(t);
  return [point[0], point[1]];
}

/**
 * Splits the segment at index `segmentIndex` at parameter `t` (0..1), inserting
 * a new vertex. Loops in `regions` referencing the segment are rewritten so the
 * inserted segment index follows the original in topological order.
 * Returns the index of the newly inserted vertex.
 *
 * For straight segments the split is a simple midpoint; for cubic segments the
 * tangents are reassigned so the visual curve is preserved (de Casteljau).
 *
 * `t` is clamped to the open interval (0, 1) (via EPS) so the split never lands
 * exactly on an endpoint, which would create a zero-length segment.
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

function cloneSegments(segments: VectorSegmentLike[]): VectorSegmentLike[] {
  return segments.map((s) => ({
    ...s,
    tangentStart: s.tangentStart ? { ...s.tangentStart } : undefined,
    tangentEnd: s.tangentEnd ? { ...s.tangentEnd } : undefined,
  }));
}

/**
 * Walk from `fromVertex` away from `avoidVertex` until `targetVertex` is reached.
 * Returns the last segment on that path (the closing edge of a simple loop cut).
 */
function findLoopClosingSegmentIndex(
  segments: VectorSegmentLike[],
  avoidVertex: number,
  fromVertex: number,
  targetVertex: number,
): number | null {
  let current = fromVertex;
  let prev = avoidVertex;
  while (current !== targetVertex) {
    const neighbors: { segIdx: number; vtx: number }[] = [];
    segments.forEach((s, i) => {
      if (s.start === current) {
        neighbors.push({ segIdx: i, vtx: s.end });
      } else if (s.end === current) {
        neighbors.push({ segIdx: i, vtx: s.start });
      }
    });
    const next = neighbors.filter((n) => n.vtx !== prev);
    if (next.length !== 1) {
      return null;
    }
    const { segIdx, vtx } = next[0];
    if (vtx === targetVertex) {
      return segIdx;
    }
    prev = current;
    current = vtx;
  }
  return null;
}

function replaceVertexOnSegment(
  seg: VectorSegmentLike,
  oldIndex: number,
  newIndex: number,
) {
  if (seg.start === oldIndex) {
    seg.start = newIndex;
  } else if (seg.end === oldIndex) {
    seg.end = newIndex;
  }
}

/**
 * Split the vector network at a vertex.
 * - On a closed loop (degree 2): keep both incident edges on the cut vertex,
 *   duplicate a loop endpoint on the closing edge so the path opens as
 *   … A — V — B — … — A′ (e.g. triangle cut at 1 → 0-1, 1-2, 2-3 with 3 ≡ 0).
 * - On an open path: duplicate the cut vertex and reassign all but one incident
 *   segment to the copy so the chains can be pulled apart by dragging.
 */
export function breakVertex(
  network: VectorNetworkData,
  vertexIndex: number,
): VectorNetworkData | null {
  const { vertices, segments } = network;
  if (vertexIndex < 0 || vertexIndex >= vertices.length) {
    return null;
  }

  const incident: number[] = [];
  segments.forEach((s, i) => {
    if (s.start === vertexIndex || s.end === vertexIndex) {
      incident.push(i);
    }
  });

  if (incident.length < 2) {
    return null;
  }

  if (incident.length === 2) {
    const segA = segments[incident[0]];
    const segB = segments[incident[1]];
    const neighborA = segA.start === vertexIndex ? segA.end : segA.start;
    const neighborB = segB.start === vertexIndex ? segB.end : segB.start;

    const returnToBIdx = incident.find((i) => {
      const s = segments[i];
      return (
        (s.start === vertexIndex && s.end === neighborB) ||
        (s.end === vertexIndex && s.start === neighborB)
      );
    });

    const closingIndex = findLoopClosingSegmentIndex(
      segments,
      vertexIndex,
      neighborB,
      neighborA,
    );

    const newVertices = vertices.map((v) => ({ ...v }));
    const newSegments = cloneSegments(segments);

    const closingIsDirectNeighborLink =
      closingIndex !== null &&
      !incident.includes(closingIndex) &&
      (() => {
        const s = segments[closingIndex];
        return (
          (s.start === neighborA && s.end === neighborB) ||
          (s.start === neighborB && s.end === neighborA)
        );
      })();

    const useClosingWalk =
      closingIndex !== null &&
      !incident.includes(closingIndex) &&
      (!closingIsDirectNeighborLink || vertexIndex > neighborA);

    if (useClosingWalk) {
      const newVertexIndex = newVertices.length;
      newVertices.push({ ...vertices[neighborA] });
      replaceVertexOnSegment(
        newSegments[closingIndex],
        neighborA,
        newVertexIndex,
      );
      return { vertices: newVertices, segments: newSegments };
    }

    if (returnToBIdx !== undefined) {
      const newVertexIndex = newVertices.length;
      newVertices.push({ ...vertices[vertexIndex] });
      replaceVertexOnSegment(
        newSegments[returnToBIdx],
        vertexIndex,
        newVertexIndex,
      );
      return { vertices: newVertices, segments: newSegments };
    }

    return null;
  }

  const newVertexIndex = vertices.length;
  const newVertices = vertices.map((v) => ({ ...v }));
  newVertices.push({ ...vertices[vertexIndex] });

  const newSegments = cloneSegments(segments);

  for (let i = 1; i < incident.length; i++) {
    replaceVertexOnSegment(newSegments[incident[i]], vertexIndex, newVertexIndex);
  }

  return {
    vertices: newVertices,
    segments: newSegments,
  };
}

function segmentUndirectedKey(start: number, end: number): string {
  return start < end ? `${start}:${end}` : `${end}:${start}`;
}

/**
 * Merge `sourceVertexIndex` into `targetVertexIndex`. The source vertex is
 * removed; incident segments are rewired to the target. Zero-length and
 * duplicate (same vertex pair) segments are dropped; region loops are updated
 * when segments are removed.
 */
export function mergeVertices(
  network: VectorNetworkData,
  sourceVertexIndex: number,
  targetVertexIndex: number,
): VectorNetworkData | null {
  if (sourceVertexIndex === targetVertexIndex) {
    return null;
  }

  const { vertices, segments } = network;
  if (
    sourceVertexIndex < 0 ||
    sourceVertexIndex >= vertices.length ||
    targetVertexIndex < 0 ||
    targetVertexIndex >= vertices.length
  ) {
    return null;
  }

  const remapped = segments.map((s) => ({
    ...s,
    tangentStart: s.tangentStart ? { ...s.tangentStart } : undefined,
    tangentEnd: s.tangentEnd ? { ...s.tangentEnd } : undefined,
    start: s.start === sourceVertexIndex ? targetVertexIndex : s.start,
    end: s.end === sourceVertexIndex ? targetVertexIndex : s.end,
  }));

  const filteredSegments: VectorSegmentLike[] = [];
  const oldSegmentToNew = new Map<number, number>();
  const seen = new Set<string>();

  remapped.forEach((s, oldIndex) => {
    if (s.start === s.end) {
      return;
    }
    const key = segmentUndirectedKey(s.start, s.end);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    oldSegmentToNew.set(oldIndex, filteredSegments.length);
    filteredSegments.push(s);
  });

  const vertexRemap = new Map<number, number>();
  const newVertices: VectorVertexLike[] = [];
  vertices.forEach((v, i) => {
    if (i === sourceVertexIndex) {
      return;
    }
    vertexRemap.set(i, newVertices.length);
    newVertices.push({ ...v });
  });

  const newSegments: VectorSegmentLike[] = [];
  for (const s of filteredSegments) {
    const start = vertexRemap.get(s.start);
    const end = vertexRemap.get(s.end);
    if (start === undefined || end === undefined || start === end) {
      continue;
    }
    newSegments.push({ ...s, start, end });
  }

  const result: VectorNetworkData = {
    vertices: newVertices,
    segments: newSegments,
  };

  if (network.regions) {
    const regions = network.regions
      .map((region) => ({
        fillRule: region.fillRule,
        loops: (region.loops as number[][])
          .map((loop) => {
            const next: number[] = [];
            for (const oldSegIdx of loop) {
              const mapped = oldSegmentToNew.get(oldSegIdx);
              if (mapped !== undefined) {
                next.push(mapped);
              }
            }
            return next;
          })
          .filter((loop) => loop.length >= 3),
      }))
      .filter((region) => region.loops.length > 0);
    if (regions.length > 0) {
      result.regions = regions;
    }
  }

  return result;
}

function vectorNetworkGeometryBounds(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!vertices.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Math.min(...vertices.map(({ x }) => x));
  let maxX = Math.max(...vertices.map(({ x }) => x));
  let minY = Math.min(...vertices.map(({ y }) => y));
  let maxY = Math.max(...vertices.map(({ y }) => y));
  if (segments.length) {
    return expandBoundsWithVectorSegments(
      vertices,
      segments,
      minX,
      minY,
      maxX,
      maxY,
    );
  }
  return { minX, minY, maxX, maxY };
}

function transformVectorTangent(
  geomDelta: mat3,
  tangent?: { x: number; y: number },
): { x: number; y: number } | undefined {
  if (!tangent) {
    return undefined;
  }
  const out = vec2.transformMat3(vec2.create(), [tangent.x, tangent.y], geomDelta);
  if (Math.abs(out[0]) < EPS && Math.abs(out[1]) < EPS) {
    return undefined;
  }
  return { x: out[0], y: out[1] };
}

/**
 * Applies a local linear resize delta to vector-network geometry (vertices and
 * relative segment tangents), then re-normalizes so the bounds top-left is at
 * the local origin — matching {@link VectorNetwork} / deserialize conventions.
 */
export function transformVectorNetworkGeometry(
  network: VectorNetworkData,
  geomDelta: mat3,
): VectorNetworkData {
  const shiftedVertices = network.vertices.map((vertex) => {
    const out = vec2.transformMat3(
      vec2.create(),
      [vertex.x, vertex.y],
      geomDelta,
    );
    return { ...vertex, x: out[0], y: out[1] };
  });
  const shiftedSegments = network.segments.map((segment) => ({
    ...segment,
    tangentStart: transformVectorTangent(geomDelta, segment.tangentStart),
    tangentEnd: transformVectorTangent(geomDelta, segment.tangentEnd),
  }));

  const { minX, minY } = vectorNetworkGeometryBounds(
    shiftedVertices,
    shiftedSegments,
  );

  const result: VectorNetworkData = {
    vertices: shiftedVertices.map((vertex) => ({
      ...vertex,
      x: vertex.x - minX,
      y: vertex.y - minY,
    })),
    segments: shiftedSegments.map((segment) => ({ ...segment })),
  };
  if (network.regions) {
    result.regions = network.regions.map((region) => ({
      fillRule: region.fillRule,
      loops: (region.loops as number[][]).map((loop) => [...loop]),
    }));
  }
  return result;
}
