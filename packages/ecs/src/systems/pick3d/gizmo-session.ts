import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../../API';
import {
  Mesh3DNode,
  Mesh3DNodeTarget,
  Selected3D,
  Transform,
  Transform3D,
} from '../../components';
import { newElementWith } from '../../history/Snapshot';
import {
  resolveMesh3DNodeSourceTransform,
  syncMesh3DNodeSourceFromCompanion,
} from '../../utils/mesh3d-node';
import { isEntityAlive } from '../Transform';
import { copyGizmoPose, sameGizmoPose } from './gizmo-gesture';
import type { GizmoPointerGesture } from './gizmo-pointer';
import type { GizmoViewportPoint } from '../../utils/gizmo-frame';

/** One canvas gesture owns its preview; only finish(true) publishes a document edit. */
export class GizmoSession {
  readonly source?: Entity;
  private readonly sourceStart?: ReturnType<
    typeof resolveMesh3DNodeSourceTransform
  >;

  constructor(readonly mesh: Entity, readonly gesture: GizmoPointerGesture) {
    if (mesh.has(Mesh3DNodeTarget)) {
      this.source = mesh.read(Mesh3DNodeTarget).source.hold();
      if (this.source.has(Transform) && this.source.has(Mesh3DNode)) {
        const { x, y } = this.source.read(Transform).translation;
        const { z, rotation3d, scale3d } = this.source.read(Mesh3DNode);
        this.sourceStart = {
          x,
          y,
          z,
          rotation3d: [...rotation3d],
          scale3d: typeof scale3d === 'number' ? scale3d : [...scale3d],
        };
      }
    }
    const selected = mesh.write(Selected3D);
    selected.dragging = true;
    selected.activeAxis = gesture.axis;
    selected.activePartKind = gesture.kind;
  }

  private ownsSource(): boolean {
    return (
      !this.source ||
      (isEntityAlive(this.source) &&
        this.source.has(Mesh3DNode) &&
        !!this.source.read(Mesh3DNode).meshEntity?.isSame(this.mesh))
    );
  }

  valid(): boolean {
    return (
      isEntityAlive(this.mesh) &&
      this.mesh.has(Selected3D) &&
      this.mesh.has(Transform3D) &&
      this.ownsSource()
    );
  }

  update(pointer: GizmoViewportPoint): void {
    const pose = this.gesture.update(pointer);
    if (!pose || sameGizmoPose(pose, this.mesh.read(Transform3D))) return;
    // A singular parent cannot convert a world-space preview back into a document.
    if (this.source && !resolveMesh3DNodeSourceTransform(this.source, pose))
      return;
    Object.assign(this.mesh.write(Transform3D), pose);
    if (this.source) syncMesh3DNodeSourceFromCompanion(this.source, this.mesh);
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
      // Never restore through a stale backlink after a document/entity replacement.
      if (this.ownsSource() && this.source && this.sourceStart) {
        const { x, y, ...pose } = this.sourceStart;
        Object.assign(this.source.write(Mesh3DNode), pose);
        Object.assign(this.source.write(Transform).translation, { x, y });
      }
    } else if (this.source) {
      const node = api.getNodeByEntity(this.source);
      const patch = resolveMesh3DNodeSourceTransform(
        this.source,
        this.mesh.read(Transform3D),
      );
      if (node?.type === 'mesh3d' && patch) {
        // The ECS preview is already applied. Publish only the pose, preserving
        // material/name edits and version metadata through the normal history path.
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
