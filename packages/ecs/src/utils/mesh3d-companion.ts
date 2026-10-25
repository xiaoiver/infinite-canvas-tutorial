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
import { axonometricCameraPose } from '../components/geometry3d/Camera3D';
import type { Camera3DNodeConfig } from '../types/serialized-node';
import {
  resolveMesh3DNodeCanvasCenter,
  resolveMesh3DNodeGeometry,
  resolveMesh3DNodeScale,
  seedMesh3DNodeCompanionGeometryKey,
  syncMesh3DNodeCompanionFromSource,
} from './mesh3d-node';
import { isGltfGeometrySpec, normalizeGeometry } from './geometry3d';
import { isEntityAlive } from '../systems/Transform';

export type Mesh3DCameraConfig = Camera3DNodeConfig;

export function resolveMesh3DCameraConfig(
  cam: Mesh3DCameraConfig,
): Partial<Camera3D> {
  const pose = cam.preset
    ? axonometricCameraPose(
        cam.preset,
        cam.center ?? [0, 0, 0],
        Number.isFinite(cam.distance) && (cam.distance ?? 0) > 0
          ? cam.distance!
          : 500,
      )
    : {};
  return {
    linked: cam.preset ? false : cam.linked ?? !cam.eye,
    projection: cam.preset ? 'orthographic' : cam.projection ?? 'perspective',
    clearColor: cam.clearColor ?? false,
    orthographicHeight: cam.orthographicHeight ?? (cam.preset ? 500 : 0),
    ...pose,
    ...(cam.center ? { center: cam.center } : {}),
    ...(cam.eye ? { eye: cam.eye } : {}),
    ...(cam.up ? { up: cam.up } : {}),
  };
}

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
  const toneSteps = node.toneSteps;
  const outlineWidth = node.outlineWidth;
  const outlineColor = [...node.outlineColor] as [
    number,
    number,
    number,
    number,
  ];
  const rimLightStrength = node.rimLightStrength;
  const rimLightColor = [...node.rimLightColor] as [
    number,
    number,
    number,
    number,
  ];
  const ambient = node.ambient;
  const diffuse = node.diffuse;
  const specular = node.specular;
  const shininess = node.shininess;
  const metallic = node.metallic;
  const roughness = node.roughness;
  const metallicRoughnessMap = node.metallicRoughnessMap ?? null;
  const metallicRoughnessTexCoord = node.metallicRoughnessTexCoord ?? 0;
  const metallicRoughnessTextureTransform =
    node.metallicRoughnessTextureTransform;
  const map = node.map ?? null;
  const mapTexCoord = node.mapTexCoord ?? 0;
  const mapTextureTransform = node.mapTextureTransform;
  const emissiveFactor = [...node.emissiveFactor] as [number, number, number];
  const emissiveStrength = node.emissiveStrength;
  const unlit = node.unlit;
  const emissiveMap = node.emissiveMap;
  const emissiveTexCoord = node.emissiveTexCoord ?? 0;
  const emissiveTextureTransform = node.emissiveTextureTransform;
  const doubleSided = node.doubleSided ?? false;
  const normalMap = node.normalMap;
  const normalTexCoord = node.normalTexCoord ?? 0;
  const normalTextureTransform = node.normalTextureTransform;
  const normalScale = node.normalScale ?? 1;
  const occlusionMap = node.occlusionMap;
  const occlusionTexCoord = node.occlusionTexCoord ?? 0;
  const occlusionTextureTransform = node.occlusionTextureTransform;
  const occlusionStrength = node.occlusionStrength ?? 1;
  const alphaMode = node.alphaMode;
  const alphaCutoff = node.alphaCutoff;
  const specularMap = node.specularMap ?? null;
  const bumpMap = node.bumpMap ?? null;
  const environmentMap = node.environmentMap ?? null;
  const bumpScale = node.bumpScale;
  const castShadow = node.castShadow;
  const receiveShadow = node.receiveShadow;

  const spec = normalizeGeometry(geometry);
  const meshData = resolveMesh3DNodeGeometry(geometry);
  if (!isGltfGeometrySpec(spec)) {
    seedMesh3DNodeCompanionGeometryKey(source);
  }

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
      new Mesh3D(meshData),
      new Material3D({
        baseColor,
        toneSteps,
        outlineWidth,
        outlineColor,
        rimLightStrength,
        rimLightColor,
        ambient,
        diffuse,
        specular,
        shininess,
        metallic,
        roughness,
        metallicRoughnessMap,
        metallicRoughnessTexCoord,
        metallicRoughnessTextureTransform,
        map,
        mapTexCoord,
        mapTextureTransform,
        emissiveFactor,
        emissiveStrength,
        unlit,
        emissiveMap,
        emissiveTexCoord,
        emissiveTextureTransform,
        doubleSided,
        normalMap,
        normalTexCoord,
        normalTextureTransform,
        normalScale,
        occlusionMap,
        occlusionTexCoord,
        occlusionTextureTransform,
        occlusionStrength,
        alphaMode,
        alphaCutoff,
        specularMap,
        bumpMap,
        environmentMap,
        bumpScale,
        castShadow,
        receiveShadow,
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
    new Camera3D(resolveMesh3DCameraConfig(cam)),
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
