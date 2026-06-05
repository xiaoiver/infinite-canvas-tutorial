import { Entity, System } from '@lastolivegames/becsy';
import { Commands } from '../commands';
import {
  Camera3D,
  Canvas,
  Camera,
  Canvas3DScope,
  Children,
  ComputedBounds,
  Mesh3D,
  Mesh3DNode,
  Mesh3DNodeTarget,
  ToBeDeleted,
  Light3D,
  Material3D,
  Transform3D,
  FractionalIndex,
  Flex,
  Rect,
  Transform,
  Selected,
  Selected3D,
} from '../components';
import {
  findCamera3DForCanvas,
  resolveCanvasFromSceneGraph,
} from '../utils/canvas3d-scope';
import {
  queueMesh3DCompanion,
  queueCamera3DFromMesh3DNode,
} from '../utils/mesh3d-companion';
import { requestGltfMeshLoad } from '../utils/gltf/request-gltf-mesh-load';
import { syncMesh3DNodeCompanionFromSource, ensureCompanionGizmoWhenSourceSelected, rebuildMesh3DNodeCompanionGeometry } from '../utils/mesh3d-node';
import { isEntityAlive } from './Transform';

/**
 * Creates companion meshes when {@link Mesh3DNode} is added or changed.
 * {@link SyncMesh3DNodes} updates transforms each frame after bounds are computed.
 */
export class EnsureMesh3DNodes extends System {
  private readonly commands = new Commands(this);

  private readonly sources = this.query((q) =>
    q.addedOrChanged.with(Mesh3DNode).trackWrites,
  );

  /** Retries spawn when bounds were not ready on the Mesh3DNode insert frame. */
  private readonly pendingMeshes = this.query((q) =>
    q.current.with(Mesh3DNode).read,
  );

  private readonly cameras3D = this.query((q) => q.current.with(Camera3D).read);
  private readonly canvases = this.query((q) => q.current.with(Canvas).read);

  constructor() {
    super();
    this.query((q) =>
      q
        .using(
          ComputedBounds,
          Canvas,
          Camera,
          Children,
          FractionalIndex,
          Light3D,
          Flex,
          Transform,
          Rect,
        )
        .read.and.using(
          Canvas3DScope,
          Mesh3D,
          Material3D,
          Mesh3DNode,
          Mesh3DNodeTarget,
          Transform3D,
          Camera3D,
          Selected,
          Selected3D,
        )
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
      const existingMesh = entity.read(Mesh3DNode).meshEntity;
      if (existingMesh && isEntityAlive(existingMesh)) {
        return;
      }
      queuedSources.add(entity);
      const canvas = this.resolveCanvasForSource(entity);
      if (!canvas) {
        return;
      }
      pending.push({
        source: entity,
        mesh: this.queueSpawnMesh(entity, canvas),
      });
    };

    for (const entity of this.sources.addedOrChanged) {
      const node = entity.read(Mesh3DNode);
      const existingMesh = node.meshEntity;
      if (existingMesh && isEntityAlive(existingMesh)) {
        rebuildMesh3DNodeCompanionGeometry(entity, existingMesh);
        syncMesh3DNodeCompanionFromSource(entity, existingMesh);
        requestGltfMeshLoad(entity);
        const canvas = this.resolveCanvasForSource(entity);
        if (canvas) {
          ensureCompanionGizmoWhenSourceSelected(entity, existingMesh, canvas);
        }
        continue;
      }
      trySpawn(entity);
    }

    for (const entity of this.pendingMeshes.current) {
      trySpawn(entity);
    }

    if (pending.length > 0) {
      this.commands.execute();
      for (const { source, mesh } of pending) {
        const node = source.write(Mesh3DNode);
        const prev = node.meshEntity;
        if (prev && isEntityAlive(prev) && prev !== mesh) {
          prev.add(ToBeDeleted);
        }
        node.meshEntity = mesh.hold();
        syncMesh3DNodeCompanionFromSource(source, mesh);
        requestGltfMeshLoad(source);
        const canvas = this.resolveCanvasForSource(source);
        if (canvas) {
          ensureCompanionGizmoWhenSourceSelected(source, mesh, canvas);
        }
      }
    }

    for (const { source } of pending) {
      this.ensureCameraForSource(source);
    }

    if (pending.length > 0) {
      this.commands.execute();
    }
  }

  private ensureCameraForSource(source: Entity): void {
    const canvas = this.resolveCanvasForSource(source);
    if (!canvas) {
      return;
    }
    const canvasCount = this.canvases.current.length || 1;
    if (findCamera3DForCanvas(this.cameras3D.current, canvas, canvasCount)) {
      return;
    }
    const node = source.read(Mesh3DNode);
    const cam = node.camera3d ?? {};
    queueCamera3DFromMesh3DNode(this.commands, canvas, cam);
  }

  private queueSpawnMesh(source: Entity, canvas: Entity): Entity {
    return queueMesh3DCompanion(this.commands, source, canvas);
  }

  private resolveCanvasForSource(source: Entity): Entity | undefined {
    if (source.has(Canvas3DScope)) {
      const canvas = source.read(Canvas3DScope).canvas;
      if (isEntityAlive(canvas)) {
        return canvas;
      }
    }
    return resolveCanvasFromSceneGraph(source);
  }
}
