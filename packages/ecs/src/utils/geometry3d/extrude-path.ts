import libtess from 'libtess';
import { triangulate } from '../tessy';
import type { Mesh3DGeometryData } from './types';

type Point = [number, number];

export type PathExtrusionResult =
  | { ok: true; geometry: Mesh3DGeometryData }
  | {
      ok: false;
      reason:
        | 'invalid-depth'
        | 'invalid-contour'
        | 'empty-fill'
        | 'tessellation-failed'
        | 'non-manifold';
    };

function samePoint(a: Point, b: Point): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function normalizeContour(raw: Point[]): Point[] | null {
  const points: Point[] = [];
  for (const [x, y] of raw) {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(Math.fround(x)) ||
      !Number.isFinite(Math.fround(y))
    ) {
      return null;
    }
    const point: Point = [x, y];
    if (!points.length || !samePoint(points[points.length - 1], point)) {
      points.push(point);
    }
  }
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) {
    points.pop();
  }
  if (new Set(points.map(([x, y]) => `${x},${y}`)).size < 3) {
    return null;
  }
  return points;
}

/** Resolve the filled region itself, not the original subpath edges. */
function filledBoundaries(
  contours: Point[][],
  fillRule: CanvasFillRule,
): Point[][] | null {
  const tess = new libtess.GluTesselator();
  const loops: Point[][] = [];
  let loop: Point[] = [];
  let failed = false;
  tess.gluTessProperty(libtess.gluEnum.GLU_TESS_BOUNDARY_ONLY, true);
  tess.gluTessProperty(
    libtess.gluEnum.GLU_TESS_WINDING_RULE,
    fillRule === 'evenodd'
      ? libtess.windingRule.GLU_TESS_WINDING_ODD
      : libtess.windingRule.GLU_TESS_WINDING_NONZERO,
  );
  tess.gluTessNormal(0, 0, 1);
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, (type: number) => {
    if (type !== libtess.primitiveType.GL_LINE_LOOP) failed = true;
    loop = [];
  });
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX, (vertex: number[]) => {
    loop.push([vertex[0], vertex[1]]);
  });
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_END, () => {
    const cleaned = normalizeContour(loop);
    if (cleaned) loops.push(cleaned);
    else failed = true;
  });
  tess.gluTessCallback(
    libtess.gluEnum.GLU_TESS_COMBINE,
    (coords: number[]) => coords,
  );
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, () => {
    failed = true;
  });
  tess.gluTessBeginPolygon(null);
  for (const contour of contours) {
    tess.gluTessBeginContour();
    for (const [x, y] of contour) {
      const vertex = [x, y, 0];
      tess.gluTessVertex(vertex, vertex);
    }
    tess.gluTessEndContour();
  }
  tess.gluTessEndPolygon();
  return failed ? null : loops;
}

/**
 * Build a closed, sharp-edged mesh centered on z=0 from already flattened,
 * closed Path contours in local coordinates. Curves must be sampled upstream.
 * The source arrays are never mutated. Failure is explicit so callers can keep
 * showing the original 2D shape instead of substituting its bounds.
 */
