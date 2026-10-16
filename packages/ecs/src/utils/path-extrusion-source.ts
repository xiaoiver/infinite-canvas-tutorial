import type { Entity } from '@lastolivegames/becsy';
import { Extrude3D, GlobalTransform, Path } from '../components';
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
    bevelKey: string;
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
  if (entry.mesh?.bakedTransform) return entry.mesh;
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

/** Reject singular or non-finite source transforms; shear is baked into geometry. */
export function pathExtrusionTransformSupported(entity: Entity): boolean {
  if (!entity.has(GlobalTransform)) return false;
  const { m00, m01, m10, m11 } = entity.read(GlobalTransform).matrix;
  const a = Math.hypot(m00, m01);
  const b = Math.hypot(m10, m11);
  return (
    a > 0 &&
    b > 0 &&
    Number.isFinite(a * b) &&
    Math.abs(m00 * m11 - m01 * m10) > a * b * 1e-8
  );
}

/** Unit-depth mesh centered on the Path's local bounds; its 3D pose supplies depth. */
export function pathExtrusionGeometry(
  entity: Entity,
): PathExtrusionMesh | undefined {
  if (
    !entity.has(Path) ||
    !entity.has(Extrude3D) ||
    !pathExtrusionTransformSupported(entity)
  )
    return;
  // Preserve the 2D rendering of strokes, layered fills and unsupported paints.
  if (
    !pathExtrusionPaintSupported(
      getEnabledFillLayers(entity),
      getEnabledStrokeLayers(entity),
    )
  )
    return;
  const { d, fillRule } = entity.read(Path);
  const { depth, bevelSize, bevelSegments } = entity.read(Extrude3D);
  const { m00, m01, m10, m11 } = entity.read(GlobalTransform).matrix;
  const scaleX = Math.hypot(m00, m01);
  const scaleY = Math.hypot(m10, m11);
  const bakedTransform =
    Math.abs(m00 * m10 + m01 * m11) > scaleX * scaleY * 1e-6;
  const bevelKey =
    `${bakedTransform ? `${m00},${m01},${m10},${m11}` : ''}|` +
    (bevelSize > 0
      ? `${
          bakedTransform ? '1,1' : `${scaleX},${scaleY}`
        },${depth},${bevelSize},${bevelSegments}`
      : '');
  const previous = cache.get(entity);
  if (
    previous?.d === d &&
    previous.fillRule === fillRule &&
    previous.bevelKey === bevelKey
  )
    return forTransform(entity, previous);

  // Keep the source angle in the 3D pose and bake only residual scale/shear.
  const angle = Math.atan2(m01, m00);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const residual: [number, number, number, number] = [
    cos * m00 + sin * m01,
    -sin * m00 + cos * m01,
    cos * m10 + sin * m11,
    -sin * m10 + cos * m11,
  ];
  const mesh = buildPathExtrusionMesh(
    d,
    fillRule,
    bevelSize > 0
      ? {
          scaleX: bakedTransform ? 1 : scaleX,
          scaleY: bakedTransform ? 1 : scaleY,
          depth,
          bevelSize,
          bevelSegments,
        }
      : undefined,
    bakedTransform ? residual : undefined,
  );
  const entry = { d, fillRule, bevelKey, mesh };
  cache.set(entity, entry);
  return forTransform(entity, entry);
}
