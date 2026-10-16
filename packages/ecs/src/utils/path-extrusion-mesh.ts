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

/** Build a unit-depth mesh from closed Path data, or leave it in 2D. */
export function buildPathExtrusionMesh(
  d: string,
  fillRule: CanvasFillRule = 'nonzero',
  bevel?: PathBevelOptions,
  linear?: readonly [number, number, number, number],
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
      return { geometry, center, sourceCenter, bakedTransform: true };
    }
    return { geometry, center };
  } catch {
    // Invalid path data keeps its 2D representation.
  }
}
