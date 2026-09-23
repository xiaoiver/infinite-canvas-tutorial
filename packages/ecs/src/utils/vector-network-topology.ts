import { path2Absolute } from '@antv/util';
import { mat3, vec2 } from 'gl-matrix';
import { CubicBezierCurve } from './curve/cubic-bezier-curve';
import type {
  VectorSegmentLike,
  VectorVertexLike,
} from './vector-network-stroke';
import { expandBoundsWithVectorSegments } from './vector-network-stroke';
import type { VectorRegionLike } from './vector-network-fill';
import { orientVectorLoop } from './vector-network-loop';
import { healVectorSegments } from './vector-network-heal';

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
          addSegment(
            currentIndex,
            idx,
            tangentsFromCubic(current, c1, c2, next),
          );
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
            ? [
                2 * current[0] - prevCubicControl[0],
                2 * current[1] - prevCubicControl[1],
              ]
            : [current[0], current[1]];
          const c2: [number, number] = [data[i], data[i + 1]];
          const next: [number, number] = [data[i + 2], data[i + 3]];
          const idx = pushVertex(next);
          addSegment(
            currentIndex,
            idx,
            tangentsFromCubic(current, c1, c2, next),
          );
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
          addSegment(
            currentIndex,
            idx,
            tangentsFromCubic(current, c1, c2, next),
          );
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
            ? [
                2 * current[0] - prevQuadControl[0],
                2 * current[1] - prevQuadControl[1],
              ]
            : [current[0], current[1]];
          const next: [number, number] = [data[i], data[i + 1]];
          const { c1, c2 } = quadraticToCubic(current, q, next);
          const idx = pushVertex(next);
          addSegment(
            currentIndex,
            idx,
            tangentsFromCubic(current, c1, c2, next),
          );
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
  vec2.add(
    p1,
    p0,
    vec2.fromValues(seg.tangentStart?.x ?? 0, seg.tangentStart?.y ?? 0),
  );
  vec2.add(
    p2,
    p3,
    vec2.fromValues(seg.tangentEnd?.x ?? 0, seg.tangentEnd?.y ?? 0),
  );
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
  if (
    !seg ||
    !vertices[seg.start] ||
    !vertices[seg.end] ||
    !Number.isFinite(t)
  ) {
    return -1;
  }
  const oldSegments = segments.slice();
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

  if (network.regions) {
    network.regions = rewriteRegions(
      network.regions,
      oldSegments,
      segments,
      (index) =>
        index === segmentIndex ? [segmentIndex, secondIndex] : [index],
    );
  }

  return newVertexIndex;
}

/**
 * Remap a boundary in its traversal direction, then validate closure. A region
 * is atomic: dropping just a broken hole would unexpectedly fill that hole.
 * Explicit [] is important: the API interprets undefined as "leave unchanged".
 */
function rewriteRegions(
  regions: VectorRegionLike[],
  before: VectorSegmentLike[],
  after: VectorSegmentLike[],
  replacement: (index: number) => number[] | null,
  simplify?: (loop: number[]) => number[],
): VectorRegionLike[] {
  return regions.flatMap((region) => {
    const loops: number[][] = [];
    for (const loop of region.loops) {
      const walk = orientVectorLoop(before, loop);
      if (!walk) {
        return [];
      }
      let mapped: number[] = [];
      for (const edge of walk) {
        const indices = replacement(edge.segmentIndex);
        if (!indices) {
          return [];
        }
        mapped.push(...(edge.reversed ? [...indices].reverse() : indices));
      }
      mapped = simplify ? simplify(mapped) : mapped;
      if (!orientVectorLoop(after, mapped)) {
        return [];
      }
      loops.push(mapped);
    }
    return loops.length ? [{ ...region, loops }] : [];
  });
}

function cloneSegments(segments: VectorSegmentLike[]): VectorSegmentLike[] {
  return segments.map((s) => ({
    ...s,
    tangentStart: s.tangentStart ? { ...s.tangentStart } : undefined,
    tangentEnd: s.tangentEnd ? { ...s.tangentEnd } : undefined,
  }));
}

export interface DeleteVectorVertexOptions {
  /** Set false to remove incident edges without joining their neighbours. */
  heal?: boolean;
  /** Maximum curve deviation in local units; default is 5% of the control hull. */
  maxError?: number;
}

/**
 * Delete and heal a degree-two vertex. Curves are fitted with a checked error
 * bound, and a split cubic can be recovered exactly. If the requested tolerance
 * cannot be met, return the original network; callers can offer plain deletion.
 */
