import type { Entity } from '@lastolivegames/becsy';
import {
  Extrude3D,
  Extrude3DTarget,
  Mesh3DNode,
  Mesh3DNodeTarget,
  Transform,
  Transform3D,
} from '../../components';
import type { SerializedNode } from '../../types/serialized-node';
import { resolveMesh3DNodeSourceTransform } from '../../utils/mesh3d-node';
import { mesh3DNodeFromWire } from '../../utils/mesh3d-wire';
import { extrude3DFromWire, extrude3DToWire } from '../../utils/extrude3d';
import { resolveExtrudeSourceTransform } from '../../utils/extrude3d-transform';
import { isEntityAlive } from '../Transform';
import type { GizmoPose } from './gizmo-gesture';
import type { API } from '../../API';
import { GizmoSourceFrame } from './gizmo-source-frame';

/** Source-specific conversion and rollback, independent of pointer/history policy. */
export interface GizmoSource {
  entity: Entity;
  owns(): boolean;
  current(): boolean;
  preview(pose: GizmoPose): boolean;
  restore(currentNode?: SerializedNode): void;
  patch(
    pose: GizmoPose,
    node: SerializedNode,
  ): Partial<SerializedNode> | undefined;
}
export function captureGizmoSource(
  mesh: Entity,
  api?: Pick<API, 'getNodeByEntity'>,
): GizmoSource | undefined {
  const extrusion = mesh.has(Extrude3DTarget);
  if (!extrusion && !mesh.has(Mesh3DNodeTarget)) return;
  const target = extrusion
    ? mesh.read(Extrude3DTarget)
    : mesh.read(Mesh3DNodeTarget);
  const source = target.source;
  if (!isEntityAlive(source) || !source.has(Transform)) return;
  const entity = source.hold();
  const owns = () =>
    isEntityAlive(entity) &&
    (extrusion
      ? entity.has(Extrude3D) &&
        !!entity.read(Extrude3D).meshEntity?.isSame(mesh)
      : entity.has(Mesh3DNode) &&
        !!entity.read(Mesh3DNode).meshEntity?.isSame(mesh));
  if (!owns()) return;
  const frame = new GizmoSourceFrame(entity, api?.getNodeByEntity(entity));
  if (extrusion) {
    const { depth, z, rotation, bevelSize } = entity.read(Extrude3D);
    const initialMeshScale = [...mesh.read(Transform3D).scale];
    const initial = {
      depth,
      z,
      bevelSize,
      rotation: [...rotation] as [number, number, number],
    };
    const unifiedSpace = mesh.read(Extrude3DTarget).unifiedSpace;
    const resolve = (pose: GizmoPose) =>
      resolveExtrudeSourceTransform(entity, pose, unifiedSpace);
    return {
      entity,
      owns,
      current: () => frame.current(),
      preview(pose) {
        const patch = resolve(pose);
        if (!patch) return false;
        Object.assign(entity.write(Transform).translation, {
          x: patch.x,
          y: patch.y,
        });
        Object.assign(entity.write(Extrude3D), patch.extrude);
        frame.acceptPreview();
        return true;
      },
      restore(currentNode) {
        if (currentNode) {
          // Preserve newer document edits and computed layout coordinates.
          if (
            !isEntityAlive(entity) ||
            !entity.has(Transform) ||
            (currentNode?.type !== 'rect' && currentNode?.type !== 'path')
          )
            return;
          frame.restoreOrigin(currentNode);
          const extrude = extrude3DFromWire(currentNode.extrude3d);
          if (extrude && entity.has(Extrude3D))
            Object.assign(entity.write(Extrude3D), extrude);
          return;
        }
        if (!owns()) return;
        frame.restoreOrigin();
        Object.assign(entity.write(Extrude3D), initial);
      },
      patch(pose, node) {
        // Depth can be edited independently; XY determines uniform source scaling.
        const factor = pose.scale[0] / initialMeshScale[0];
        const patch = resolveExtrudeSourceTransform(
          entity,
          pose,
          unifiedSpace,
          factor,
        );
        if (!patch || (node.type !== 'rect' && node.type !== 'path')) return;
        return {
          x: patch.x,
          y: patch.y,
          ...(Math.abs(factor - 1) > 1e-7
            ? {
                scaleX: (node.scaleX ?? 1) * factor,
                scaleY: (node.scaleY ?? 1) * factor,
              }
            : {}),
          extrude3d: extrude3DToWire(
            { ...patch.extrude, bevelSize: initial.bevelSize * factor },
            node.extrude3d,
          ),
        };
      },
    };
  }
  const { z, rotation3d, scale3d } = entity.read(Mesh3DNode);
  const initial = {
    z,
    rotation3d: [...rotation3d],
    scale3d: typeof scale3d === 'number' ? scale3d : [...scale3d],
  };
  return {
    entity,
    owns,
    current: () => frame.current(),
    preview(pose) {
      const patch = resolveMesh3DNodeSourceTransform(entity, pose);
      if (!patch) return false;
      const { x, y, ...fields } = patch;
      Object.assign(entity.write(Transform).translation, { x, y });
      Object.assign(entity.write(Mesh3DNode), fields);
      frame.acceptPreview();
      return true;
    },
    restore(currentNode) {
      if (
        !isEntityAlive(entity) ||
        !entity.has(Transform) ||
        !entity.has(Mesh3DNode)
      )
        return;
      if (currentNode?.type === 'mesh3d') {
        const { z, rotation3d, scale3d } = mesh3DNodeFromWire(currentNode);
        frame.restoreOrigin(currentNode);
        Object.assign(entity.write(Mesh3DNode), { z, rotation3d, scale3d });
      } else if (owns()) {
        frame.restoreOrigin();
        Object.assign(entity.write(Mesh3DNode), initial);
      }
    },
    patch: (pose, node) =>
      node.type === 'mesh3d'
        ? resolveMesh3DNodeSourceTransform(entity, pose)
        : undefined,
  };
}
