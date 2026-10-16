import { System } from '@lastolivegames/becsy';
import {
  Camera,
  ComputedBounds,
  Extrude3D,
  Extrude3DTarget,
  FillLayers,
  GlobalTransform,
  Material3D,
  Mesh3D,
  Path,
  Rect,
  StrokeLayers,
  ToBeDeleted,
  Transform3D,
  Canvas,
  Canvas3DScope,
  Children,
  Selected,
  Selected3D,
} from '../components';
import {
  extrudeMaterialBaseColorFromEntity,
  extrudeMaterialSideColorFromEntity,
} from '../utils/extrude3d';
import { resolveExtrudeCompanionTransform } from '../utils/extrude3d-transform';
import { resolveCanvasFromSceneGraph } from '../utils/canvas3d-scope';
import { ensureCompanionGizmoWhenSourceSelected } from '../utils/mesh3d-node';
import { isEntityAlive } from './Transform';
import { syncMaterial3D, syncTransform3D } from '../utils/sync3d';
import { pathExtrusionGeometry } from '../utils/path-extrusion-source';
import { rectExtrusionGeometry } from '../utils/rect-extrusion-source';

/**
 * Keeps Extrude3D mesh companions aligned to their 2D sources.
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
            GlobalTransform,
            Path,
            Rect,
            StrokeLayers,
            Camera,
            Canvas,
            Canvas3DScope,
            Children,
            Selected,
          )
          .read.and.using(
            Material3D,
            Mesh3D,
            Transform3D,
            ToBeDeleted,
            Selected3D,
            Extrude3D,
          ).write,
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

      const geometry = entity.has(Path)
        ? pathExtrusionGeometry(entity)?.geometry
        : rectExtrusionGeometry(entity);
      if (!geometry) {
        meshEntity.add(ToBeDeleted);
        entity.write(Extrude3D).meshEntity = undefined;
        continue;
      }
      if (
        meshEntity.read(Mesh3D).positions !== geometry.positions ||
        meshEntity.read(Mesh3D).indices !== geometry.indices
      ) {
        Object.assign(meshEntity.write(Mesh3D), {
          positions: geometry.positions,
          normals: geometry.normals,
          uvs: geometry.uvs ?? null,
          indices: geometry.indices,
        });
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
        sideColor: extrudeMaterialSideColorFromEntity(entity),
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
