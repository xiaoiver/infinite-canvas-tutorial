import { System } from '@lastolivegames/becsy';
import { Commands } from '../commands';
import {
  Camera,
  Canvas,
  Canvas3DScope,
  Children,
  ComputedBounds,
  GlobalTransform,
  Material3D,
  Mesh3D,
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
  syncMesh3DNodeSourceFromCompanion,
  ensureCompanionGizmoWhenSourceSelected,
  getMesh3DNodeParts,
  syncMesh3DNodeParts,
  takeMesh3DNodeParts,
  setMesh3DNodeParts,
} from '../utils/mesh3d-node';
import { isEntityAlive } from './Transform';

/**
 * Keeps {@link Mesh3DNode} companion meshes aligned to their node's canvas-space placement.
 */
export class SyncMesh3DNodes extends System {
  private readonly commands = new Commands(this);
  private readonly sources = this.query((q) => q.current.with(Mesh3DNode).read);

  private readonly targets = this.query(
    (q) => q.current.with(Mesh3DNodeTarget).read,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(
            Camera,
            Canvas,
            Children,
            ComputedBounds,
            GlobalTransform,
            Rect,
            Selected,
          )
          .read.and.using(
            Mesh3DNode,
            Mesh3D,
            Canvas3DScope,
            Mesh3DNodeTarget,
            Transform,
            Material3D,
            Transform3D,
            ToBeDeleted,
            Selected3D,
          ).write,
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

      const staged = takeMesh3DNodeParts(entity);
      if (staged) {
        const canvas = meshEntity.read(Canvas3DScope).canvas;
        const spawned = staged.map((part) => ({
          entity: this.commands
            .spawn(
              new Mesh3D({
                positions: part.positions,
                normals: part.normals,
                tangents: part.tangents ?? null,
                colors: part.colors ?? null,
                indices: part.indices,
                uvs: part.uvs ?? null,
                uvs1: part.uvs1 ?? null,
              }),
              new Material3D(),
              new Transform3D(),
              new Mesh3DNodeTarget({ source: entity.hold() }),
              new Canvas3DScope({ canvas }),
            )
            .id()
            .hold(),
          material: part,
        }));
        if (spawned.length) this.commands.execute();
        setMesh3DNodeParts(entity, spawned);
      }

      const dragging =
        meshEntity.has(Selected3D) && meshEntity.read(Selected3D).dragging;

      if (dragging) {
        // Pointer sessions already write their source atomically. Repeating
        // that conversion here would overwrite an intervening Yoga layout.
        // Keep reverse sync for integrations driving the companion directly.
        if (!meshEntity.read(Selected3D).sourcePreviewOwned)
          syncMesh3DNodeSourceFromCompanion(entity, meshEntity);
      } else {
        syncMesh3DNodeCompanionFromSource(entity, meshEntity);
      }
      syncMesh3DNodeParts(entity);
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
        (source.read(Mesh3DNode).meshEntity?.isSame(meshEntity) ||
          getMesh3DNodeParts(source).some((part) => part.isSame(meshEntity)))
      ) {
        continue;
      }
      if (!meshEntity.has(ToBeDeleted)) meshEntity.add(ToBeDeleted);
    }
  }
}
