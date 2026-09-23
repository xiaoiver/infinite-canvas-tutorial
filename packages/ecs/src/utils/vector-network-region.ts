import type {
  VectorSegmentLike,
  VectorVertexLike,
} from './vector-network-stroke';
import {
  contourFromOrientedSegments,
  contourFromSegmentLoop,
  type VectorRegionLike,
} from './vector-network-fill';
import { triangulate } from './tessy';
import type { OrientedVectorSegment } from './vector-network-loop';

const EPS = 1e-9;

interface HalfEdge extends OrientedVectorSegment {
  twin: number;
  /** Outgoing tangent, then curvature, determine the rotation at a vertex. */
  angle: number;
  bend: number;
}

function departure(
  vertices: VectorVertexLike[],
  segment: VectorSegmentLike,
  reversed: boolean,
): { angle: number; bend: number } {
  const a = vertices[reversed ? segment.end : segment.start];
  const b = vertices[reversed ? segment.start : segment.end];
  const first = reversed ? segment.tangentEnd : segment.tangentStart;
  const last = reversed ? segment.tangentStart : segment.tangentEnd;
  const controls = [
    [first?.x ?? 0, first?.y ?? 0],
    [b.x + (last?.x ?? 0) - a.x, b.y + (last?.y ?? 0) - a.y],
    [b.x - a.x, b.y - a.y],
  ];
  const direction = controls.find(([x, y]) => Math.hypot(x, y) > EPS) ?? [0, 0];
  const angle = Math.atan2(direction[1], direction[0]);
  const t = 1e-4;
  const weights = [3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3];
  const dx = controls.reduce((sum, p, i) => sum + p[0] * weights[i], 0);
  const dy = controls.reduce((sum, p, i) => sum + p[1] * weights[i], 0);
  const bend = Math.atan2(
    direction[0] * dy - direction[1] * dx,
    direction[0] * dx + direction[1] * dy,
  );
  return { angle, bend };
}

function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    // The straddle test above guarantees yj !== yi, so the division is safe.
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonArea(polygon: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
  }
  return area / 2;
}

interface BoundaryCycle {
  loop: number[];
  polygon: [number, number][];
  area: number;
  component: number;
}

/** Each directed boundary is visited exactly once. Crossings must be vertices. */
function collectBoundaryCycles(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
): BoundaryCycle[] {
  // Build directed half-edges and per-vertex adjacency (sorted CCW by angle).
  const halfEdges: HalfEdge[] = [];
  const outgoing: number[][] = Array.from(
    { length: vertices.length },
    () => [],
  );

  segments.forEach((s, segmentIndex) => {
    if (!vertices[s.start] || !vertices[s.end]) {
      return;
    }
    const id = halfEdges.length;
    halfEdges.push(
      {
        segmentIndex,
        from: s.start,
        to: s.end,
        reversed: false,
        twin: id + 1,
        ...departure(vertices, s, false),
      },
      {
        segmentIndex,
        from: s.end,
        to: s.start,
        reversed: true,
        twin: id,
        ...departure(vertices, s, true),
      },
    );
    outgoing[s.start].push(id);
    outgoing[s.end].push(id + 1);
  });

  for (const list of outgoing) {
    list.sort((a, b) => {
      const difference = halfEdges[a].angle - halfEdges[b].angle;
      return Math.abs(difference) > EPS
        ? difference
        : halfEdges[a].bend - halfEdges[b].bend || a - b;
    });
  }

  const positions = new Array<number>(halfEdges.length);
  for (const list of outgoing) {
    list.forEach((id, position) => {
      positions[id] = position;
    });
  }
  const nextHalfEdge = (id: number): number => {
    const he = halfEdges[id];
    const list = outgoing[he.to];
    const position = positions[he.twin];
    return list[(position - 1 + list.length) % list.length];
  };

  const component = new Array<number>(vertices.length).fill(-1);
  for (let v = 0; v < vertices.length; v++) {
    if (component[v] !== -1) continue;
    component[v] = v;
    const stack = [v];
    while (stack.length) {
      const current = stack.pop()!;
      for (const id of outgoing[current]) {
        const to = halfEdges[id].to;
        if (component[to] === -1) {
          component[to] = v;
          stack.push(to);
        }
      }
    }
  }
  const visited = new Array(halfEdges.length).fill(false);
  const cycles: BoundaryCycle[] = [];

  for (let startId = 0; startId < halfEdges.length; startId++) {
    if (visited[startId]) {
      continue;
    }
    const faceHalfEdges: number[] = [];
    let id = startId;
    let guard = 0;
    let ok = true;
    do {
      if (id < 0 || visited[id]) {
        ok = false;
        break;
      }
      visited[id] = true;
      faceHalfEdges.push(id);
      id = nextHalfEdge(id);
      if (++guard > halfEdges.length + 1) {
        ok = false;
        break;
      }
    } while (id !== startId);

    if (!ok || faceHalfEdges.length === 0) {
      continue;
    }

    const segLoop = faceHalfEdges.map((heId) => halfEdges[heId].segmentIndex);
    const polygon = contourFromOrientedSegments(
      vertices,
      segments,
      faceHalfEdges.map((heId) => halfEdges[heId]),
    );
    if (polygon.length < 3) {
      continue;
    }
    const area = polygonArea(polygon);
    if (Math.abs(area) > EPS) {
      cycles.push({
        loop: segLoop,
        polygon,
        area,
        component: component[halfEdges[startId].from],
      });
    }
  }
  return cycles;
}

