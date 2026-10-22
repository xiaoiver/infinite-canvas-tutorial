import { vec3 } from 'gl-matrix';
import type { Transform3D } from '../components';
import { projectGizmoPoint } from './gizmo-frame';
import { computeModelMatrix, type Mesh3DPickScene } from './ray-casting';

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Geometry sync replaces position buffers when vertices change. Keep the local
// scan for each immutable buffer while projecting its current transform anew.
const localBounds = new WeakMap<
  Float32Array,
  { min: number[]; max: number[] }
>();

/** Project the eight corners of a mesh's local bounds through its render matrix. */
export function projectMesh3DViewportBounds(
  positions: Float32Array,
  transform: Pick<Transform3D, 'translation' | 'rotation' | 'scale'>,
  scene: Mesh3DPickScene,
  width: number,
  height: number,
): ViewportBounds | null {
  if (positions.length < 3 || width <= 0 || height <= 0) return null;
  let bounds = localBounds.get(positions);
  if (!bounds) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i + 2 < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[i + axis];
        if (!Number.isFinite(value)) return null;
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
    bounds = { min, max };
    localBounds.set(positions, bounds);
  }

  const matrix = computeModelMatrix(
    transform.translation,
    transform.rotation,
    transform.scale,
  );
  const projected: ViewportBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const frame = {
    scene,
    anchor: transform.translation,
    width,
    height,
    scale: 1,
  };
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const world = vec3.transformMat4(vec3.create(), [x, y, z], matrix);
        const point = projectGizmoPoint(frame, [world[0], world[1], world[2]]);
        if (!point) return null;
        projected.minX = Math.min(projected.minX, point[0]);
        projected.minY = Math.min(projected.minY, point[1]);
        projected.maxX = Math.max(projected.maxX, point[0]);
        projected.maxY = Math.max(projected.maxY, point[1]);
      }
    }
  }
  return projected;
}

export function containsViewportBounds(
  marquee: ViewportBounds,
  target: ViewportBounds,
): boolean {
  return (
    marquee.minX <= target.minX &&
    marquee.minY <= target.minY &&
    marquee.maxX >= target.maxX &&
    marquee.maxY >= target.maxY
  );
}
