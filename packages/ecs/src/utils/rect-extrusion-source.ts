import type { Entity } from '@lastolivegames/becsy';
import {
  ComputedBounds,
  Extrude3D,
  GlobalTransform,
  Rect,
} from '../components';
import { extrudePathContours } from './geometry3d/extrude-path';
import { createUnitCubeGeometry } from './geometry3d/unit-cube';
import type { Mesh3DGeometryData } from './geometry3d/types';
import { buildPathExtrusionMesh } from './path-extrusion-mesh';

const unitCube = createUnitCubeGeometry();
const cache = new WeakMap<
  Entity,
  { key: string; geometry: Mesh3DGeometryData }
>();

/** Shear, reflection and rounded corners need their world footprint baked. */
export function rectExtrusionIsBaked(source: Entity): boolean {
  if (!source.has(Rect) || !source.has(GlobalTransform)) return false;
  const { m00, m01, m10, m11 } = source.read(GlobalTransform).matrix;
  const a = Math.hypot(m00, m01);
  const b = Math.hypot(m10, m11);
  return (
    source.read(Rect).cornerRadius > 0 ||
    m00 * m11 - m01 * m10 < 0 ||
    Math.abs(m00 * m10 + m01 * m11) > a * b * 1e-6
  );
}

function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  return (
    `M${x + r} ${y} H${x + width - r} A${r} ${r} 0 0 1 ${x + width} ${y + r} ` +
    `V${y + height - r} A${r} ${r} 0 0 1 ${x + width - r} ${y + height} ` +
    `H${x + r} A${r} ${r} 0 0 1 ${x} ${y + height - r} ` +
    `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

/** Unit-depth geometry with the source's exact footprint and world-size bevel. */
export function rectExtrusionGeometry(
  source: Entity,
): Mesh3DGeometryData | undefined {
  if (!source.has(ComputedBounds) || !source.has(GlobalTransform)) return;
  const { bevelSize, bevelSegments, depth } = source.read(Extrude3D);
  const { geometryBounds } = source.read(ComputedBounds);
  const width = geometryBounds.maxX - geometryBounds.minX;
  const height = geometryBounds.maxY - geometryBounds.minY;
  if (!(width > 0 && height > 0))
    return source.read(Extrude3D).meshEntity
      ? cache.get(source)?.geometry ?? unitCube
      : undefined;
  const { m00, m01, m10, m11 } = source.read(GlobalTransform).matrix;
  const scaleX = Math.hypot(m00, m01);
  const scaleY = Math.hypot(m10, m11);
  if (
    !(scaleX > 0 && scaleY > 0) ||
    !Number.isFinite(scaleX * scaleY) ||
    Math.abs(m00 * m11 - m01 * m10) <= scaleX * scaleY * 1e-8
  )
    return;
  const baked = rectExtrusionIsBaked(source);
  const radius = source.read(Rect).cornerRadius;
  const key = `${width},${height},${radius},${
    bevelSize > 0 ? depth : ''
  },${bevelSize},${bevelSegments},${
    baked ? `${m00},${m01},${m10},${m11}` : `${scaleX},${scaleY}`
  }`;
  const previous = cache.get(source);
  if (previous?.key === key) return previous.geometry;

  if (baked) {
    const { minX: x, minY: y } = geometryBounds;
    const angle = Math.atan2(m01, m00);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const d =
      radius > 0
        ? roundedRectPath(x, y, width, height, radius)
        : `M${x} ${y} H${x + width} V${y + height} H${x} Z`;
    const mesh = buildPathExtrusionMesh(
      d,
      'nonzero',
      bevelSize > 0
        ? { scaleX: 1, scaleY: 1, depth, bevelSize, bevelSegments }
        : undefined,
      [
        cos * m00 + sin * m01,
        -sin * m00 + cos * m01,
        cos * m10 + sin * m11,
        -sin * m10 + cos * m11,
      ],
    );
    if (!mesh) return;
    cache.set(source, { key, geometry: mesh.geometry });
    return mesh.geometry;
  }

  if (!(bevelSize > 0)) return unitCube;
  const worldWidth = width * scaleX;
  const worldHeight = height * scaleY;
  if (
    !Number.isFinite(worldWidth) ||
    !Number.isFinite(worldHeight) ||
    bevelSize * 2 >= Math.min(worldWidth, worldHeight, depth)
  )
    return unitCube;

  const result = extrudePathContours(
    [
      [
        [-worldWidth / 2, -worldHeight / 2],
        [worldWidth / 2, -worldHeight / 2],
        [worldWidth / 2, worldHeight / 2],
        [-worldWidth / 2, worldHeight / 2],
      ],
    ],
    depth,
    'nonzero',
    bevelSize,
    bevelSegments,
  );
  if (!result.ok) return unitCube;
  const geometry = result.geometry;
  const { positions, normals } = geometry;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] /= worldWidth;
    positions[i + 1] /= worldHeight;
    positions[i + 2] /= depth;
    const nx = normals[i] * worldWidth;
    const ny = normals[i + 1] * worldHeight;
    const nz = normals[i + 2] * depth;
    const length = Math.hypot(nx, ny, nz);
    normals[i] = nx / length;
    normals[i + 1] = ny / length;
    normals[i + 2] = nz / length;
  }
  cache.set(source, { key, geometry });
  return geometry;
}
