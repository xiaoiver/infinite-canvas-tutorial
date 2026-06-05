import { System } from '@lastolivegames/becsy';
import {
  ComputedBounds,
  Material3D,
  Mesh3DNode,
  Mesh3DNodeTarget,
  Rect,
  Selected,
  Selected3D,
  ToBeDeleted,
  Transform,
  Transform3D,
} from '../components';
import { resolveCanvasFromSceneGraph } from '../utils/canvas3d-scope';
import {
  syncMesh3DNodeCompanionFromSource,
  ensureCompanionGizmoWhenSourceSelected,
} from '../utils/mesh3d-node';
import { isEntityAlive } from './Transform';

/**
 * Keeps {@link Mesh3DNode} companion meshes aligned to their node's canvas-space placement.
 */
export class SyncMesh3DNodes extends System {
  private readonly sources = this.query((q) => q.current.with(Mesh3DNode).read);

  private readonly targets = this.query((q) =>
    q.current.with(Mesh3DNodeTarget).read,
  );

  constructor() {
    super();
    this.query((q) =>
      q
        .using(ComputedBounds, Transform, Rect, Material3D, Transform3D, Selected)
        .read.and.using(Mesh3DNode, Mesh3DNodeTarget, ToBeDeleted, Selected3D)
        .read.write,
    );
  }

  execute(): void {
    this.cleanupOrphanMeshes();

    for (const entity of this.sources.current) {
      const node = entity.read(Mesh3DNode);
      const meshEntity = node.meshEntity;
      if (!meshEntity || !isEntityAlive(meshEntity)) {
        continue;
      }

      syncMesh3DNodeCompanionFromSource(entity, meshEntity);
      const canvas = resolveCanvasFromSceneGraph(entity);
      if (canvas) {
        ensureCompanionGizmoWhenSourceSelected(entity, meshEntity, canvas);
      }
    }
  }

  private cleanupOrphanMeshes(): void {
    for (const meshEntity of this.targets.current) {
      if (!isEntityAlive(meshEntity)) {
        continue;
      }
      const { source } = meshEntity.read(Mesh3DNodeTarget);
      if (
        isEntityAlive(source) &&
        source.has(Mesh3DNode) &&
        source.read(Mesh3DNode).meshEntity === meshEntity
      ) {
        continue;
      }
      meshEntity.add(ToBeDeleted);
    }
  }
}
