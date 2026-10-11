import type { Entity } from '@lastolivegames/becsy';
import { gizmoDocumentKey } from './gizmo-context';
import type { API } from '../../API';
import { Selected3D, Transform3D } from '../../components';
import { newElementWith } from '../../history/Snapshot';
import { captureGizmoSource, type GizmoSource } from './gizmo-source';
import { isEntityAlive } from '../Transform';
import { copyGizmoPose, sameGizmoPose } from './gizmo-gesture';
import type { GizmoPointerGesture } from './gizmo-pointer';
import type { GizmoViewportPoint } from '../../utils/gizmo-frame';

/** One canvas gesture owns its preview; only finish(true) publishes a document edit. */
export class GizmoSession {
  private readonly binding?: GizmoSource;

  private readonly documentKey?: string;

  constructor(
    readonly mesh: Entity,
    readonly gesture: GizmoPointerGesture,
    private readonly api: API,
    private readonly viewIsCurrent: () => boolean,
  ) {
    this.binding = captureGizmoSource(mesh);
    this.documentKey =
      this.binding && gizmoDocumentKey(api, this.binding.entity);
    const selected = mesh.write(Selected3D);
    selected.dragging = true;
    selected.activeAxis = gesture.axis;
    selected.activePartKind = gesture.kind;
  }

  valid(): boolean {
    return (
      isEntityAlive(this.mesh) &&
      this.mesh.has(Selected3D) &&
      this.mesh.has(Transform3D) &&
      this.viewIsCurrent() &&
      (!this.binding ||
        (this.binding.owns() &&
          this.documentKey === gizmoDocumentKey(this.api, this.binding.entity)))
    );
  }

  update(pointer: GizmoViewportPoint): void {
    const pose = this.gesture.update(pointer);
    if (!pose || sameGizmoPose(pose, this.mesh.read(Transform3D))) return;
    // A singular parent cannot convert a world-space preview back into a document.
    if (this.binding && !this.binding.preview(pose)) return;
    Object.assign(this.mesh.write(Transform3D), pose);
  }

  finish(api: API, commit: boolean): void {
    const valid = this.valid();
    const changed =
      valid &&
      !sameGizmoPose(this.gesture.initial, this.mesh.read(Transform3D));
    if (!commit || !changed) {
      if (isEntityAlive(this.mesh) && this.mesh.has(Transform3D)) {
        Object.assign(
          this.mesh.write(Transform3D),
          copyGizmoPose(this.gesture.initial),
        );
      }
      this.binding?.restore(api.getNodeByEntity(this.binding.entity));
    } else if (this.binding) {
      const node = api.getNodeByEntity(this.binding.entity);
      const patch =
        node && this.binding.patch(this.mesh.read(Transform3D), node);
      if (node && patch) {
        // Publish only the pose; preserve unrelated edits and version metadata.
        const updated = newElementWith(node, patch);
        api.setNodes(
          api.getNodes().map((n) => (n.id === node.id ? updated : n)),
        );
        api.record();
      }
    }
    if (isEntityAlive(this.mesh) && this.mesh.has(Selected3D)) {
      Object.assign(this.mesh.write(Selected3D), {
        dragging: false,
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
