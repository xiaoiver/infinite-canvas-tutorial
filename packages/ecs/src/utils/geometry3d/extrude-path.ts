import libtess from 'libtess';
import polygonClipping from 'polygon-clipping';
import { triangulate } from '../tessy';
import type { Mesh3DGeometryData } from './types';
import { insetFillBoundaries } from './inset-fill-boundaries';

type Point = [number, number];

export type PathExtrusionResult =
  | { ok: true; geometry: Mesh3DGeometryData }
  | {
      ok: false;
      reason:
        | 'invalid-depth'
        | 'invalid-bevel'
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
 * Intersect the resolved fill with a convex SVG viewport. Resolve winding
 * before clipping so evenodd holes, overlapping contours and nested islands
 * retain the same visible region after the intersection.
 */
export function clipFilledContoursToPolygon(
  contours: Point[][],
  fillRule: CanvasFillRule,
  clip: Point[],
): Point[][] | undefined {
  try {
    const boundaries = filledBoundaries(contours, fillRule);
    if (!boundaries) return;
    if (!boundaries.length) return [];
    // Boundary-only tessellation orients outer loops counterclockwise and
    // holes clockwise. XOR of these nested loops reconstructs the fill,
    // including islands within holes, without depending on ring orientation.
    const rings = boundaries.map((boundary) => [
      [...boundary, boundary[0]],
    ]);
    const filled = polygonClipping.xor(rings[0], ...rings.slice(1));
    const viewport = [[...clip, clip[0]]];
    const clipped = polygonClipping.intersection(filled, viewport);
    return clipped.flatMap((polygon) =>
      polygon.map((ring) =>
        ring.slice(0, -1).map(([x, y]): Point => [x, y]),
      ),
    );
  } catch {
    return;
  }
}

export type FilledContourShape = {
  contours: Point[][];
  fillRule: CanvasFillRule;
};

/** Union the shapes within each SVG clipPath, then intersect each clipPath. */
export function clipFilledContoursToRegions(
  contours: Point[][],
  fillRule: CanvasFillRule,
  regions: FilledContourShape[][],
): { contours: Point[][]; inside: boolean } | undefined {
  try {
    const asPolygon = ({ contours, fillRule }: FilledContourShape) => {
      const boundaries = filledBoundaries(contours, fillRule);
      if (!boundaries) return;
      if (!boundaries.length) return [];
      const rings = boundaries.map((boundary) => [[...boundary, boundary[0]]]);
      return polygonClipping.xor(rings[0], ...rings.slice(1));
    };
    const source = asPolygon({ contours, fillRule });
    if (source === undefined) return;
    if (!source.length) return { contours: [], inside: false };
    let clipped = source;
    for (const shapes of regions) {
      const polygons = shapes.map(asPolygon);
      if (polygons.some((polygon) => polygon === undefined)) return;
      const nonempty = polygons.filter((polygon) => polygon?.length);
      if (!nonempty.length) return { contours: [], inside: false };
      const region = polygonClipping.union(nonempty[0]!, ...nonempty.slice(1));
      clipped = polygonClipping.intersection(clipped, region);
      if (!clipped.length) return { contours: [], inside: false };
    }
    const inside = !polygonClipping.difference(source, clipped).length;
    return {
      inside,
      contours: clipped.flatMap((polygon) => polygon.map((ring) =>
        ring.slice(0, -1).map(([x, y]): Point => [x, y]))),
    };
  } catch {
    return;
  }
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
  bevel = 0,
  bevelSegments = 1,
): PathExtrusionResult {
  if (
    !Number.isFinite(depth) ||
    depth <= 0 ||
    !Number.isFinite(Math.fround(depth))
  ) {
    return { ok: false, reason: 'invalid-depth' };
  }
  if (
    !Number.isFinite(bevel) ||
    !Number.isFinite(Math.fround(bevel)) ||
    bevel < 0
  )
    return { ok: false, reason: 'invalid-bevel' };
  if (
    !Number.isInteger(bevelSegments) ||
    bevelSegments < 1 ||
    bevelSegments > 8
  )
    return { ok: false, reason: 'invalid-bevel' };
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
  // Keep vertex correspondence between each wall and its cap. When an inward
  // offset changes topology, retain the sharp extrusion instead.
  let insets =
    bevel > 0 && bevel * 2 < depth
      ? insetFillBoundaries(boundaries, bevel)
      : undefined;
  if (insets) {
    try {
      if (filledBoundaries(insets, 'nonzero')?.length !== boundaries.length)
        insets = undefined;
    } catch {
      insets = undefined;
    }
  }
  const capBoundaries = insets ?? boundaries;
  const fail = (
    reason: 'empty-fill' | 'tessellation-failed' | 'non-manifold',
  ): PathExtrusionResult =>
    insets
      ? extrudePathContours(rawContours, depth, fillRule)
      : { ok: false, reason };

  // Triangulating the resolved boundaries ensures that caps and walls describe
  // the same region even when source contours overlap or self-intersect.
  let triangles: number[];
  try {
    triangles = triangulate(capBoundaries, 'nonzero');
  } catch {
    return fail('tessellation-failed');
  }
  if (!triangles.length) return fail('empty-fill');
  if (
    triangles.length % 6 !== 0 ||
    triangles.some((n) => !Number.isFinite(n))
  ) {
    return fail('tessellation-failed');
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
    return fail('empty-fill');
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
  // Triangles on the same cap share positions, normals and UVs. Keep front and
  // back separate because their normals point in opposite directions; walls
  // also need separate vertices for their flat, outward-facing normals.
  const capVertices = [new Map<string, number>(), new Map<string, number>()];
  const capVertex = (point: Point, front: boolean): number => {
    const vertices = capVertices[front ? 0 : 1];
    const key = `${Math.fround(point[0])},${Math.fround(point[1])}`;
    const existing = vertices.get(key);
    if (existing !== undefined) return existing;
    const [u, v] = capUv(point);
    const index = addVertex(
      point[0],
      point[1],
      front ? halfDepth : -halfDepth,
      0,
      0,
      front ? 1 : -1,
      u,
      v,
    );
    vertices.set(key, index);
    return index;
  };

  for (let i = 0; i < triangles.length; i += 6) {
    const a: Point = [triangles[i], triangles[i + 1]];
    const b: Point = [triangles[i + 2], triangles[i + 3]];
    const c: Point = [triangles[i + 4], triangles[i + 5]];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (!Number.isFinite(cross) || cross === 0) {
      return fail('tessellation-failed');
    }
    const [first, second, third] = cross > 0 ? [a, b, c] : [a, c, b];
    indices.push(
      capVertex(first, true),
      capVertex(second, true),
      capVertex(third, true),
      capVertex(third, false),
      capVertex(second, false),
      capVertex(first, false),
    );
  }

  const addQuad = (
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    z0: number,
    z1: number,
    normal: [number, number, number],
    u0: number,
    u1: number,
    v0: number,
    v1: number,
  ) => {
    const base = positions.length / 3;
    addVertex(a[0], a[1], z0, ...normal, u0, v0);
    addVertex(b[0], b[1], z0, ...normal, u1, v0);
    addVertex(c[0], c[1], z1, ...normal, u1, v1);
    addVertex(d[0], d[1], z1, ...normal, u0, v1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const roundedProfile =
    insets && bevelSegments > 1
      ? Array.from({ length: bevelSegments + 1 }, (_, step) => {
          const angle = (step * Math.PI) / (2 * bevelSegments);
          return {
            fraction: step === bevelSegments ? 1 : 1 - Math.cos(angle),
            radial: step === bevelSegments ? 0 : Math.cos(angle),
            axial: step === bevelSegments ? 1 : Math.sin(angle),
          };
        })
      : [];

  for (const [boundaryIndex, boundary] of boundaries.entries()) {
    let distance = 0;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length === 0) {
        return fail('tessellation-failed');
      }
      // libtess emits exterior loops counter-clockwise and holes clockwise.
      const nx = dy / length;
      const ny = -dx / length;
      const chamfer = insets?.[boundaryIndex];
      if (chamfer) {
        const innerA = chamfer[i];
        const innerB = chamfer[(i + 1) % chamfer.length];
        if (bevelSegments === 1) {
          const diagonal = 1 / Math.sqrt(2);
          addQuad(
            innerA,
            innerB,
            b,
            a,
            -halfDepth,
            -halfDepth + bevel,
            [nx * diagonal, ny * diagonal, -diagonal],
            distance,
            distance + length,
            0,
            bevel,
          );
          addQuad(
            a,
            b,
            b,
            a,
            -halfDepth + bevel,
            halfDepth - bevel,
            [nx, ny, 0],
            distance,
            distance + length,
            bevel,
            depth - bevel,
          );
          addQuad(
            a,
            b,
            innerB,
            innerA,
            halfDepth - bevel,
            halfDepth,
            [nx * diagonal, ny * diagonal, diagonal],
            distance,
            distance + length,
            depth - bevel,
            depth,
          );
        } else {
          // Each edge owns its hard corner, but adjacent profile bands share
          // their ring vertices and the wall uses the same outer ring.
          const frontA: number[] = [];
          const frontB: number[] = [];
          const backA: number[] = [];
          const backB: number[] = [];
          for (const [step, profile] of roundedProfile.entries()) {
            const atA: Point =
              step === 0
                ? a
                : step === bevelSegments
                ? innerA
                : [
                    a[0] + (innerA[0] - a[0]) * profile.fraction,
                    a[1] + (innerA[1] - a[1]) * profile.fraction,
                  ];
            const atB: Point =
              step === 0
                ? b
                : step === bevelSegments
                ? innerB
                : [
                    b[0] + (innerB[0] - b[0]) * profile.fraction,
                    b[1] + (innerB[1] - b[1]) * profile.fraction,
                  ];
            const frontZ =
              step === bevelSegments
                ? halfDepth
                : halfDepth - bevel + bevel * profile.axial;
            const backZ =
              step === bevelSegments
                ? -halfDepth
                : -halfDepth + bevel - bevel * profile.axial;
            const xNormal = nx * profile.radial;
            const yNormal = ny * profile.radial;
            frontA.push(
              addVertex(
                atA[0],
                atA[1],
                frontZ,
                xNormal,
                yNormal,
                profile.axial,
                distance,
                frontZ + halfDepth,
              ),
            );
            frontB.push(
              addVertex(
                atB[0],
                atB[1],
                frontZ,
                xNormal,
                yNormal,
                profile.axial,
                distance + length,
                frontZ + halfDepth,
              ),
            );
            backA.push(
              addVertex(
                atA[0],
                atA[1],
                backZ,
                xNormal,
                yNormal,
                -profile.axial,
                distance,
                backZ + halfDepth,
              ),
            );
            backB.push(
              addVertex(
                atB[0],
                atB[1],
                backZ,
                xNormal,
                yNormal,
                -profile.axial,
                distance + length,
                backZ + halfDepth,
              ),
            );
          }
          for (let step = 0; step < bevelSegments; step++) {
            indices.push(
              frontA[step],
              frontB[step],
              frontB[step + 1],
              frontA[step],
              frontB[step + 1],
              frontA[step + 1],
              backA[step + 1],
              backB[step + 1],
              backB[step],
              backA[step + 1],
              backB[step],
              backA[step],
            );
          }
          indices.push(
            backA[0],
            backB[0],
            frontB[0],
            backA[0],
            frontB[0],
            frontA[0],
          );
        }
      } else {
        addQuad(
          a,
          b,
          b,
          a,
          -halfDepth,
          halfDepth,
          [nx, ny, 0],
          distance,
          distance + length,
          0,
          depth,
        );
      }
      distance += length;
    }
  }

  if (
    positions.some((n) => !Number.isFinite(Math.fround(n))) ||
    normals.some((n) => !Number.isFinite(Math.fround(n))) ||
    uvs.some((n) => !Number.isFinite(Math.fround(n)))
  ) {
    return fail('tessellation-failed');
  }

  // A self crossing can create two solid lobes sharing a vertical edge. The
  // resulting mesh is pinched, so reject it rather than return invalid volume.
  // This also catches cracks between the independently tessellated caps/walls.
  const edges = new Map<string, { count: number; balance: number }>();
  const pointKeys: string[] = [];
  const pointKey = (index: number): string => {
    const existing = pointKeys[index];
    if (existing !== undefined) return existing;
    const offset = index * 3;
    return (pointKeys[index] = `${Math.fround(positions[offset])},${Math.fround(
      positions[offset + 1],
    )},${Math.fround(positions[offset + 2])}`);
  };
  for (let i = 0; i < indices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = pointKey(indices[i + j]);
      const b = pointKey(indices[i + ((j + 1) % 3)]);
      if (a === b) return fail('non-manifold');
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
    return fail('non-manifold');
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
