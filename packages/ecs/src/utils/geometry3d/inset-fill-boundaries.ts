import Rbush from 'rbush';

type Point = [number, number];
type Edge = { a: Point; b: Point; tangent: Point; inward: Point };
type IndexedEdge = {
  edge: Edge;
  loop: number;
  index: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const cross = (a: Point, b: Point, c: Point): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function edgesOf(contour: readonly Point[]): Edge[] | undefined {
  const edges: Edge[] = [];
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(length > 0)) return;
    const tangent: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    edges.push({ a, b, tangent, inward: [-tangent[1], tangent[0]] });
  }
  return edges;
}

function offsetLoop(
  contour: readonly Point[],
  distance: number,
): Point[] | undefined {
  const edges = edgesOf(contour);
  if (!edges) return;
  const points: Point[] = [];
  for (let i = 0; i < contour.length; i++) {
    const previous = edges[(i + edges.length - 1) % edges.length];
    const next = edges[i];
    const turn =
      previous.tangent[0] * next.tangent[1] -
      previous.tangent[1] * next.tangent[0];
    const point = contour[i];
    let x: number;
    let y: number;
    if (Math.abs(turn) <= 1e-7) {
      if (
        previous.tangent[0] * next.tangent[0] +
          previous.tangent[1] * next.tangent[1] <
        0
      )
        return;
      x = point[0] + next.inward[0] * distance;
      y = point[1] + next.inward[1] * distance;
    } else {
      const dx = (next.inward[0] - previous.inward[0]) * distance;
      const dy = (next.inward[1] - previous.inward[1]) * distance;
      const along = (dx * next.tangent[1] - dy * next.tangent[0]) / turn;
      x =
        point[0] + previous.inward[0] * distance + previous.tangent[0] * along;
      y =
        point[1] + previous.inward[1] * distance + previous.tangent[1] * along;
    }
    if (!Number.isFinite(Math.fround(x)) || !Number.isFinite(Math.fround(y)))
      return;
    points.push([Math.fround(x), Math.fround(y)]);
  }
  return points;
}

function signedArea(contour: readonly Point[]): number {
  let twiceArea = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  return twiceArea / 2;
}

function indexEdge(edge: Edge, loop: number, index: number): IndexedEdge {
  return {
    edge,
    loop,
    index,
    minX: Math.min(edge.a[0], edge.b[0]),
    minY: Math.min(edge.a[1], edge.b[1]),
    maxX: Math.max(edge.a[0], edge.b[0]),
    maxY: Math.max(edge.a[1], edge.b[1]),
  };
}

/** Nonzero winding using only edges that can cross a ray to the right. */
function insideFill(point: Point, index: Rbush<IndexedEdge>): boolean {
  let winding = 0;
  for (const { edge } of index.search({
    minX: point[0],
    minY: point[1],
    maxX: Infinity,
    maxY: point[1],
  })) {
    const { a, b } = edge;
    if (a[1] <= point[1] && b[1] > point[1] && cross(a, b, point) > 0)
      winding++;
    else if (a[1] > point[1] && b[1] <= point[1] && cross(a, b, point) < 0)
      winding--;
  }
  return winding !== 0;
}

function distanceToEdge(point: Point, edge: Edge): number {
  const dx = edge.b[0] - edge.a[0];
  const dy = edge.b[1] - edge.a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - edge.a[0]) * dx + (point[1] - edge.a[1]) * dy) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point[0] - edge.a[0] - t * dx,
    point[1] - edge.a[1] - t * dy,
  );
}

function touchesSegment(point: Point, edge: Edge, epsilon: number): boolean {
  return distanceToEdge(point, edge) <= epsilon;
}

function distanceBetweenEdges(a: Edge, b: Edge): number {
  return Math.min(
    distanceToEdge(a.a, b),
    distanceToEdge(a.b, b),
    distanceToEdge(b.a, a),
    distanceToEdge(b.b, a),
  );
}

