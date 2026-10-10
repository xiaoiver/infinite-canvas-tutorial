import { System } from '@lastolivegames/becsy';
import {
  Camera,
  ComputedBounds,
  Extrude3D,
  Extrude3DTarget,
  FillLayers,
  Material3D,
  ToBeDeleted,
  Transform3D,
  Canvas,
  Canvas3DScope,
  Children,
  Selected,
  Selected3D,
} from '../components';
import { extrudeMaterialBaseColorFromEntity } from '../utils/extrude3d';
import { resolveExtrudeCompanionTransform } from '../utils/extrude3d-transform';
import { resolveCanvasFromSceneGraph } from '../utils/canvas3d-scope';
import { ensureCompanionGizmoWhenSourceSelected } from '../utils/mesh3d-node';
import { isEntityAlive } from './Transform';
import { syncMaterial3D, syncTransform3D } from '../utils/sync3d';

/**
 * Keeps Extrude3D mesh companions aligned to their rect's canvas-space bounds.
 * Mesh entities are created by {@link EnsureExtrudeMeshes}.
 */
export class SyncExtrude3D extends System {
  private readonly sources = this.query(
    (q) => q.current.with(Extrude3D, ComputedBounds).read,
  );

  private readonly targets = this.query(
    (q) => q.current.with(Extrude3DTarget).read,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(
            Extrude3D,
            Extrude3DTarget,
            ComputedBounds,
            FillLayers,
            Camera,
            Canvas,
            Canvas3DScope,
            Children,
            Selected,
          )
          .read.and.using(Material3D, Transform3D, ToBeDeleted, Selected3D)
          .write,
    );
  }

  execute(): void {
    this.cleanupOrphanMeshes();

    for (const entity of this.sources.current) {
      const extrude = entity.read(Extrude3D);
      const meshEntity = extrude.meshEntity;
      if (!meshEntity || !isEntityAlive(meshEntity)) {
        continue;
      }

      const dragging =
        meshEntity.has(Selected3D) && meshEntity.read(Selected3D).dragging;
      if (!dragging) {
        const pose = resolveExtrudeCompanionTransform(
          entity,
          meshEntity.read(Extrude3DTarget).unifiedSpace,
        );
        if (pose) syncTransform3D(meshEntity, pose);
      }
      const canvas = resolveCanvasFromSceneGraph(entity);
      if (canvas)
        ensureCompanionGizmoWhenSourceSelected(entity, meshEntity, canvas);

      syncMaterial3D(meshEntity, {
        baseColor: extrudeMaterialBaseColorFromEntity(entity),
      });
    }
  }

  private cleanupOrphanMeshes(): void {
    for (const meshEntity of this.targets.current) {
      const { source } = meshEntity.read(Extrude3DTarget);
      if (
        isEntityAlive(source) &&
        source.has(Extrude3D) &&
        source.read(Extrude3D).meshEntity?.isSame(meshEntity)
      ) {
        continue;
      }
      meshEntity.add(ToBeDeleted);
    }
  }
}
