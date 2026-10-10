import { mat4 } from 'gl-matrix';
import type { GizmoAxis } from '../../components/geometry3d/Selected3D';
import { Mat4 } from '../../components/math/Mat4';
import type { GizmoFrame } from '../../utils/gizmo-frame';
import type { GizmoMeshData, GizmoPartKind } from '../../utils/gizmo-geometry';
import {
  buildGizmoModelMatrix,
  gizmoPartUsesLinkedZScreenBias,
} from '../../utils/gizmo-interaction';
import {
  packSceneUniformBuffer,
  type Camera3DSceneUniforms,
} from '../../utils/mesh3d-scene';

export const GIZMO_UNIFORM_FLOATS = 52;

/** A selected object, captured without retaining ECS component views. */
export interface GizmoDrawInstance {
  id: number;
  frame: GizmoFrame;
  scene: Camera3DSceneUniforms;
  rotation: [number, number, number];
  activeAxis: GizmoAxis;
  activePartKind: GizmoPartKind | null;
}

/** WebGL1 uniforms and std140 buffers describe exactly the same draw. */
export function buildGizmoUniforms(
  instance: GizmoDrawInstance,
  part: GizmoMeshData,
) {
  const { frame, scene, rotation, activeAxis, activePartKind } = instance;
  const translation = frame.anchor;
  const model = buildGizmoModelMatrix(
    translation,
    rotation,
    frame.scale,
    part.kind,
  );
  const normal = mat4.transpose(
    mat4.create(),
    mat4.invert(mat4.create(), model)!,
  );
  const lightParams = [
    1,
    gizmoPartUsesLinkedZScreenBias(part.kind, part.axis) ? 1 : 0,
    0,
    0,
  ];
  const lightDirection = [-0.5, -0.7, -0.5, 0];
  const anchor = [...translation, 0];
  const sceneParams: [number, number, number, number] = frame.zBias
    ? [...frame.zBias, 1, 0]
    : [...scene.sceneParams];
  sceneParams[3] =
    activeAxis === part.axis && activePartKind === part.kind ? 1 : 0;

  const sceneBuffer = packSceneUniformBuffer({ ...scene, sceneParams });
  const modelBuffer = new Float32Array(GIZMO_UNIFORM_FLOATS);
  modelBuffer.set(model, 0);
  modelBuffer.set(normal, 16);
  modelBuffer.set(part.color, 32);
  modelBuffer.set(lightParams, 36);
  modelBuffer.set(lightDirection, 40);
  modelBuffer.set(anchor, 44);
  return {
    sceneBuffer,
    modelBuffer,
    legacy: {
      u_ProjectionMatrix3D: Mat4.toGLMat4(scene.projMatrix),
      u_ViewMatrix3D: Mat4.toGLMat4(scene.viewMatrix),
      u_CanvasViewProjection3D: Mat4.toGLMat4(scene.canvasViewProjection),
      u_SceneParams: sceneParams,
      u_ModelMatrix3D: model,
      u_NormalMatrix3D: normal,
      u_BaseColor: part.color,
      u_LightParams: lightParams,
      u_LightDirection: lightDirection,
      u_CanvasAnchor: anchor,
    },
  };
}
