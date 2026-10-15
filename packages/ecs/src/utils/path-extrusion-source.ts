import type { Entity } from '@lastolivegames/becsy';
import { GlobalTransform, Path } from '../components';
import { flattenPath } from './curve/adaptive';
import { parsePath } from './curve/shape-path';
import { extrudePathContours } from './extrude3d-geometry';
import { getEnabledFillLayers } from './fillLayers';
import { getEnabledStrokeLayers } from './strokeLayers';
import type { Mesh3DGeometryData } from './geometry3d/types';

export interface PathExtrusionMesh {
  geometry: Mesh3DGeometryData;
  center: [number, number];
}

const cache = new WeakMap<
  Entity,
  {
    d: string;
    fillRule: CanvasFillRule;
    mesh?: PathExtrusionMesh;
    mirrored?: PathExtrusionMesh;
  }
>();

function forTransform(
  entity: Entity,
  entry: {
    mesh?: PathExtrusionMesh;
    mirrored?: PathExtrusionMesh;
  },
): PathExtrusionMesh | undefined {
  const { m00, m01, m10, m11 } = entity.read(GlobalTransform).matrix;
  if (m00 * m11 - m01 * m10 >= 0 || !entry.mesh) return entry.mesh;
  if (!entry.mirrored) {
    const base = entry.mesh.geometry;
    const indices = new Uint32Array(base.indices);
    for (let i = 0; i < indices.length; i += 3) {
      const second = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = second;
    }
    entry.mirrored = {
      center: entry.mesh.center,
      geometry: {
        ...base,
        normals: base.normals.map((value) => -value),
        indices,
      },
    };
  }
  return entry.mirrored;
}

/** A 3D pose cannot represent a sheared 2D source without a model matrix. */
export function pathExtrusionTransformSupported(entity: Entity): boolean {
  if (!entity.has(GlobalTransform)) return false;
  const { m00, m01, m10, m11 } = entity.read(GlobalTransform).matrix;
  const a = Math.hypot(m00, m01);
  const b = Math.hypot(m10, m11);
  return (
    a > 0 &&
    b > 0 &&
    Number.isFinite(a * b) &&
    Math.abs(m00 * m10 + m01 * m11) <= a * b * 1e-6
  );
}

/** Unit-depth mesh centered on the Path's local bounds; its 3D pose supplies depth. */
export function pathExtrusionGeometry(
  entity: Entity,
): PathExtrusionMesh | undefined {
  if (!entity.has(Path) || !pathExtrusionTransformSupported(entity)) return;
  const fills = getEnabledFillLayers(entity);
  // Preserve the 2D rendering of strokes, layered fills and unsupported paints.
  if (
    fills.length !== 1 ||
    fills[0].type !== 'solid' ||
    getEnabledStrokeLayers(entity).length > 0
  )
    return;
  const { d, fillRule } = entity.read(Path);
  const previous = cache.get(entity);
  if (previous?.d === d && previous.fillRule === fillRule)
    return forTransform(entity, previous);

  let mesh: PathExtrusionMesh | undefined;
  try {
    const { subPaths } = parsePath(d);
    const closed =
      subPaths.length > 0 &&
      subPaths.every((path) => {
        if (!path.curves.length) return false;
        if (path.autoClose) return true;
        const start = path.curves[0].getPoint(0);
        const end = path.curves[path.curves.length - 1].getPoint(1);
        return start[0] === end[0] && start[1] === end[1];
      });
    if (closed) {
      const result = extrudePathContours(flattenPath(subPaths, 2), 1, fillRule);
      if (result.ok) {
        const geometry = result.geometry;
        const positions = geometry.positions;
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
        mesh = { geometry, center };
      }
    }
  } catch {
    // Unsupported or malformed Path data keeps its ordinary 2D appearance.
  }
  const entry = { d, fillRule, mesh };
  cache.set(entity, entry);
  return forTransform(entity, entry);
}
