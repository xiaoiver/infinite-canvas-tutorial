import type { API } from '../../API';
import type { Entity } from '@lastolivegames/becsy';
import {
  Canvas,
  Canvas3DScope,
  Material3D,
  Mesh3D,
  Mesh3DNode,
} from '../../components';
import { isEntityAlive } from '../../systems/Transform';
import {
  geometrySpecKey,
  isGltfGeometrySpec,
  normalizeGeometry,
} from '../geometry3d';
import {
  clearMesh3DNodeCompanionGeometryKey,
  seedMesh3DNodeCompanionGeometryKey,
  syncMesh3DNodeCompanionMaterial,
} from '../mesh3d-node';
import { loadGltfMeshFromSpec } from './load-gltf-mesh';

const pendingByCanvas = new WeakMap<API, Set<string>>();
const retryBySource = new WeakMap<
  Entity,
  { key: string; delay: number; after: number }
>();

/**
 * Kick off async glTF fetch + bake for a declarative {@link Mesh3DNode} source.
 * Mesh data is applied on the next {@link API.runAtNextTick} flush (ECS-safe writes).
 */
export function requestGltfMeshLoad(source: Entity): void {
  if (!source.has(Mesh3DNode)) {
    return;
  }
  const spec = normalizeGeometry(source.read(Mesh3DNode).geometry);
  if (!isGltfGeometrySpec(spec)) {
    return;
  }
  const meshEntity = source.read(Mesh3DNode).meshEntity;
  if (!meshEntity || !isEntityAlive(meshEntity) || !meshEntity.has(Mesh3D)) {
    return;
  }
  const mesh = meshEntity.read(Mesh3D);
  if (mesh.positions.length > 0) {
    return;
  }

  if (!meshEntity.has(Canvas3DScope)) return;
  const canvas = meshEntity.read(Canvas3DScope).canvas;
  if (!isEntityAlive(canvas)) return;
  const api = canvas.read(Canvas).api;
  if (!api) return;
  let pending = pendingByCanvas.get(api);
  if (!pending) {
    pending = new Set();
    pendingByCanvas.set(api, pending);
  }
  const key = geometrySpecKey(spec);
  const retry = retryBySource.get(source);
  if (retry?.key === key && Date.now() < retry.after) return;
  if (retry?.key !== key) retryBySource.delete(source);
  const pendingKey = `${source.__id}:${key}`;
  if (pending.has(pendingKey)) {
    return;
  }
  pending.add(pendingKey);

  void loadGltfMeshFromSpec(spec)
    .then((baked) => {
      api.runAtNextTick(() => {
        if (
          !isEntityAlive(source) ||
          !source.has(Mesh3DNode) ||
          geometrySpecKey(
            normalizeGeometry(source.read(Mesh3DNode).geometry),
          ) !== key
        ) {
          return;
        }
        const companion = source.read(Mesh3DNode).meshEntity;
        if (!companion || !isEntityAlive(companion) || !companion.has(Mesh3D)) {
          return;
        }
        const meshWrite = companion.write(Mesh3D);
        Object.assign(meshWrite, {
          positions: baked.positions,
          normals: baked.normals,
          indices: baked.indices,
        });
        meshWrite.uvs = baked.uvs ?? null;

        retryBySource.delete(source);
        seedMesh3DNodeCompanionGeometryKey(source, {
          baseColor: baked.baseColor,
          map: baked.map,
        });
        if (companion.has(Material3D)) {
          syncMesh3DNodeCompanionMaterial(source, companion);
        }
      });
    })
    .catch((err) => {
      console.warn('[requestGltfMeshLoad] failed to load glTF', spec.url, err);
      if (
        isEntityAlive(source) &&
        source.has(Mesh3DNode) &&
        geometrySpecKey(normalizeGeometry(source.read(Mesh3DNode).geometry)) ===
          key
      ) {
        clearMesh3DNodeCompanionGeometryKey(source);
        // The load system runs every frame. Retry without a timer or a request
        // storm, and keep failures of other geometry versions independent.
        const previous = retryBySource.get(source);
        const delay =
          previous?.key === key ? Math.min(previous.delay * 2, 30000) : 1000;
        retryBySource.set(source, { key, delay, after: Date.now() + delay });
      }
    })
    .finally(() => {
      pending.delete(pendingKey);
    });
}
