import type { Entity } from '@lastolivegames/becsy';
import { ComputedBounds, Extrude3D } from '../components';
import { extrudePathContours } from './geometry3d/extrude-path';
import { createUnitCubeGeometry } from './geometry3d/unit-cube';
import type { Mesh3DGeometryData } from './geometry3d/types';

const unitCube = createUnitCubeGeometry();
const cache = new WeakMap<
  Entity,
  { key: string; geometry: Mesh3DGeometryData }
>();

/** Unit box geometry with a world-size bevel, matching the companion pose scale. */
export function rectExtrusionGeometry(source: Entity): Mesh3DGeometryData {
  const { bevelSize, bevelSegments, depth } = source.read(Extrude3D);
  if (!(bevelSize > 0) || !source.has(ComputedBounds)) return unitCube;
  const { geometryWorldBounds: bounds } = source.read(ComputedBounds);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    bevelSize * 2 >= Math.min(width, height, depth)
  )
    return unitCube;
  const key = `${width},${height},${depth},${bevelSize},${bevelSegments}`;
  const previous = cache.get(source);
  if (previous?.key === key) return previous.geometry;

  const result = extrudePathContours(
    [
      [
        [-width / 2, -height / 2],
        [width / 2, -height / 2],
        [width / 2, height / 2],
        [-width / 2, height / 2],
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
    positions[i] /= width;
    positions[i + 1] /= height;
    positions[i + 2] /= depth;
    const nx = normals[i] * width;
    const ny = normals[i + 1] * height;
    const nz = normals[i + 2] * depth;
    const length = Math.hypot(nx, ny, nz);
    normals[i] = nx / length;
    normals[i + 1] = ny / length;
    normals[i + 2] = nz / length;
  }
  cache.set(source, { key, geometry });
  return geometry;
}
