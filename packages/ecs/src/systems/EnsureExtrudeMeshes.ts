import { Entity, System } from '@lastolivegames/becsy';
import { Commands } from '../commands';
import {
  Camera3D,
  ComputedBounds,
  Extrude3D,
  Extrude3DTarget,
  Material3D,
  Mesh3D,
  ToBeDeleted,
  Transform3D,
} from '../components';
import { createUnitCubeGeometry } from '../utils/extrude3d-geometry';
import { isEntityAlive } from './Transform';

const unitCube = createUnitCubeGeometry();

/**
 * Creates companion meshes when Extrude3D is added or changed.
 * {@link SyncExtrude3D} updates transforms each frame after bounds are computed.
 */
export class EnsureExtrudeMeshes extends System {
  private readonly commands = new Commands(this);

  private readonly sources = this.query((q) =>
    q.addedOrChanged.with(Extrude3D).trackWrites,
  );

  /** Retries spawn when bounds were not ready on the Extrude3D insert frame. */
  private readonly pendingMeshes = this.query((q) =>
    q.current.with(Extrude3D, ComputedBounds).read,
  );

  private readonly cameras3D = this.query((q) => q.current.with(Camera3D).read);

  constructor() {
    super();
    this.query((q) =>
      q
        .using(ComputedBounds)
        .read.and.using(Camera3D, Extrude3DTarget, Extrude3D, Mesh3D, Material3D, Transform3D,)
        .write,
    );
  }

  execute(): void {
    const pending: { source: Entity; mesh: Entity }[] = [];
    const queuedSources = new Set<Entity>();

    const trySpawn = (entity: Entity) => {
      if (queuedSources.has(entity)) {
        return;
      }
      if (!entity.has(ComputedBounds)) {
        return;
      }
      const extrude = entity.read(Extrude3D);
      if (extrude.meshEntity && isEntityAlive(extrude.meshEntity)) {
        return;
      }
      queuedSources.add(entity);
      pending.push({
        source: entity,
        mesh: this.queueSpawnMesh(entity),
      });
    };

    for (const entity of this.sources.addedOrChanged) {
      trySpawn(entity);
    }

    for (const entity of this.pendingMeshes.current) {
      trySpawn(entity);
    }

    if (pending.length > 0) {
      this.commands.execute();
      for (const { source, mesh } of pending) {
        const extrude = source.write(Extrude3D);
        const prev = extrude.meshEntity;
        if (prev && isEntityAlive(prev) && prev !== mesh) {
          prev.add(ToBeDeleted);
        }
        extrude.meshEntity = mesh.hold();
      }
    }

    if (pending.length > 0) {
      const hasLinked = this.cameras3D.current.some((e) => e.read(Camera3D).linked);
      if (!hasLinked) {
        this.commands.spawn(
          new Camera3D({
            linked: true,
            projection: 'orthographic',
            clearColor: false,
          }),
        );
        this.commands.execute();
      }
    }
  }

  /** Queue mesh spawn; assign {@link Extrude3D.meshEntity} only after {@link Commands.execute}. */
  private queueSpawnMesh(source: Entity): Entity {
    return this.commands
      .spawn(
        new Mesh3D({
          positions: unitCube.positions,
          normals: unitCube.normals,
          indices: unitCube.indices,
        }),
        new Material3D({
          baseColor: [0.25, 0.55, 0.95, 1],
          ambient: 0.15,
          diffuse: 0.75,
          specular: 0.4,
          shininess: 48,
        }),
        new Transform3D(),
        new Extrude3DTarget({ source }),
      )
      .id();
  }
}
