import { mat4, vec3, vec4 } from 'gl-matrix';
import type { Mesh3DGeometryData } from '../geometry3d/types';
import { readAccessor, type GltfContainer } from './accessors';
import { computeVertexNormals } from './compute-normals';
import { normalizeMeshBoundsInPlace } from './normalize-bounds';

export type GltfMeshBakeResult = Mesh3DGeometryData & {
  baseColor: [number, number, number, number];
};

type GltfJson = GltfContainer['json'] & {
  scenes?: { nodes?: number[] }[];
  nodes?: {
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  meshes?: {
    primitives: {
      attributes: { POSITION: number; NORMAL?: number };
      indices?: number;
      mode?: number;
      material?: number;
    }[];
  }[];
  materials?: {
    pbrMetallicRoughness?: { baseColorFactor?: number[] };
  }[];
};

function readMaterialBaseColor(
  json: GltfJson,
  materialIndex?: number,
): [number, number, number, number] {
  if (materialIndex == null) {
    return [1, 1, 1, 1];
  }
  const factor = json.materials?.[materialIndex]?.pbrMetallicRoughness
    ?.baseColorFactor;
  if (!factor || factor.length < 3) {
    return [1, 1, 1, 1];
  }
  return [
    factor[0],
    factor[1],
    factor[2],
    factor.length >= 4 ? factor[3] : 1,
  ];
}

function nodeLocalMatrix(node: NonNullable<GltfJson['nodes']>[number]): mat4 {
  const m = mat4.create();
  if (node.matrix && node.matrix.length === 16) {
    mat4.copy(m, node.matrix as mat4);
    return m;
  }
  mat4.fromRotationTranslationScale(
    m,
    (node.rotation ?? [0, 0, 0, 1]) as vec4,
    (node.translation ?? [0, 0, 0]) as vec3,
    (node.scale ?? [1, 1, 1]) as vec3,
  );
  return m;
}

function transformPositionsInPlace(positions: Float32Array, matrix: mat4): void {
  const v = vec3.create();
  for (let i = 0; i < positions.length; i += 3) {
    vec3.set(v, positions[i], positions[i + 1], positions[i + 2]);
    vec3.transformMat4(v, v, matrix);
    positions[i] = v[0];
    positions[i + 1] = v[1];
    positions[i + 2] = v[2];
  }
}

function transformNormalsInPlace(normals: Float32Array, matrix: mat4): void {
  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, matrix);
  mat4.transpose(normalMatrix, normalMatrix);
  const n = vec3.create();
  for (let i = 0; i < normals.length; i += 3) {
    vec3.set(n, normals[i], normals[i + 1], normals[i + 2]);
    vec3.transformMat4(n, n, normalMatrix);
    const len = vec3.length(n);
    if (len > 1e-8) {
      vec3.scale(n, n, 1 / len);
    }
    normals[i] = n[0];
    normals[i + 1] = n[1];
    normals[i + 2] = n[2];
  }
}

function appendPrimitive(
  gltf: GltfContainer,
  json: GltfJson,
  meshIndex: number,
  worldMatrix: mat4,
  posChunks: Float32Array[],
  normalChunks: Float32Array[],
  idxChunks: number[],
  vertexOffset: { value: number },
  baseColorOut: { value: [number, number, number, number] },
): void {
  const mesh = json.meshes?.[meshIndex];
  if (!mesh) {
    return;
  }
  for (const prim of mesh.primitives ?? []) {
    if ((prim.mode ?? 4) !== 4) {
      continue;
    }
    const posIdx = prim.attributes.POSITION;
    if (posIdx === undefined) {
      continue;
    }
    const posAcc = readAccessor(gltf, posIdx);
    if (posAcc.components !== 3 || !(posAcc.array instanceof Float32Array)) {
      continue;
    }
    const positions = new Float32Array(posAcc.array);
    const vCount = positions.length / 3;
    transformPositionsInPlace(positions, worldMatrix);

    let normals: Float32Array;
    const normalIdx = prim.attributes.NORMAL;
    if (normalIdx !== undefined) {
      const normalAcc = readAccessor(gltf, normalIdx);
      if (
        normalAcc.components === 3 &&
        normalAcc.array instanceof Float32Array &&
        normalAcc.array.length === positions.length
      ) {
        normals = new Float32Array(normalAcc.array);
        transformNormalsInPlace(normals, worldMatrix);
      } else {
        normals = new Float32Array(positions.length);
      }
    } else {
      normals = new Float32Array(positions.length);
    }

    posChunks.push(positions);
    normalChunks.push(normals);

    if (baseColorOut.value[0] === 1 && prim.material !== undefined) {
      baseColorOut.value = readMaterialBaseColor(json, prim.material);
    }

    if (prim.indices !== undefined) {
      const idxAcc = readAccessor(gltf, prim.indices);
      let idx: Uint32Array;
      if (idxAcc.array instanceof Uint32Array) {
        idx = idxAcc.array;
      } else if (idxAcc.array instanceof Uint16Array) {
        idx = new Uint32Array(idxAcc.array.length);
        for (let i = 0; i < idxAcc.array.length; i++) {
          idx[i] = idxAcc.array[i];
        }
      } else {
        continue;
      }
      for (let i = 0; i < idx.length; i++) {
        idxChunks.push(vertexOffset.value + idx[i]);
      }
    } else {
      for (let i = 0; i < vCount; i += 3) {
        idxChunks.push(
          vertexOffset.value + i,
          vertexOffset.value + i + 1,
          vertexOffset.value + i + 2,
        );
      }
    }
    vertexOffset.value += vCount;
  }
}

