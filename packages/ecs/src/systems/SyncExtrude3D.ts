import { System } from '@lastolivegames/becsy';
import {
  Camera3D,
  ComputedBounds,
  Extrude3D,
  Extrude3DTarget,
  FillLayers,
  Material3D,
  ToBeDeleted,
  Transform3D,
  canvasWorldToWorld3D,
} from '../components';
import { extrudeMaterialBaseColorFromEntity } from '../utils/extrude3d';
import { isEntityAlive } from './Transform';

/**
 * Keeps Extrude3D mesh companions aligned to their rect's canvas-space bounds.
 * Mesh entities are created by {@link EnsureExtrudeMeshes}.
 */
export class SyncExtrude3D extends System {
  private readonly sources = this.query((q) =>
    q.current.with(Extrude3D, ComputedBounds).read,
  );

  private readonly targets = this.query((q) =>
    q.current.with(Extrude3DTarget).read,
  );

  private readonly cameras3D = this.query((q) => q.current.with(Camera3D).read);

  constructor() {
    super();
    this.query((q) =>
      q
        .using(
          Camera3D,
          Extrude3D,
          Extrude3DTarget,
          ComputedBounds,
          FillLayers,
          Material3D,
          Transform3D,
          ToBeDeleted,
        )
        .read.write,
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

      const bounds = entity.read(ComputedBounds).geometryWorldBounds;
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      if (width <= 0 || height <= 0) {
        continue;
      }

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const depth = extrude.depth;
      const rotation = entity.read(ComputedBounds).transformOBB.rotation;
      const linked3D = this.cameras3D.current.some((e) => e.read(Camera3D).linked);

      const transform = meshEntity.write(Transform3D);
      transform.translation = linked3D
        ? [centerX, centerY, -depth / 2]
        : canvasWorldToWorld3D(centerX, centerY, -depth / 2);
      transform.rotation = [0, 0, rotation];
      transform.scale = [width, height, depth];

      meshEntity.write(Material3D).baseColor =
        extrudeMaterialBaseColorFromEntity(entity);
    }
  }

  private cleanupOrphanMeshes(): void {
    for (const meshEntity of this.targets.current) {
      const { source } = meshEntity.read(Extrude3DTarget);
      if (isEntityAlive(source) && source.has(Extrude3D)) {
        continue;
      }
      meshEntity.add(ToBeDeleted);
    }
  }
}
