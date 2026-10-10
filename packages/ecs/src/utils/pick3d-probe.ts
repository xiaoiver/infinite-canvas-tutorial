import type { Entity } from '@lastolivegames/becsy';
import { Camera3D, Mesh3D, Transform3D } from '../components';
import type { GizmoAxis } from '../components/geometry3d/Selected3D';
import { Selected3D } from '../components/geometry3d/Selected3D';
import {
  buildCamera3DSceneUniforms,
  sceneUniformsToPickScene,
} from './mesh3d-scene';
import {
  computeModelMatrix,
  pickMeshAtViewport,
  type Mesh3DPickScene,
  type RayHitResult,
} from './ray-casting';
import { createGizmoFrame, type GizmoFrame } from './gizmo-frame';
import { type GizmoPartKind } from './gizmo-geometry';
import {
  buildGizmoModelMatrix,
  getGizmoMeshParts,
  gizmoPartUsesLinkedZScreenBias,
  gizmoPartDrawLayer,
} from './gizmo-interaction';

export type Pick3DProbeResult =
  | { kind: 'none' }
  | { kind: 'mesh'; entity: Entity; hit: RayHitResult }
  | {
      kind: 'gizmo';
      entity: Entity;
      axis: GizmoAxis;
      partKind: GizmoPartKind;
      frame: GizmoFrame;
      hit: RayHitResult;
    };

export function buildPickSceneForViewport(
  camera: Camera3D,
  viewportWidth: number,
  viewportHeight: number,
  logicalWidth: number,
  logicalHeight: number,
  cam2d?: Entity,
): Mesh3DPickScene | null {
  const aspect =
    camera.linked && logicalWidth > 0 && logicalHeight > 0
      ? logicalWidth / logicalHeight
      : viewportWidth / viewportHeight;

  return sceneUniformsToPickScene(
    buildCamera3DSceneUniforms(camera, aspect, cam2d),
  );
}

/**
 * Screen-space 3D pick (gizmo handles first, then meshes). Shared by Pick3D and Select.
 */
export function probePick3DAtViewport(
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  _camera: Camera3D,
  pickScene: Mesh3DPickScene,
  meshes: readonly Entity[],
  selected: readonly Entity[],
): Pick3DProbeResult {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { kind: 'none' };
  }

  for (const entity of selected) {
    if (!entity.has(Transform3D) || !entity.has(Selected3D)) continue;
    const transform = entity.read(Transform3D);
    const hit = hitTestGizmoPart(
      viewportX,
      viewportY,
      viewportWidth,
      viewportHeight,
      pickScene,
      transform.translation,
      transform.rotation,
    );
    if (hit) {
      return { kind: 'gizmo', entity, ...hit };
    }
  }

  let closestHit: RayHitResult | null = null;
  let closestEntity: Entity | null = null;

  for (const entity of meshes) {
    const mesh = entity.read(Mesh3D);
    const transform = entity.read(Transform3D);
    const modelMatrix = computeModelMatrix(
      transform.translation,
      transform.rotation,
      transform.scale,
    );
    const anchor: [number, number, number] = [
      transform.translation[0],
      transform.translation[1],
      transform.translation[2],
    ];
    const hit = pickMeshAtViewport(
      viewportX,
      viewportY,
      viewportWidth,
      viewportHeight,
      mesh.positions,
      mesh.indices,
      modelMatrix,
      anchor,
      pickScene,
    );
    if (hit && (!closestHit || hit.t < closestHit.t)) {
      closestHit = hit;
      closestEntity = entity;
    }
  }

  if (closestEntity && closestHit) {
    return { kind: 'mesh', entity: closestEntity, hit: closestHit };
  }

  return { kind: 'none' };
}

function hitTestGizmoPart(
  vx: number,
  vy: number,
  viewportWidth: number,
  viewportHeight: number,
  pickScene: Mesh3DPickScene,
  translation: [number, number, number],
  rotation: [number, number, number],
): {
  axis: GizmoAxis;
  partKind: GizmoPartKind;
  frame: GizmoFrame;
  hit: RayHitResult;
} | null {
  const frame = createGizmoFrame(
    pickScene,
    translation,
    viewportWidth,
    viewportHeight,
  );
  if (!frame) return null;
  const { scale, anchor, zBias: linkedZBias } = frame;
  // Reverse painter order: the visually topmost handle must receive the press.
  const parts = [...getGizmoMeshParts()]
    .sort(
      (a, b) =>
        gizmoPartDrawLayer(a.kind, a.axis) - gizmoPartDrawLayer(b.kind, b.axis),
    )
    .reverse();

  for (const part of parts) {
    const gizmoModel = buildGizmoModelMatrix(
      translation,
      rotation,
      scale,
      part.kind,
    );
    const zBias = gizmoPartUsesLinkedZScreenBias(part.kind, part.axis)
      ? linkedZBias
      : undefined;
    const hit = pickMeshAtViewport(
      vx,
      vy,
      viewportWidth,
      viewportHeight,
      part.positions,
      part.indices,
      gizmoModel as unknown as Float32Array,
      anchor,
      pickScene,
      zBias,
    );
    if (hit) return { axis: part.axis, partKind: part.kind, frame, hit };
  }

  return null;
}
