import type { Entity } from '@lastolivegames/becsy';
import {
  Camera3D,
  Mesh3D,
  Transform3D,
} from '../components';
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
import { computeLinkedPerspectiveZGizmoScreenBias } from './gizmo-projection';
import {
  computeGizmoScale,
  GIZMO_AXIS_ARROW_LENGTH,
  GIZMO_ROTATE_RING_RADIUS,
  type GizmoPartKind,
} from './gizmo-geometry';
import {
  buildGizmoModelMatrix,
  getGizmoMeshParts,
  gizmoPartUsesLinkedZScreenBias,
} from './gizmo-interaction';

export type Pick3DProbeResult =
  | { kind: 'none' }
  | { kind: 'mesh'; entity: Entity; hit: RayHitResult }
  | {
    kind: 'gizmo';
    entity: Entity;
    axis: GizmoAxis;
    partKind: GizmoPartKind;
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
  camera: Camera3D,
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
      camera,
      pickScene,
      transform.translation,
      transform.rotation,
    );
    if (hit) {
      return { kind: 'gizmo', entity, axis: hit.axis, partKind: hit.partKind };
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
  camera: Camera3D,
  pickScene: Mesh3DPickScene,
  translation: [number, number, number],
  rotation: [number, number, number],
): { axis: GizmoAxis; partKind: GizmoPartKind } | null {
  const scale = computeGizmoScale(
    camera.eye,
    translation,
    camera.fovy,
    viewportHeight,
    150,
    camera.linked,
  );

  const anchor: [number, number, number] = [
    translation[0],
    translation[1],
    translation[2],
  ];

  const linkedZBias =
    pickScene.mode === 'linkedPerspective'
      ? computeLinkedPerspectiveZGizmoScreenBias(
        anchor,
        scale * Math.max(GIZMO_AXIS_ARROW_LENGTH, GIZMO_ROTATE_RING_RADIUS * 2),
        pickScene,
      )
      : undefined;

  let closest: { axis: GizmoAxis; partKind: GizmoPartKind; t: number } | null =
    null;

  for (const part of getGizmoMeshParts()) {
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
    if (hit && (!closest || hit.t < closest.t)) {
      closest = { axis: part.axis, partKind: part.kind, t: hit.t };
    }
  }

  return closest
    ? { axis: closest.axis, partKind: closest.partKind }
    : null;
}
