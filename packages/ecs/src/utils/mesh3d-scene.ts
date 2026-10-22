import type { Entity } from '@lastolivegames/becsy';
import {
  Camera,
  Camera3D,
  Canvas,
  ComputedCamera,
  linkedPerspectiveEyeDistance,
  mat3ViewProjectionToMat4,
  mat3ViewToMat4,
} from '../components';
import { Mat4 } from '../components/math/Mat4';
import type { Mesh3DPickScene } from './ray-casting';

/** Scene matrices uploaded to mesh3d / gizmo shaders (std140 52 floats). */
export interface Camera3DSceneUniforms {
  mode: 'linkedPerspective' | 'linkedOrthographic' | 'standard';
  /** Free orthographic views use GREATER depth and put the near plane at clip Z=1. */
  reverseDepth?: boolean;
  projMatrix: Mat4;
  viewMatrix: Mat4;
  canvasViewProjection: Mat4;
  sceneParams: [number, number, number, number];
}

/**
 * Shared camera math for mesh rendering, picking and gizmos.
 */
export function buildCamera3DSceneUniforms(
  camera: Camera3D,
  aspect: number,
  cam2d?: Entity,
): Camera3DSceneUniforms {
  if (camera.linked && cam2d && camera.projection === 'orthographic') {
    const vp = cam2d.read(ComputedCamera).viewProjectionMatrix;
    const zScale = camera.far > 0 ? -2 / camera.far : 0;
    return {
      mode: 'linkedOrthographic',
      projMatrix: mat3ViewProjectionToMat4(vp, zScale),
      viewMatrix: Mat4.IDENTITY,
      canvasViewProjection: Mat4.IDENTITY,
      // The linked canvas projection views meshes from negative z.
      // z=-1 marks a constant orthographic view direction for lighting.
      sceneParams: [0, 0, -1, -1],
    };
  }

  if (camera.linked && cam2d && camera.projection === 'perspective') {
    const computed = cam2d.read(ComputedCamera);
    const camera2d = cam2d.read(Camera);
    const canvasHeight = camera2d.canvas
      ? camera2d.canvas.read(Canvas).height
      : 0;
    const eyeZ = linkedPerspectiveEyeDistance(
      canvasHeight,
      computed.zoom,
      camera.fovy,
    );
    const zShift = new Mat4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -eyeZ, 1);
    return {
      mode: 'linkedPerspective',
      viewMatrix: Mat4.multiply(mat3ViewToMat4(computed.viewMatrix), zShift),
      projMatrix: Mat4.perspective(
        camera.fovy,
        aspect,
        camera.near,
        camera.far,
      ),
      canvasViewProjection: mat3ViewProjectionToMat4(
        computed.viewProjectionMatrix,
        0,
      ),
      // The linked-perspective XY warp views the near (smaller-z) faces.
      // Shading therefore uses the effective eye on the negative-z side.
      sceneParams: [computed.x, computed.y, 1, -eyeZ],
    };
  }

  let projMatrix: Mat4;
  let viewMatrix: Mat4;
  if (camera.projection === 'orthographic') {
    const distance = Math.abs(camera.eye[2] - camera.center[2]);
    const halfH =
      camera.orthographicHeight > 0 &&
      Number.isFinite(camera.orthographicHeight)
        ? camera.orthographicHeight / 2
        : distance;
    const halfW = halfH * aspect;
    projMatrix = Mat4.ortho(
      -halfW,
      halfW,
      -halfH,
      halfH,
      camera.near,
      camera.far,
    );
    if (
      camera.orthographicHeight > 0 &&
      Number.isFinite(camera.orthographicHeight)
    ) {
      // The shared mesh pass uses GREATER depth testing over a 2D depth layer.
      // Reverse Z into [0.75, 1] so nearby meshes cover the floor without
      // clipping the camera's near half or changing the shared 2D depth pass.
      projMatrix.m22 = -projMatrix.m22 / 4;
      projMatrix.m32 = (3 - projMatrix.m32) / 4;
    }
  } else {
    projMatrix = Mat4.perspective(camera.fovy, aspect, camera.near, camera.far);
  }
  viewMatrix = Mat4.lookAt(camera.eye, camera.center, camera.up);

  const view =
    camera.projection === 'orthographic'
      ? camera.eye.map((value, index) => value - camera.center[index])
      : camera.eye;
  const length = Math.hypot(...view);
  const viewVector =
    length > 1e-8 && Number.isFinite(length) ? view : [0, 0, 1];

  return {
    mode: 'standard',
    reverseDepth:
      camera.projection === 'orthographic' &&
      camera.orthographicHeight > 0 &&
      Number.isFinite(camera.orthographicHeight),
    projMatrix,
    viewMatrix,
    canvasViewProjection: Mat4.IDENTITY,
    sceneParams: [
      viewVector[0],
      viewVector[1],
      camera.projection === 'orthographic' ? -1 : 0,
      viewVector[2],
    ],
  };
}

export function sceneUniformsToPickScene(
  uniforms: Camera3DSceneUniforms,
): Mesh3DPickScene {
  if (uniforms.mode === 'linkedPerspective') {
    return {
      mode: 'linkedPerspective',
      projMatrix: uniforms.projMatrix.toFloat32Array(),
      viewMatrix: uniforms.viewMatrix.toFloat32Array(),
      canvasViewProjection: uniforms.canvasViewProjection.toFloat32Array(),
    };
  }
  if (uniforms.mode === 'linkedOrthographic') {
    return {
      mode: 'orthographic2d',
      projMatrix: uniforms.projMatrix.toFloat32Array(),
      viewMatrix: Mat4.IDENTITY.toFloat32Array(),
    };
  }
  return {
    mode: 'standard',
    reverseDepth: uniforms.reverseDepth,
    projMatrix: uniforms.projMatrix.toFloat32Array(),
    viewMatrix: uniforms.viewMatrix.toFloat32Array(),
  };
}

/** Pack scene uniforms into the mesh3d std140 buffer (52 floats). */
export function packSceneUniformBuffer(
  uniforms: Camera3DSceneUniforms,
): Float32Array {
  const buffer = new Float32Array(52);
  buffer.set(uniforms.projMatrix.toFloat32Array(), 0);
  buffer.set(uniforms.viewMatrix.toFloat32Array(), 16);
  buffer.set(uniforms.canvasViewProjection.toFloat32Array(), 32);
  buffer.set(uniforms.sceneParams, 48);
  return buffer;
}
