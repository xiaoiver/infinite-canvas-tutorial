import type {
  VectorSegmentLike,
  VectorVertexLike,
} from './vector-network-stroke';
import { contourFromSegmentLoop } from './vector-network-fill';

const EPS = 1e-9;

interface HalfEdge {
  /** Segment index this half-edge belongs to. */
  seg: number;
  from: number;
  to: number;
  /** Outgoing direction angle at `from`. */
  angle: number;
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
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + EPS) + xi;
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

/**
 * Detects the minimal closed face (cycle) of the vector network that encloses
 * `point`, returning the ordered segment indices that form the loop, or `null`
 * when the point is not inside any face.
 *
 * The network is treated as a planar graph: each segment yields two directed
 * half-edges. Traversing the "next" half-edge (the most clockwise turn at each
 * vertex relative to the reverse edge) enumerates the minimal faces. The
 * smallest-area face containing the point wins, which matches Figma's
 * click-to-fill behaviour.
 */
export function findRegionLoopAtPoint(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  point: [number, number],
): number[] | null {
  if (!vertices.length || !segments.length) {
    return null;
  }

  // Build directed half-edges and per-vertex adjacency (sorted CCW by angle).
  const halfEdges: HalfEdge[] = [];
  const outgoing: number[][] = Array.from({ length: vertices.length }, () => []);

  const addHalfEdge = (seg: number, from: number, to: number) => {
    const a = vertices[from];
    const b = vertices[to];
    if (!a || !b) {
      return;
    }
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const id = halfEdges.length;
    halfEdges.push({ seg, from, to, angle });
    outgoing[from].push(id);
  };

  segments.forEach((s, i) => {
    if (s.start === s.end) {
      return;
    }
    addHalfEdge(i, s.start, s.end);
    addHalfEdge(i, s.end, s.start);
  });

  for (const list of outgoing) {
    list.sort((a, b) => halfEdges[a].angle - halfEdges[b].angle);
  }

  // Map from (from,to) to half-edge id for reverse lookup.
  const edgeKey = (from: number, to: number) => from * vertices.length + to;
  const edgeMap = new Map<number, number>();
  halfEdges.forEach((he, id) => {
    edgeMap.set(edgeKey(he.from, he.to), id);
  });

  const nextHalfEdge = (id: number): number => {
    const he = halfEdges[id];
    // The reverse edge arrives at `he.to`; the next face edge is the one
    // immediately clockwise from it among `he.to`'s outgoing edges.
    const reverseId = edgeMap.get(edgeKey(he.to, he.from));
    const list = outgoing[he.to];
    if (reverseId === undefined || list.length === 0) {
      return -1;
    }
    const pos = list.indexOf(reverseId);
    const prev = (pos - 1 + list.length) % list.length;
    return list[prev];
  };

  const visited = new Array(halfEdges.length).fill(false);
  let best: { loop: number[]; area: number } | null = null;

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

    if (!ok || faceHalfEdges.length < 2) {
      continue;
    }

    const segLoop = faceHalfEdges.map((heId) => halfEdges[heId].seg);
    const polygon = contourFromSegmentLoop(vertices, segments, segLoop);
    if (polygon.length < 3) {
      continue;
    }
    const area = polygonArea(polygon);
    // The outer (unbounded) face has positive signed area under this CCW
    // traversal; skip it so only interior faces are considered.
    if (area >= -EPS) {
      continue;
    }
    if (!pointInPolygon(point, polygon)) {
      continue;
    }
    const absArea = Math.abs(area);
    if (!best || absArea < best.area) {
      best = { loop: segLoop, area: absArea };
    }
  }

  return best ? best.loop : null;
}