export function extrudePathContours(
  rawContours: Point[][],
  depth: number,
  fillRule: CanvasFillRule = 'nonzero',
): PathExtrusionResult {
  if (
    !Number.isFinite(depth) ||
    depth <= 0 ||
    !Number.isFinite(Math.fround(depth))
  ) {
    return { ok: false, reason: 'invalid-depth' };
  }
  if (!rawContours.length) return { ok: false, reason: 'empty-fill' };
  const contours: Point[][] = [];
  for (const raw of rawContours) {
    const contour = normalizeContour(raw);
    if (!contour) return { ok: false, reason: 'invalid-contour' };
    contours.push(contour);
  }

  let boundaries: Point[][] | null;
  try {
    boundaries = filledBoundaries(contours, fillRule);
  } catch {
    return { ok: false, reason: 'tessellation-failed' };
  }
  if (!boundaries) return { ok: false, reason: 'tessellation-failed' };
  if (!boundaries.length) return { ok: false, reason: 'empty-fill' };

  // Triangulating the resolved boundaries ensures that caps and walls describe
  // the same region even when source contours overlap or self-intersect.
  let triangles: number[];
  try {
    triangles = triangulate(boundaries, 'nonzero');
  } catch {
    return { ok: false, reason: 'tessellation-failed' };
  }
  if (!triangles.length) return { ok: false, reason: 'empty-fill' };
  if (
    triangles.length % 6 !== 0 ||
    triangles.some((n) => !Number.isFinite(n))
  ) {
    return { ok: false, reason: 'tessellation-failed' };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const boundary of boundaries) {
    for (const [x, y] of boundary) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX === maxX || minY === maxY) {
    return { ok: false, reason: 'empty-fill' };
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfDepth = depth / 2;
  const addVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ): number => {
    const index = positions.length / 3;
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
    return index;
  };
  const capUv = ([x, y]: Point): Point => [
    (x - minX) / (maxX - minX),
    (y - minY) / (maxY - minY),
  ];

  for (let i = 0; i < triangles.length; i += 6) {
    const a: Point = [triangles[i], triangles[i + 1]];
    const b: Point = [triangles[i + 2], triangles[i + 3]];
    const c: Point = [triangles[i + 4], triangles[i + 5]];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (!Number.isFinite(cross) || cross === 0) {
      return { ok: false, reason: 'tessellation-failed' };
    }
    const [first, second, third] = cross > 0 ? [a, b, c] : [a, c, b];
    for (const z of [halfDepth, -halfDepth]) {
      const face = z > 0 ? [first, second, third] : [third, second, first];
      const base = positions.length / 3;
      for (const point of face) {
        const [u, v] = capUv(point);
        addVertex(point[0], point[1], z, 0, 0, z > 0 ? 1 : -1, u, v);
      }
      indices.push(base, base + 1, base + 2);
    }
  }

  for (const boundary of boundaries) {
    let distance = 0;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length === 0) {
        return { ok: false, reason: 'tessellation-failed' };
      }
      // libtess emits exterior loops counter-clockwise and holes clockwise.
      const nx = dy / length;
      const ny = -dx / length;
      const base = positions.length / 3;
      addVertex(a[0], a[1], -halfDepth, nx, ny, 0, distance, 0);
      addVertex(b[0], b[1], -halfDepth, nx, ny, 0, distance + length, 0);
      addVertex(b[0], b[1], halfDepth, nx, ny, 0, distance + length, depth);
      addVertex(a[0], a[1], halfDepth, nx, ny, 0, distance, depth);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      distance += length;
    }
  }

  if (
    positions.some((n) => !Number.isFinite(Math.fround(n))) ||
    normals.some((n) => !Number.isFinite(Math.fround(n))) ||
    uvs.some((n) => !Number.isFinite(Math.fround(n)))
  ) {
    return { ok: false, reason: 'tessellation-failed' };
  }

  // A self crossing can create two solid lobes sharing a vertical edge. The
  // resulting mesh is pinched, so reject it rather than return invalid volume.
  // This also catches cracks between the independently tessellated caps/walls.
  const edges = new Map<string, { count: number; balance: number }>();
  const pointKey = (index: number): string =>
    positions
      .slice(index * 3, index * 3 + 3)
      .map(Math.fround)
      .join(',');
  for (let i = 0; i < indices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = pointKey(indices[i + j]);
      const b = pointKey(indices[i + ((j + 1) % 3)]);
      if (a === b) return { ok: false, reason: 'non-manifold' };
      const forward = a < b;
      const key = forward ? `${a}|${b}` : `${b}|${a}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++;
      edge.balance += forward ? 1 : -1;
      edges.set(key, edge);
    }
  }
  if (
    [...edges.values()].some(
      ({ count, balance }) => count !== 2 || balance !== 0,
    )
  ) {
    return { ok: false, reason: 'non-manifold' };
  }

  return {
    ok: true,
    geometry: {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
    },
  };
}
