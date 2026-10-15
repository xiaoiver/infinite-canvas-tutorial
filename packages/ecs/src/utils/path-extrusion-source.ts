import type { Entity } from '@lastolivegames/becsy';
import { GlobalTransform, Path } from '../components';
import { getEnabledFillLayers } from './fillLayers';
import { getEnabledStrokeLayers } from './strokeLayers';
import {
  buildPathExtrusionMesh,
  type PathExtrusionMesh,
} from './path-extrusion-mesh';
import { pathExtrusionPaintSupported } from './path-extrusion-paint';

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
  // Preserve the 2D rendering of strokes, layered fills and unsupported paints.
  if (
    !pathExtrusionPaintSupported(
      getEnabledFillLayers(entity),
      getEnabledStrokeLayers(entity),
    )
  )
    return;
  const { d, fillRule } = entity.read(Path);
  const previous = cache.get(entity);
  if (previous?.d === d && previous.fillRule === fillRule)
    return forTransform(entity, previous);

  const mesh = buildPathExtrusionMesh(d, fillRule);
  const entry = { d, fillRule, mesh };
  cache.set(entity, entry);
  return forTransform(entity, entry);
}
