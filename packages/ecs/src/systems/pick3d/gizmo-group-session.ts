import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../../API';
import { Selected3D, Transform3D } from '../../components';
import { newElementWith } from '../../history/Snapshot';
import { groupMemberPose } from '../../utils/gizmo-group';
import type { GizmoViewportPoint } from '../../utils/gizmo-frame';
import { isEntityAlive } from '../Transform';
import { copyGizmoPose, sameGizmoPose, type GizmoPose } from './gizmo-gesture';
import type { GizmoPointerGesture } from './gizmo-pointer';
import { gizmoDocumentKey } from './gizmo-context';
import { captureGizmoSource, type GizmoSource } from './gizmo-source';

/** Preview and commit a multi-selection as one undoable gizmo gesture. */
export class GizmoGroupSession {
  private readonly members: {
    mesh: Entity;
    initial: GizmoPose;
    binding?: GizmoSource;
    documentKey?: string;
  }[];

  constructor(
    meshes: readonly Entity[],
    private readonly gesture: GizmoPointerGesture,
    private readonly api: API,
    private readonly viewIsCurrent: () => boolean,
  ) {
    this.members = meshes.map((mesh) => {
      const binding = captureGizmoSource(mesh, api);
      const documentKey = binding && gizmoDocumentKey(api, binding.entity);
      Object.assign(mesh.write(Selected3D), {
        dragging: true,
        sourcePreviewOwned: !!binding,
        activeAxis: gesture.axis,
        activePartKind: gesture.kind,
      });
      return {
        mesh,
        initial: copyGizmoPose(mesh.read(Transform3D)),
        binding,
        documentKey,
      };
    });
  }

  valid(): boolean {
    return (
      this.viewIsCurrent() &&
      this.members.every(
        ({ mesh, binding, documentKey }) =>
          isEntityAlive(mesh) &&
          mesh.has(Selected3D) &&
          mesh.has(Transform3D) &&
          (!binding ||
            (binding.owns() &&
              binding.current() &&
              documentKey === gizmoDocumentKey(this.api, binding.entity))),
      )
    );
  }

  update(pointer: GizmoViewportPoint): void {
    if (!this.valid()) return;
    const group = this.gesture.update(pointer);
    if (!group) return;
    const poses = this.members.map(({ initial }) =>
      groupMemberPose(initial, this.gesture.initial, group),
    );
    if (
      this.members.every(({ mesh }, index) =>
        sameGizmoPose(mesh.read(Transform3D), poses[index]),
      )
    )
      return;
    // Resolve every source before mutating any member. A singular parent must
    // not leave half of the group previewed.
    if (
      this.members.some(({ binding }, index) => {
        if (!binding) return false;
        const node = this.api.getNodeByEntity(binding.entity);
        return !node || !binding.patch(poses[index], node);
      })
    )
      return;
    for (let index = 0; index < this.members.length; index++) {
      const { mesh, binding } = this.members[index];
      if (binding && !binding.preview(poses[index])) {
        this.restore();
        return;
      }
      Object.assign(mesh.write(Transform3D), poses[index]);
    }
  }

  private restore(): void {
    for (const { mesh, initial, binding } of this.members) {
      if (isEntityAlive(mesh) && mesh.has(Transform3D))
        Object.assign(mesh.write(Transform3D), copyGizmoPose(initial));
      if (binding) binding.restore(this.api.getNodeByEntity(binding.entity));
    }
  }

  finish(api: API, commit: boolean): void {
    const changed =
      this.valid() &&
      this.members.some(
        ({ mesh, initial }) => !sameGizmoPose(initial, mesh.read(Transform3D)),
      );
    if (!commit || !changed) {
      this.restore();
    } else {
      const updates = new Map<string, ReturnType<typeof newElementWith>>();
      for (const { mesh, binding } of this.members) {
        if (!binding) continue;
        const node = api.getNodeByEntity(binding.entity);
        const patch = node && binding.patch(mesh.read(Transform3D), node);
        if (node && patch) updates.set(node.id, newElementWith(node, patch));
      }
      if (updates.size) {
        api.setNodes(
          api.getNodes().map((node) => updates.get(node.id) ?? node),
        );
        api.record();
      }
    }
    for (const { mesh } of this.members) {
      if (!isEntityAlive(mesh) || !mesh.has(Selected3D)) continue;
      Object.assign(mesh.write(Selected3D), {
        dragging: false,
        sourcePreviewOwned: false,
        activeAxis: 'none',
        activePartKind: null,
        dragHitStart: null,
        dragAngleStart: null,
        initialTranslation: null,
        initialRotation: null,
        initialScale: null,
      });
    }
  }
}
