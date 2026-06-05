import type { Entity } from '@lastolivegames/becsy';
import { Commands } from '../commands';
import {
  Camera3D,
  Canvas3DScope,
  Material3D,
  Mesh3D,
  Mesh3DNode,
  Mesh3DNodeTarget,
  ToBeDeleted,
  Transform3D,
} from '../components';
import type { Projection3D } from '../components/geometry3d/Camera3D';
import {
  resolveMesh3DNodeCanvasCenter,
  resolveMesh3DNodeGeometry,
  resolveMesh3DNodeScale,
  syncMesh3DNodeCompanionFromSource,
} from './mesh3d-node';
import { isEntityAlive } from '../systems/Transform';

export type Mesh3DCameraConfig = {
  linked?: boolean;
  projection?: Projection3D;
  clearColor?: boolean;
};

/** Queue a companion {@link Mesh3D} for a declarative {@link Mesh3DNode} source. */
export function queueMesh3DCompanion(
  commands: Commands,
  source: Entity,
  canvas: Entity,
): Entity {
  const center = resolveMesh3DNodeCanvasCenter(source);
  const node = source.read(Mesh3DNode);
  const geometry = node.geometry;
  const z = node.z;
  const rotation3d = [...node.rotation3d] as [number, number, number];
  const scale3d = node.scale3d;
  const baseColor = [...node.baseColor] as [number, number, number, number];
  const ambient = node.ambient;
  const diffuse = node.diffuse;
  const specular = node.specular;
  const shininess = node.shininess;

  const { positions, normals, indices } = resolveMesh3DNodeGeometry(geometry);

  const transformProps = center
    ? {
        translation: [center[0], center[1], z] as [number, number, number],
        rotation: rotation3d,
        scale: resolveMesh3DNodeScale(scale3d),
      }
    : {
        translation: [0, 0, z] as [number, number, number],
        rotation: rotation3d,
        scale: resolveMesh3DNodeScale(scale3d),
      };

  return commands
    .spawn(
      new Mesh3D({ positions, normals, indices }),
      new Material3D({
        baseColor,
        ambient,
        diffuse,
        specular,
        shininess,
      }),
      new Transform3D(transformProps),
      new Mesh3DNodeTarget({ source: source.hold() }),
      new Canvas3DScope({ canvas }),
    )
    .id();
}

export function queueCamera3DFromMesh3DNode(
  commands: Commands,
  canvas: Entity,
  camera3d?: Mesh3DCameraConfig,
): void {
  const cam = camera3d ?? {};
  commands.spawn(
    new Camera3D({
      linked: cam.linked ?? true,
      projection: cam.projection ?? 'perspective',
      clearColor: cam.clearColor ?? false,
    }),
    new Canvas3DScope({ canvas }),
  );
}

/**
 * Spawn companion meshes (and optionally {@link Camera3D}) for new `mesh3d` sources.
 * Returns whether any commands were queued.
 */
export function ensureMesh3DNodeCompanions(
  commands: Commands,
  sources: readonly Entity[],
  canvas: Entity,
  options?: { spawnCamera?: boolean },
): boolean {
  const pending: { source: Entity; mesh: Entity }[] = [];

  for (const source of sources) {
    if (!source.has(Mesh3DNode)) {
      continue;
    }
    const existingMesh = source.read(Mesh3DNode).meshEntity;
    if (existingMesh && isEntityAlive(existingMesh)) {
      continue;
    }
    pending.push({
      source,
      mesh: queueMesh3DCompanion(commands, source, canvas),
    });
  }

  if (pending.length === 0) {
    return false;
  }

  commands.execute();

  for (const { source, mesh } of pending) {
    const node = source.write(Mesh3DNode);
    const prev = node.meshEntity;
    if (prev && isEntityAlive(prev) && prev !== mesh) {
      prev.add(ToBeDeleted);
    }
    node.meshEntity = mesh.hold();
    syncMesh3DNodeCompanionFromSource(source, mesh);
  }

  if (options?.spawnCamera) {
    const cam = pending[0]!.source.read(Mesh3DNode).camera3d;
    queueCamera3DFromMesh3DNode(commands, canvas, cam);
    commands.execute();
  }

  return true;
}
