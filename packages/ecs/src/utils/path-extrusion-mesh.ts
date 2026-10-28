import { flattenPath } from './curve/adaptive';
import { parsePath } from './curve/shape-path';
import { extrudePathContours } from './extrude3d-geometry';
import type { Mesh3DGeometryData } from './geometry3d/types';

export interface PathExtrusionMesh {
  geometry: Mesh3DGeometryData;
  center: [number, number];
  /** Local point corresponding to center when the source's affine transform is baked. */
  sourceCenter?: [number, number];
  bakedTransform?: boolean;
}

export interface PathBevelOptions {
  /** Source X/Y scale and extrusion depth convert world-size bevels to unit mesh space. */
  scaleX: number;
  scaleY: number;
  depth: number;
  bevelSize: number;
  bevelSegments?: number;
}

// Repeated SVG <use> instances and import preflights often request exactly
// the same mesh. Weak references keep the broad lookup from owning meshes.
// A small bounded strong tier bridges the async gap between SVG preflight and
// companion creation, where a GC can otherwise discard every preflight mesh.
const sharedMeshes = new Map<string, WeakRef<PathExtrusionMesh>>();
const MAX_SHARED_MESHES = 64;
const MAX_SHARED_KEY_LENGTH = 20_000;
const recentMeshes = new Map<
  string,
  { mesh: PathExtrusionMesh; bytes: number }
>();
const MAX_RECENT_MESHES = 256;
const MAX_RECENT_MESH_BYTES = 8 * 1024 * 1024;
let recentMeshBytes = 0;
let recentMeshHits = 0;

function retainRecentMesh(key: string, mesh: PathExtrusionMesh): void {
  const bytes = Object.values(mesh.geometry).reduce(
    (total, view) => total + (view?.byteLength ?? 0),
    0,
  );
  if (bytes > MAX_RECENT_MESH_BYTES) return;
  const previous = recentMeshes.get(key);
  if (previous) recentMeshBytes -= previous.bytes;
  recentMeshes.delete(key);
  recentMeshes.set(key, { mesh, bytes });
  recentMeshBytes += bytes;
  while (
    recentMeshes.size > MAX_RECENT_MESHES ||
    recentMeshBytes > MAX_RECENT_MESH_BYTES
  ) {
    const oldest = recentMeshes.keys().next().value!;
    recentMeshBytes -= recentMeshes.get(oldest)!.bytes;
    recentMeshes.delete(oldest);
  }
}

/** Retained geometry only; string keys and device buffers are excluded. */
export function recentPathExtrusionMeshCacheStats() {
  return {
    entries: recentMeshes.size,
    geometryBytes: recentMeshBytes,
    hits: recentMeshHits,
  };
}

function meshKey(
  d: string,
  fillRule: CanvasFillRule,
  bevel?: PathBevelOptions,
  linear?: readonly [number, number, number, number],
): string | undefined {
  if (d.length > MAX_SHARED_KEY_LENGTH) return;
  const key = JSON.stringify([
    d,
    fillRule,
    bevel && [
      bevel.scaleX,
      bevel.scaleY,
      bevel.depth,
      bevel.bevelSize,
      bevel.bevelSegments ?? 1,
    ],
    linear,
  ]);
  return key.length <= MAX_SHARED_KEY_LENGTH ? key : undefined;
}

function rememberMesh(
  key: string | undefined,
  mesh: PathExtrusionMesh,
): PathExtrusionMesh {
  if (key) {
    sharedMeshes.delete(key);
    sharedMeshes.set(key, new WeakRef(mesh));
    if (sharedMeshes.size > MAX_SHARED_MESHES)
      sharedMeshes.delete(sharedMeshes.keys().next().value!);
    retainRecentMesh(key, mesh);
  }
  return mesh;
}

/** Build a unit-depth mesh from closed Path data, or leave it in 2D.
 * Returned geometry may be shared by identical inputs and must remain read-only.
 */
export function buildPathExtrusionMesh(
  d: string,
  fillRule: CanvasFillRule = 'nonzero',
  bevel?: PathBevelOptions,
  linear?: readonly [number, number, number, number],
): PathExtrusionMesh | undefined {
  const key = meshKey(d, fillRule, bevel, linear);
  if (key) {
    const recent = recentMeshes.get(key)?.mesh;
    const cached = recent ?? sharedMeshes.get(key)?.deref();
    if (cached) {
      if (recent) recentMeshHits++;
      sharedMeshes.delete(key);
      sharedMeshes.set(key, new WeakRef(cached));
      retainRecentMesh(key, cached);
      return cached;
    }
    sharedMeshes.delete(key);
  }
  try {
    const { subPaths } = parsePath(d);
    if (
      !subPaths.length ||
      subPaths.some((path) => {
        if (!path.curves.length) return true;
        if (path.autoClose) return false;
        const start = path.curves[0].getPoint(0);
        const end = path.curves[path.curves.length - 1].getPoint(1);
        return start[0] !== end[0] || start[1] !== end[1];
      })
    )
      return;

    const contours = flattenPath(
      subPaths,
      linear ? 2 * Math.max(1, Math.hypot(...linear)) : 2,
    );
    if (linear) {
      const [m00, m01, m10, m11] = linear;
      for (const contour of contours) {
        for (const point of contour) {
          const [x, y] = point;
          point[0] = m00 * x + m10 * y;
          point[1] = m01 * x + m11 * y;
        }
      }
    }
    const useBevel =
      bevel &&
      bevel.bevelSize > 0 &&
      bevel.scaleX > 0 &&
      bevel.scaleY > 0 &&
      bevel.depth > 0;
    const result = useBevel
      ? extrudePathContours(
          contours.map((contour) =>
            contour.map(([x, y]) => [x * bevel.scaleX, y * bevel.scaleY]),
          ),
          bevel.depth,
          fillRule,
          bevel.bevelSize,
          bevel.bevelSegments,
        )
      : extrudePathContours(contours, 1, fillRule);
    if (!result.ok) return;
    const geometry = result.geometry;
    const { positions, normals } = geometry;
    if (useBevel) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] /= bevel.scaleX;
        positions[i + 1] /= bevel.scaleY;
        positions[i + 2] /= bevel.depth;
        const nx = normals[i] * bevel.scaleX;
        const ny = normals[i + 1] * bevel.scaleY;
        const nz = normals[i + 2] * bevel.depth;
        const length = Math.hypot(nx, ny, nz);
        normals[i] = nx / length;
        normals[i + 1] = ny / length;
        normals[i + 2] = nz / length;
      }
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      maxX = Math.max(maxX, positions[i]);
      maxY = Math.max(maxY, positions[i + 1]);
    }
    const center: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] -= center[0];
      positions[i + 1] -= center[1];
    }
    if (linear) {
      const [m00, m01, m10, m11] = linear;
      const determinant = m00 * m11 - m01 * m10;
      if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12)
        return;
      const sourceCenter: [number, number] = [
        (m11 * center[0] - m10 * center[1]) / determinant,
        (-m01 * center[0] + m00 * center[1]) / determinant,
      ];
      return rememberMesh(key, {
        geometry,
        center,
        sourceCenter,
        bakedTransform: true,
      });
    }
    return rememberMesh(key, { geometry, center });
  } catch {
    // Invalid path data keeps its 2D representation.
  }
}