export function deleteVertex(
  network: VectorNetworkData,
  vertexIndex: number,
  options: DeleteVectorVertexOptions = {},
): VectorNetworkData {
  const { vertices, segments } = network;
  if (!Number.isInteger(vertexIndex) || !vertices[vertexIndex]) {
    return network;
  }
  const incident = segments.flatMap((s, i) =>
    s.start === vertexIndex || s.end === vertexIndex ? [i] : [],
  );
  let healed: VectorSegmentLike | null = null;
  if (
    options.heal !== false &&
    incident.length === 2 &&
    incident.every((i) => segments[i].start !== segments[i].end)
  ) {
    healed = healVectorSegments(
      vertices,
      segments[incident[0]],
      segments[incident[1]],
      vertexIndex,
      options.maxError,
    );
    if (!healed) {
      return network;
    }
    if (healed.start === healed.end && isStraightSegment(healed)) {
      healed = null;
    }
  }

  const vertexRemap = (index: number) =>
    index > vertexIndex ? index - 1 : index;
  const segmentRemap = new Map<number, number>();
  const removed = new Set(incident);
  const nextSegments = cloneSegments(segments).filter((_, i) => {
    if (removed.has(i)) {
      return false;
    }
    segmentRemap.set(i, segmentRemap.size);
    return true;
  });
  const healedIndex = nextSegments.length;
  if (healed) {
    nextSegments.push(healed);
  }
  for (const s of nextSegments) {
    s.start = vertexRemap(s.start);
    s.end = vertexRemap(s.end);
  }
  const regions =
    network.regions &&
    rewriteRegions(
      network.regions,
      segments,
      nextSegments,
      (i) =>
        removed.has(i)
          ? healed
            ? [healedIndex]
            : null
          : [segmentRemap.get(i)!],
      (loop) => {
        const out = loop.filter(
          (index, i) =>
            index !== healedIndex || i === 0 || loop[i - 1] !== index,
        );
        if (
          out.length > 1 &&
          out[0] === healedIndex &&
          out[out.length - 1] === healedIndex
        )
          out.pop();
        return out;
      },
    );
  return {
    vertices: vertices
      .filter((_, i) => i !== vertexIndex)
      .map((v) => ({ ...v })),
    segments: nextSegments,
    ...(regions !== undefined ? { regions } : {}),
  };
}

/**
 * Cut at the selected vertex. Keep its first incident endpoint and move the
 * others to a duplicate at the SAME position. A self-loop has two endpoints
 * and can therefore be cut as well. Unaffected closed regions are retained.
 */
export function breakVertex(
  network: VectorNetworkData,
  vertexIndex: number,
): VectorNetworkData | null {
  const { vertices, segments } = network;
  if (!Number.isInteger(vertexIndex) || !vertices[vertexIndex]) {
    return null;
  }
  const endpoints: { index: number; end: 'start' | 'end' }[] = [];
  segments.forEach((s, index) => {
    if (s.start === vertexIndex) endpoints.push({ index, end: 'start' });
    if (s.end === vertexIndex) endpoints.push({ index, end: 'end' });
  });
  if (endpoints.length < 2) {
    return null;
  }
  const nextSegments = cloneSegments(segments);
  for (const endpoint of endpoints.slice(1)) {
    nextSegments[endpoint.index][endpoint.end] = vertices.length;
  }
  return {
    vertices: [
      ...vertices.map((v) => ({ ...v })),
      { ...vertices[vertexIndex] },
    ],
    segments: nextSegments,
    ...(network.regions
      ? {
          regions: rewriteRegions(
            network.regions,
            segments,
            nextSegments,
            (i) => [i],
          ),
        }
      : {}),
  };
}

/** Equal geometry, not just equal endpoint indices, determines duplicates. */
function segmentGeometryKey(s: VectorSegmentLike): string {
  const ts = s.tangentStart ?? { x: 0, y: 0 };
  const te = s.tangentEnd ?? { x: 0, y: 0 };
  const forward = [s.start, s.end, ts.x, ts.y, te.x, te.y].join(':');
  const reverse = [s.end, s.start, te.x, te.y, ts.x, ts.y].join(':');
  return forward < reverse ? forward : reverse;
}

/** Remove immediate out-and-back traversals after coincident edges coalesce. */
function cancelRetracedEdges(
  loop: number[],
  segments: VectorSegmentLike[],
): number[] {
  const out: number[] = [];
  for (const i of loop) {
    if (out[out.length - 1] === i && segments[i].start !== segments[i].end)
      out.pop();
    else out.push(i);
  }
  while (
    out.length > 1 &&
    out[0] === out[out.length - 1] &&
    segments[out[0]].start !== segments[out[0]].end
  ) {
    out.shift();
    out.pop();
  }
  return out;
}

/** Merge vertices, preserving curved self-loops and geometrically distinct edges. */
export function mergeVertices(
  network: VectorNetworkData,
  sourceVertexIndex: number,
  targetVertexIndex: number,
): VectorNetworkData | null {
  const { vertices, segments } = network;
  if (
    sourceVertexIndex === targetVertexIndex ||
    !Number.isInteger(sourceVertexIndex) ||
    !Number.isInteger(targetVertexIndex) ||
    !vertices[sourceVertexIndex] ||
    !vertices[targetVertexIndex]
  ) {
    return null;
  }
  const vertexRemap = (i: number) => {
    const merged = i === sourceVertexIndex ? targetVertexIndex : i;
    return merged > sourceVertexIndex ? merged - 1 : merged;
  };
  const nextSegments: VectorSegmentLike[] = [];
  const segmentRemap = new Map<number, number[]>();
  const seen = new Map<string, number>();
  cloneSegments(segments).forEach((s, i) => {
    s.start = vertexRemap(s.start);
    s.end = vertexRemap(s.end);
    if (s.start === s.end && isStraightSegment(s)) {
      segmentRemap.set(i, []);
      return;
    }
    const key = segmentGeometryKey(s);
    const duplicate = seen.get(key);
    if (duplicate !== undefined) {
      segmentRemap.set(i, [duplicate]);
      return;
    }
    segmentRemap.set(i, [nextSegments.length]);
    seen.set(key, nextSegments.length);
    nextSegments.push(s);
  });
  return {
    vertices: vertices
      .filter((_, i) => i !== sourceVertexIndex)
      .map((v) => ({ ...v })),
    segments: nextSegments,
    ...(network.regions
      ? {
          regions: rewriteRegions(
            network.regions,
            segments,
            nextSegments,
            (i) => segmentRemap.get(i)!,
            (loop) => cancelRetracedEdges(loop, nextSegments),
          ),
        }
      : {}),
  };
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
  const out = vec2.transformMat3(
    vec2.create(),
    [tangent.x, tangent.y],
    geomDelta,
  );
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
