import { load } from '@loaders.gl/core';
import { DracoLoader } from '@loaders.gl/draco';
import { GLTFLoader } from '@loaders.gl/gltf';
import type { Mesh3DGeometrySpec } from '../geometry3d/types';
import { bakeGltfMesh, type GltfMeshBakeResult } from './bake-gltf-mesh';
import type { GltfContainer } from './accessors';

const GLTF_LOAD_OPTIONS = {
  gltf: {
    loadBuffers: true,
    loadImages: true,
  },
  DracoLoader,
};

const urlCache = new Map<string, Promise<GltfMeshBakeResult>>();

function cacheKey(url: string, mesh?: number): string {
  return JSON.stringify({ url, mesh: mesh ?? null });
}

export async function loadGltfMeshFromUrl(
  url: string,
  options?: { mesh?: number; scene?: number },
): Promise<GltfMeshBakeResult> {
  const key = cacheKey(url, options?.mesh);
  let pending = urlCache.get(key);
  if (!pending) {
    pending = (async () => {
      const container = (await load(
        url,
        GLTFLoader,
        GLTF_LOAD_OPTIONS,
      )) as GltfContainer;
      return bakeGltfMesh(container, options);
    })();
    urlCache.set(key, pending);
  }
  return pending;
}

export function loadGltfMeshFromSpec(
  spec: Extract<Mesh3DGeometrySpec, { type: 'gltf' }>,
): Promise<GltfMeshBakeResult> {
  return loadGltfMeshFromUrl(spec.url, { mesh: spec.mesh });
}

export function clearGltfMeshCache(url?: string): void {
  if (url == null) {
    urlCache.clear();
    return;
  }
  for (const key of [...urlCache.keys()]) {
    if (key.includes(JSON.stringify(url))) {
      urlCache.delete(key);
    }
  }
}
