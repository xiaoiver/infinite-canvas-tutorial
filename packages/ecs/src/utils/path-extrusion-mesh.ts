import { flattenPath } from './curve/adaptive';
import { parsePath } from './curve/shape-path';
import { extrudePathContours } from './extrude3d-geometry';
import type { Mesh3DGeometryData } from './geometry3d/types';

export interface PathExtrusionMesh {
  geometry: Mesh3DGeometryData;
  center: [number, number];
}

export interface PathBevelOptions {
  /** Source X/Y scale and extrusion depth convert world-size bevels to unit mesh space. */
  scaleX: number;
  scaleY: number;
  depth: number;
  bevelSize: number;
  bevelSegments?: number;
}

/** Build a unit-depth mesh from closed Path data, or leave it in 2D. */
export function buildPathExtrusionMesh(
  d: string,
  fillRule: CanvasFillRule = 'nonzero',
  bevel?: PathBevelOptions,
): PathExtrusionMesh | undefined {
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

    const contours = flattenPath(subPaths, 2);
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
    return { geometry, center };
  } catch {
    // Invalid path data keeps its 2D representation.
  }
}
