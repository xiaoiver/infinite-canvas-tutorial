import type { Entity } from '@lastolivegames/becsy';
import { pendingAPICallings } from '../../API';
import { Material3D, Mesh3D, Mesh3DNode } from '../../components';
import { isEntityAlive } from '../../systems/Transform';
import {
  geometrySpecKey,
  isGltfGeometrySpec,
  normalizeGeometry,
} from '../geometry3d';
import {
  clearMesh3DNodeCompanionGeometryKey,
  seedMesh3DNodeCompanionGeometryKey,
} from '../mesh3d-node';
import { loadGltfMeshFromSpec } from './load-gltf-mesh';

const pending = new Set<string>();

/**
 * Kick off async glTF fetch + bake for a declarative {@link Mesh3DNode} source.
 * Mesh data is applied on the next {@link pendingAPICallings} flush (ECS-safe writes).
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

  const key = geometrySpecKey(spec);
  const pendingKey = `${source.__id}:${key}`;
  if (pending.has(pendingKey)) {
    return;
  }
  pending.add(pendingKey);

  void loadGltfMeshFromSpec(spec)
    .then((baked) => {
      pendingAPICallings.push(() => {
        if (
          !isEntityAlive(source) ||
          !source.has(Mesh3DNode) ||
          geometrySpecKey(normalizeGeometry(source.read(Mesh3DNode).geometry)) !==
            key
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

        if (companion.has(Material3D)) {
          const material = companion.read(Material3D);
          const hasCustomColor =
            material.baseColor[0] !== 1 ||
            material.baseColor[1] !== 1 ||
            material.baseColor[2] !== 1 ||
            material.baseColor[3] !== 1;
          if (!hasCustomColor) {
            companion.write(Material3D).baseColor = [...baked.baseColor];
          }
          if (baked.map && !material.map) {
            companion.write(Material3D).map = baked.map;
            if (source.has(Mesh3DNode) && !source.read(Mesh3DNode).map) {
              source.write(Mesh3DNode).map = baked.map;
            }
          }
        }
        seedMesh3DNodeCompanionGeometryKey(source);
      });
    })
    .catch((err) => {
      console.warn('[requestGltfMeshLoad] failed to load glTF', spec.url, err);
      clearMesh3DNodeCompanionGeometryKey(source);
    })
    .finally(() => {
      pending.delete(pendingKey);
    });
}
