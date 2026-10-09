import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

/** Two visibly different scenes, baked by the production accessor/mesh code. */
export function gltfScenes(): GltfContainer {
  const positions = new Float32Array([0, 0, 0, 2, 0, 0, 0, 1, 0]);
  const json = {
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    scenes: [{ nodes: [0] }, { nodes: [1] }],
    nodes: [{ mesh: 0 }, { mesh: 1, scale: [1, 2, 1] }],
    meshes: [0, 1].map((material) => ({
      primitives: [{ attributes: { POSITION: 0 }, material }],
    })),
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.2, 0.4, 0.6, 0.8],
          baseColorTexture: { index: 0 },
        },
      },
      { pbrMetallicRoughness: { baseColorFactor: [0.8, 0.6, 0.4, 1] } },
    ],
    textures: [{ source: 0 }],
    images: [{ uri: 'albedo.png' }],
  };
  return { json, buffers: [{ arrayBuffer: positions.buffer }] };
}
