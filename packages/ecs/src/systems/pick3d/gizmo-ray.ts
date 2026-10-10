import type { Entity } from '@lastolivegames/becsy';
import { vec2, vec3 as glVec3 } from 'gl-matrix';
import { Camera3D, ComputedCamera, Mat3 } from '../../components';
import {
  computeInvViewProjection,
  screenToRay,
  type Mesh3DPickScene,
  type Ray,
} from '../../utils/ray-casting';

/** Pointer ray using the same linked/standard camera convention as the scene. */
export function buildGizmoRay(
  vx: number,
  vy: number,
  viewportWidth: number,
  viewportHeight: number,
  camera: Camera3D,
  pickScene: Mesh3DPickScene,
  cam2d?: Entity,
): Ray | null {
  if (pickScene.mode === 'linkedPerspective') {
    if (!cam2d) return null;
    const inv = Mat3.toGLMat3(
      cam2d.read(ComputedCamera).viewProjectionMatrixInv,
    );
    const ndc = vec2.fromValues(
      (vx / viewportWidth) * 2 - 1,
      1 - (vy / viewportHeight) * 2,
    );
    const canvasPt = vec2.transformMat3(vec2.create(), ndc, inv);
    const origin: [number, number, number] = [
      camera.eye[0],
      camera.eye[1],
      camera.eye[2],
    ];
    const target: [number, number, number] = [canvasPt[0], canvasPt[1], 0];
    const dir = glVec3.create();
    glVec3.subtract(dir, target, origin);
    if (glVec3.length(dir) < 1e-8) return null;
    glVec3.normalize(dir, dir);
    return {
      origin,
      direction: [dir[0], dir[1], dir[2]],
    };
  }
  const invVP = computeInvViewProjection(
    pickScene.projMatrix,
    pickScene.viewMatrix,
  );
  return screenToRay(vx, vy, viewportWidth, viewportHeight, invVP);
}