export interface VectorNetworkFace {
  /** New faces use evenodd so hole orientation is independent of edge storage. */
  region: { fillRule: 'evenodd'; loops: number[][] };
  contours: [number, number][][];
  area: number;
}

/**
 * Enumerate bounded faces of an embedded planar network. A disconnected
 * component's exterior boundary becomes a hole in the smallest enclosing face.
 * The topology is read-only: intersections without junction vertices are not
 * welded by entering Fill mode.
 */
export function findVectorNetworkFaces(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
): VectorNetworkFace[] {
  const cycles = collectBoundaryCycles(vertices, segments);
  const bounded = cycles.filter((cycle) => cycle.area < 0);
  const faces: VectorNetworkFace[] = bounded.map((cycle) => ({
    region: { fillRule: 'evenodd', loops: [cycle.loop] },
    contours: [cycle.polygon],
    area: -cycle.area,
  }));
  for (const exterior of cycles.filter((cycle) => cycle.area > 0)) {
    let parent = -1;
    let parentArea = Infinity;
    bounded.forEach((candidate, i) => {
      if (
        candidate.component !== exterior.component &&
        -candidate.area < parentArea &&
        pointInPolygon(exterior.polygon[0], candidate.polygon)
      ) {
        parent = i;
        parentArea = -candidate.area;
      }
    });
    if (parent !== -1) {
      faces[parent].region.loops.push(exterior.loop);
      faces[parent].contours.push(exterior.polygon);
      faces[parent].area -= exterior.area;
    }
  }
  return faces;
}

function onBoundary(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  const [x, y] = point;
  return polygon.some((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    return (
      Math.abs(dx * (y - a[1]) - dy * (x - a[0])) <=
        EPS * Math.max(length, 1) &&
      x >= Math.min(a[0], b[0]) - EPS &&
      x <= Math.max(a[0], b[0]) + EPS &&
      y >= Math.min(a[1], b[1]) - EPS &&
      y <= Math.max(a[1], b[1]) + EPS
    );
  });
}

export function vectorNetworkFaceAtPoint(
  faces: VectorNetworkFace[],
  point: [number, number],
): VectorNetworkFace | null {
  let best: VectorNetworkFace | null = null;
  for (const face of faces) {
    if (face.contours.some((contour) => onBoundary(point, contour))) continue;
    if (
      face.contours.reduce(
        (inside, contour) => inside !== pointInPolygon(point, contour),
        false,
      ) &&
      (!best || face.area < best.area)
    ) {
      best = face;
    }
  }
  return best;
}

/** Legacy outer-boundary accessor; use findVectorNetworkFaces for holes. */
export function findRegionLoopAtPoint(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  point: [number, number],
): number[] | null {
  return (
    vectorNetworkFaceAtPoint(findVectorNetworkFaces(vertices, segments), point)
      ?.region.loops[0] ?? null
  );
}

function windingNumber(
  point: [number, number],
  polygon: [number, number][],
): number {
  let winding = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross =
      (b[0] - a[0]) * (point[1] - a[1]) - (point[0] - a[0]) * (b[1] - a[1]);
    if (a[1] <= point[1] && b[1] > point[1] && cross > 0) winding++;
    if (a[1] > point[1] && b[1] <= point[1] && cross < 0) winding--;
  }
  return winding;
}

/**
 * Resolve existing (possibly multi-face) fills to minimal faces before toggling
 * one. This preserves neighbouring fills when removing a face from an imported
 * broad region. No geometry is mutated, and an empty result explicitly clears.
 */
export function toggleVectorNetworkFace(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  regions: ReadonlyArray<VectorRegionLike> | undefined,
  faces: VectorNetworkFace[],
  target: VectorNetworkFace,
): VectorNetworkFace['region'][] {
  const existing = (regions ?? []).flatMap((region) => {
    const contours = region.loops.map((loop) =>
      contourFromSegmentLoop(vertices, segments, loop),
    );
    if (!contours.length || contours.some((c) => c.length < 3)) return [];
    return [
      {
        contours,
        evenodd: region.fillRule
          ? region.fillRule === 'evenodd'
          : region.windingRule?.toLowerCase() === 'evenodd',
      },
    ];
  });
  return faces.flatMap((face) => {
    // A triangle centroid is inside the face even for concave outlines or holes.
    const triangles = triangulate(face.contours, 'evenodd');
    if (triangles.length < 6) return [];
    const sample: [number, number] = [
      (triangles[0] + triangles[2] + triangles[4]) / 3,
      (triangles[1] + triangles[3] + triangles[5]) / 3,
    ];
    const filled = existing.some(({ contours, evenodd }) => {
      const winding = contours.reduce(
        (sum, contour) => sum + windingNumber(sample, contour),
        0,
      );
      return evenodd ? Math.abs(winding) % 2 === 1 : winding !== 0;
    });
    return filled !== (face === target)
      ? [
          {
            fillRule: 'evenodd' as const,
            loops: face.region.loops.map((loop) => [...loop]),
          },
        ]
      : [];
  });
}