function traverseNode(
  gltf: GltfContainer,
  json: GltfJson,
  nodeIndex: number,
  parentMatrix: mat4,
  posChunks: Float32Array[],
  normalChunks: Float32Array[],
  idxChunks: number[],
  vertexOffset: { value: number },
  baseColorOut: { value: [number, number, number, number] },
  meshFilter?: number,
): void {
  const node = json.nodes?.[nodeIndex];
  if (!node) {
    return;
  }
  const local = nodeLocalMatrix(node);
  const world = mat4.create();
  mat4.multiply(world, parentMatrix, local);

  if (node.mesh !== undefined && (meshFilter == null || node.mesh === meshFilter)) {
    appendPrimitive(
      gltf,
      json,
      node.mesh,
      world,
      posChunks,
      normalChunks,
      idxChunks,
      vertexOffset,
      baseColorOut,
    );
  }

  for (const child of node.children ?? []) {
    traverseNode(
      gltf,
      json,
      child,
      world,
      posChunks,
      normalChunks,
      idxChunks,
      vertexOffset,
      baseColorOut,
      meshFilter,
    );
  }
}

/** Flatten glTF scene meshes into a unit-bounds {@link Mesh3D} buffer set. */
export function bakeGltfMesh(
  gltf: GltfContainer,
  options?: { mesh?: number; scene?: number },
): GltfMeshBakeResult {
  const json = gltf.json as GltfJson;
  const posChunks: Float32Array[] = [];
  const normalChunks: Float32Array[] = [];
  const idxChunks: number[] = [];
  const vertexOffset = { value: 0 };
  const baseColorOut = { value: [1, 1, 1, 1] as [number, number, number, number] };
  const identity = mat4.create();

  const sceneIndex = options?.scene ?? 0;
  const scene = json.scenes?.[sceneIndex];
  if (scene?.nodes) {
    for (const root of scene.nodes) {
      traverseNode(
        gltf,
        json,
        root,
        identity,
        posChunks,
        normalChunks,
        idxChunks,
        vertexOffset,
        baseColorOut,
        options?.mesh,
      );
    }
  } else if (options?.mesh != null) {
    appendPrimitive(
      gltf,
      json,
      options.mesh,
      identity,
      posChunks,
      normalChunks,
      idxChunks,
      vertexOffset,
      baseColorOut,
    );
  }

  if (posChunks.length === 0) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      indices: new Uint32Array(0),
      baseColor: baseColorOut.value,
    };
  }

  const totalFloats = posChunks.reduce((s, c) => s + c.length, 0);
  const positions = new Float32Array(totalFloats);
  const normals = new Float32Array(totalFloats);
  let offset = 0;
  for (let i = 0; i < posChunks.length; i++) {
    positions.set(posChunks[i], offset);
    const chunkNormals = normalChunks[i];
    if (chunkNormals.length === posChunks[i].length) {
      normals.set(chunkNormals, offset);
    }
    offset += posChunks[i].length;
  }

  const indices = new Uint32Array(idxChunks);
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len < 1e-6) {
      normals[i] = NaN;
    }
  }
  const computed = computeVertexNormals(positions, indices);
  for (let i = 0; i < normals.length; i += 3) {
    if (!Number.isFinite(normals[i])) {
      normals[i] = computed[i];
      normals[i + 1] = computed[i + 1];
      normals[i + 2] = computed[i + 2];
    }
  }

  normalizeMeshBoundsInPlace(positions);

  return {
    positions,
    normals,
    indices,
    baseColor: baseColorOut.value,
  };
}
