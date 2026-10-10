import type { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import {
  Camera,
  Children,
  GlobalTransform,
  Mat3,
  Rect,
  Transform,
} from '../components';

/** Convert a world-space rectangle center into its parent-local document origin. */
export function resolveCanvasSourceOrigin(
  source: Entity,
  center: readonly number[],
) {
  if (!source.has(Transform)) return;
  let inverseParent = mat3.create();
  if (source.has(Children)) {
    const parent = source.read(Children).parent;
    if (parent && !parent.has(Camera) && parent.has(GlobalTransform)) {
      const inverse = mat3.invert(
        mat3.create(),
        Mat3.toGLMat3(parent.read(GlobalTransform).matrix),
      );
      if (!inverse) return;
      inverseParent = inverse;
    }
  }
  const x =
    inverseParent[0] * center[0] +
    inverseParent[3] * center[1] +
    inverseParent[6];
  const y =
    inverseParent[1] * center[0] +
    inverseParent[4] * center[1] +
    inverseParent[7];
  const local = source.read(Transform);
  const rect = source.has(Rect) ? source.read(Rect) : undefined;
  const cx = ((rect?.width ?? 0) * local.scale.x) / 2;
  const cy = ((rect?.height ?? 0) * local.scale.y) / 2;
  const cos = Math.cos(local.rotation);
  const sin = Math.sin(local.rotation);
  return { x: x - (cx * cos - cy * sin), y: y - (cx * sin + cy * cos) };
}
