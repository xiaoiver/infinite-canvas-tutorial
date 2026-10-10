import type { Entity } from '@lastolivegames/becsy';
import {
  Extrude3D,
  Extrude3DTarget,
  Mesh3DNode,
  Mesh3DNodeTarget,
  Transform,
} from '../../components';
import type { SerializedNode } from '../../types/serialized-node';
import { resolveMesh3DNodeSourceTransform } from '../../utils/mesh3d-node';
import { extrude3DFromWire, extrude3DToWire } from '../../utils/extrude3d';
import { resolveExtrudeSourceTransform } from '../../utils/extrude3d-transform';
import { isEntityAlive } from '../Transform';
import type { GizmoPose } from './gizmo-gesture';

/** Source-specific conversion and rollback, independent of pointer/history policy. */
export interface GizmoSource {
  entity: Entity;
  owns(): boolean;
  preview(pose: GizmoPose): boolean;
  restore(currentNode?: SerializedNode): void;
  patch(
    pose: GizmoPose,
    node: SerializedNode,
  ): Partial<SerializedNode> | undefined;
}
export function captureGizmoSource(mesh: Entity): GizmoSource | undefined {
  const extrusion = mesh.has(Extrude3DTarget);
  if (!extrusion && !mesh.has(Mesh3DNodeTarget)) return;
  const target = extrusion
    ? mesh.read(Extrude3DTarget)
    : mesh.read(Mesh3DNodeTarget);
  const source = target.source;
  if (!isEntityAlive(source) || !source.has(Transform)) return;
  const entity = source.hold();
  const { x, y } = entity.read(Transform).translation;
  const origin = { x, y };
  const owns = () =>
    isEntityAlive(entity) &&
    (extrusion
      ? entity.has(Extrude3D) &&
        !!entity.read(Extrude3D).meshEntity?.isSame(mesh)
      : entity.has(Mesh3DNode) &&
        !!entity.read(Mesh3DNode).meshEntity?.isSame(mesh));
  if (!owns()) return;
  if (extrusion) {
    const { depth, z, rotation } = entity.read(Extrude3D);
    const initial = {
      depth,
      z,
      rotation: [...rotation] as [number, number, number],
    };
    const unifiedSpace = mesh.read(Extrude3DTarget).unifiedSpace;
    const resolve = (pose: GizmoPose) =>
      resolveExtrudeSourceTransform(entity, pose, unifiedSpace);
    return {
      entity,
      owns,
      preview(pose) {
        const patch = resolve(pose);
        if (!patch) return false;
        Object.assign(entity.write(Transform).translation, {
          x: patch.x,
          y: patch.y,
        });
        Object.assign(entity.write(Extrude3D), patch.extrude);
        return true;
      },
      restore(currentNode) {
        if (!owns()) {
          // Disabling extrusion or replacing the companion invalidates this
          // preview. Restore the current document, never its stale start pose.
          if (
            !isEntityAlive(entity) ||
            !entity.has(Transform) ||
            currentNode?.type !== 'rect'
          )
            return;
          Object.assign(entity.write(Transform).translation, {
            x: currentNode.x ?? 0,
            y: currentNode.y ?? 0,
          });
          const extrude = extrude3DFromWire(currentNode.extrude3d);
          if (extrude && entity.has(Extrude3D))
            Object.assign(entity.write(Extrude3D), extrude);
          return;
        }
        Object.assign(entity.write(Transform).translation, origin);
        Object.assign(entity.write(Extrude3D), initial);
      },
      patch(pose, node) {
        const patch = resolve(pose);
        if (!patch || node.type !== 'rect') return;
        return {
          x: patch.x,
          y: patch.y,
          extrude3d: extrude3DToWire(patch.extrude, node.extrude3d),
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
    preview(pose) {
      const patch = resolveMesh3DNodeSourceTransform(entity, pose);
      if (!patch) return false;
      const { x, y, ...fields } = patch;
      Object.assign(entity.write(Transform).translation, { x, y });
      Object.assign(entity.write(Mesh3DNode), fields);
      return true;
    },
    restore() {
      if (!owns()) return;
      Object.assign(entity.write(Transform).translation, origin);
      Object.assign(entity.write(Mesh3DNode), initial);
    },
    patch: (pose, node) =>
      node.type === 'mesh3d'
        ? resolveMesh3DNodeSourceTransform(entity, pose)
        : undefined,
  };
}