function intersects(a: Edge, b: Edge, epsilon: number): boolean {
  const aa = cross(a.a, a.b, b.a);
  const ab = cross(a.a, a.b, b.b);
  const ba = cross(b.a, b.b, a.a);
  const bb = cross(b.a, b.b, a.b);
  const scale = Math.max(
    Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]),
    Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]),
  );
  const threshold = epsilon * scale;
  if (
    ((aa > threshold && ab < -threshold) ||
      (aa < -threshold && ab > threshold)) &&
    ((ba > threshold && bb < -threshold) || (ba < -threshold && bb > threshold))
  )
    return true;
  return (
    (Math.abs(aa) <= threshold && touchesSegment(b.a, a, epsilon)) ||
    (Math.abs(ab) <= threshold && touchesSegment(b.b, a, epsilon)) ||
    (Math.abs(ba) <= threshold && touchesSegment(a.a, b, epsilon)) ||
    (Math.abs(bb) <= threshold && touchesSegment(a.b, b, epsilon))
  );
}

/**
 * Offset resolved outer and hole loops into the filled region while preserving
 * their vertex correspondence. Reject offsets that would change topology; the
 * caller can keep the original sharp extrusion in that case.
 */
export function insetFillBoundaries(
  boundaries: readonly Point[][],
  distance: number,
): Point[][] | undefined {
  const count = boundaries.reduce((sum, contour) => sum + contour.length, 0);
  // Keep mesh generation bounded even when an imported SVG is very detailed.
  if (!(distance > 0) || count < 3 || count > 4096) return;
  const tolerance = Math.max(1e-5, distance * 1e-4);
  const originalEdges = boundaries.map(edgesOf);
  if (originalEdges.some((edges) => !edges)) return;
  const originalIndex = new Rbush<IndexedEdge>().load(
    (originalEdges as Edge[][]).flatMap((edges, loop) =>
      edges.map((edge, index) => indexEdge(edge, loop, index)),
    ),
  );
  const insets: Point[][] = [];
  const insetEdges: Edge[][] = [];

  for (const contour of boundaries) {
    const inset = offsetLoop(contour, distance);
    if (!inset) return;
    const edges = edgesOf(inset);
    if (
      !edges ||
      edges.some(
        (edge) =>
          Math.hypot(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]) <= tolerance,
      )
    )
      return;
    if (signedArea(contour) * signedArea(inset) <= 0) return;
    insets.push(inset);
    insetEdges.push(edges);
  }

  const indexedInsetsByLoop = insetEdges.map((edges, loop) =>
    edges.map((edge, index) => indexEdge(edge, loop, index)),
  );
  const indexedInsets = indexedInsetsByLoop.flat();
  const insetIndex = new Rbush<IndexedEdge>().load(indexedInsets);
  for (const [loop, inset] of insets.entries()) {
    // With no crossings, one vertex fixes the entire loop's fill membership.
    if (!insideFill(inset[0], originalIndex)) return;
    const edges = insetEdges[loop];
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const bounds = indexedInsetsByLoop[loop][i];
      const near = originalIndex.search({
        minX: bounds.minX - distance - tolerance,
        minY: bounds.minY - distance - tolerance,
        maxX: bounds.maxX + distance + tolerance,
        maxY: bounds.maxY + distance + tolerance,
      });
      for (const original of near) {
        if (intersects(edge, original.edge, tolerance)) return;
        if (distanceBetweenEdges(edge, original.edge) < distance - tolerance)
          return;
      }
      for (const other of insetIndex.search({
        minX: bounds.minX - tolerance,
        minY: bounds.minY - tolerance,
        maxX: bounds.maxX + tolerance,
        maxY: bounds.maxY + tolerance,
      })) {
        if (
          other.loop < loop ||
          (other.loop === loop && other.index <= i) ||
          (other.loop === loop &&
            (other.index === i + 1 ||
              (i === 0 && other.index === edges.length - 1)))
        )
          continue;
        if (intersects(edge, other.edge, tolerance)) return;
      }
    }
  }
  return insets;
}
