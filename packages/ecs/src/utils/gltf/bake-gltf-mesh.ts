import { mat4, vec3, vec4 } from 'gl-matrix';
import type { Mesh3DGeometryData } from '../geometry3d/types';
import { readAccessor, type GltfContainer } from './accessors';
import { computeVertexNormals } from './compute-normals';
import { normalizeMeshBoundsInPlace } from './normalize-bounds';
import { resolveGltfAssetUrl } from './resolve-gltf-url';
import type {
  Material3DAlphaMode,
  Material3DTextureTransform,
} from '../../components/geometry3d/Material3D';

type GltfTextureInfo = {
  index?: number;
  texCoord?: number;
  extensions?: {
    KHR_texture_transform?: Material3DTextureTransform & { texCoord?: number };
  };
};

function textureCoord(info: GltfTextureInfo | undefined): number {
  return (
    info?.extensions?.KHR_texture_transform?.texCoord ?? info?.texCoord ?? 0
  );
}

function textureTransform(
  info: GltfTextureInfo | undefined,
): Material3DTextureTransform | null {
  const extension = info?.extensions?.KHR_texture_transform;
  if (!extension) return null;
  const { offset = [0, 0], scale = [1, 1], rotation = 0 } = extension;
  if (
    offset.length !== 2 ||
    scale.length !== 2 ||
    ![...offset, ...scale, rotation].every(Number.isFinite)
  )
    return null;
  return { offset: [...offset], scale: [...scale], rotation };
}

export type GltfMeshBakeResult = Mesh3DGeometryData & {
  baseColor: [number, number, number, number];
  /** Resolved base-color texture URL from glTF materials, if any. */
  map: string | null;
  mapTexCoord: 0 | 1;
  mapTextureTransform: Material3DTextureTransform | null;
  /** Resolved glTF metallic-roughness texture URL, if any. */
  metallicRoughnessMap: string | null;
  metallicRoughnessTexCoord: 0 | 1;
  metallicRoughnessTextureTransform: Material3DTextureTransform | null;
  metallic: number;
  roughness: number;
  alphaMode: Material3DAlphaMode;
  alphaCutoff: number;
  /** Individual primitive buffers, normalized in the same space as the whole scene. */
  parts: GltfMeshPart[];
};

export type GltfMeshPart = Mesh3DGeometryData & ImportedMaterial;

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
      attributes: {
        POSITION: number;
        NORMAL?: number;
        TEXCOORD_0?: number;
        TEXCOORD_1?: number;
      };
      indices?: number;
      mode?: number;
      material?: number;
    }[];
  }[];
  materials?: {
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
    alphaCutoff?: number;
    pbrMetallicRoughness?: {
      baseColorFactor?: number[];
      baseColorTexture?: GltfTextureInfo;
      metallicRoughnessTexture?: GltfTextureInfo;
      metallicFactor?: number;
      roughnessFactor?: number;
    };
  }[];
  textures?: { source?: number }[];
  images?: { uri?: string; bufferView?: number; mimeType?: string }[];
};

function readMaterialTextureUrl(
  gltf: GltfContainer,
  json: GltfJson,
  textureInfo: GltfTextureInfo | undefined,
  baseUrl?: string,
): string | null {
  if (![0, 1].includes(textureCoord(textureInfo))) return null;
  const texIndex = textureInfo?.index;
  if (texIndex == null) {
    return null;
  }
  const imageIndex = json.textures?.[texIndex]?.source;
  if (imageIndex == null) {
    return null;
  }
  const image = json.images?.[imageIndex];
  if (image?.uri) {
    return baseUrl
      ? resolveGltfAssetUrl(baseUrl, image.uri)
      : image.uri.startsWith('data:')
      ? image.uri
      : null;
  }
  if (
    image?.bufferView == null ||
    !/^image\/(png|jpeg)$/.test(image.mimeType ?? '')
  )
    return null;
  const view = json.bufferViews[image.bufferView] as {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
  };
  const buffer = gltf.buffers[view?.buffer];
  if (!buffer?.arrayBuffer) return null;
  const bytes = new Uint8Array(
    buffer.arrayBuffer,
    (buffer.byteOffset ?? 0) + (view.byteOffset ?? 0),
    view.byteLength,
  );
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return `data:${image.mimeType};base64,${btoa(chunks.join(''))}`;
}

function readMaterialBaseColor(
  json: GltfJson,
  materialIndex?: number,
): [number, number, number, number] {
  if (materialIndex == null) {
    return [1, 1, 1, 1];
  }
  const factor =
    json.materials?.[materialIndex]?.pbrMetallicRoughness?.baseColorFactor;
  if (!factor || factor.length < 3) {
    return [1, 1, 1, 1];
  }
  return [factor[0], factor[1], factor[2], factor.length >= 4 ? factor[3] : 1];
}

type ImportedMaterial = Pick<
  GltfMeshBakeResult,
  | 'baseColor'
  | 'map'
  | 'metallicRoughnessMap'
  | 'mapTexCoord'
  | 'metallicRoughnessTexCoord'
  | 'mapTextureTransform'
  | 'metallicRoughnessTextureTransform'
  | 'metallic'
  | 'roughness'
  | 'alphaMode'
  | 'alphaCutoff'
>;

function readMaterial(
  gltf: GltfContainer,
  json: GltfJson,
  materialIndex: number,
  baseUrl?: string,
): ImportedMaterial {
  const material = json.materials?.[materialIndex];
  const cutoff = material?.alphaCutoff;
  const factor = material?.pbrMetallicRoughness;
  const unitFactor = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : 1;
  return {
    baseColor: readMaterialBaseColor(json, materialIndex),
    map: readMaterialTextureUrl(gltf, json, factor?.baseColorTexture, baseUrl),
    mapTexCoord: textureCoord(factor?.baseColorTexture) === 1 ? 1 : 0,
    mapTextureTransform: textureTransform(factor?.baseColorTexture),
    metallicRoughnessMap: readMaterialTextureUrl(
      gltf,
      json,
      factor?.metallicRoughnessTexture,
      baseUrl,
    ),
    metallicRoughnessTexCoord:
      textureCoord(factor?.metallicRoughnessTexture) === 1 ? 1 : 0,
    metallicRoughnessTextureTransform: textureTransform(
      factor?.metallicRoughnessTexture,
    ),
    metallic: unitFactor(factor?.metallicFactor),
    roughness: unitFactor(factor?.roughnessFactor),
    alphaMode:
      material?.alphaMode === 'MASK'
        ? 'mask'
        : material?.alphaMode === 'BLEND'
        ? 'blend'
        : 'opaque',
    alphaCutoff:
      typeof cutoff === 'number' && Number.isFinite(cutoff)
        ? Math.max(0, Math.min(1, cutoff))
        : 0.5,
  };
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

function transformPositionsInPlace(
  positions: Float32Array,
  matrix: mat4,
): void {
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
  uvChunks: Float32Array[],
  uv1Chunks: Float32Array[],
  idxChunks: number[],
  vertexOffset: { value: number },
  materialOut: { value: ImportedMaterial; selected: boolean },
  partRanges: {
    vertexStart: number;
    vertexCount: number;
    indexStart: number;
    hasUv1: boolean;
    material: ImportedMaterial;
  }[],
  baseUrl?: string,
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

    const readUvs = (index: number | undefined): Float32Array => {
      if (index === undefined) return new Float32Array(vCount * 2);
      const accessor = readAccessor(gltf, index);
      return accessor.components === 2 &&
        accessor.array instanceof Float32Array &&
        accessor.array.length === vCount * 2
        ? new Float32Array(accessor.array)
        : new Float32Array(vCount * 2);
    };
    const uvs = readUvs(prim.attributes.TEXCOORD_0);
    const uvs1 = readUvs(prim.attributes.TEXCOORD_1);

    let primitiveIndices: Uint32Array | undefined;
    if (prim.indices !== undefined) {
      const accessor = readAccessor(gltf, prim.indices);
      if (accessor.components !== 1) continue;
      if (accessor.array instanceof Uint32Array) {
        primitiveIndices = accessor.array;
      } else if (
        accessor.array instanceof Uint16Array ||
        accessor.array instanceof Uint8Array
      ) {
        primitiveIndices = Uint32Array.from(accessor.array);
      } else {
        continue;
      }
    }

    const vertexStart = vertexOffset.value;
    const indexStart = idxChunks.length;
    posChunks.push(positions);
    normalChunks.push(normals);
    uvChunks.push(uvs);
    uv1Chunks.push(uvs1);

    const imported = readMaterial(gltf, json, prim.material ?? -1, baseUrl);
    if (prim.attributes.TEXCOORD_1 === undefined) {
      if (imported.mapTexCoord === 1) imported.map = null;
      if (imported.metallicRoughnessTexCoord === 1)
        imported.metallicRoughnessMap = null;
    }
    if (
      !materialOut.selected &&
      prim.material !== undefined &&
      json.materials?.[prim.material]
    ) {
      materialOut.value = imported;
      materialOut.selected = true;
    }

    if (primitiveIndices) {
      for (let i = 0; i < primitiveIndices.length; i++) {
        idxChunks.push(vertexOffset.value + primitiveIndices[i]);
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
    partRanges.push({
      vertexStart,
      vertexCount: vCount,
      indexStart,
      hasUv1: prim.attributes.TEXCOORD_1 !== undefined,
      material: imported,
    });
  }
}

function traverseNode(
  gltf: GltfContainer,
  json: GltfJson,
  nodeIndex: number,
  parentMatrix: mat4,
  posChunks: Float32Array[],
  normalChunks: Float32Array[],
  uvChunks: Float32Array[],
  uv1Chunks: Float32Array[],
  idxChunks: number[],
  vertexOffset: { value: number },
  materialOut: { value: ImportedMaterial; selected: boolean },
  partRanges: {
    vertexStart: number;
    vertexCount: number;
    indexStart: number;
    hasUv1: boolean;
    material: ImportedMaterial;
  }[],
  baseUrl?: string,
  meshFilter?: number,
): void {
  const node = json.nodes?.[nodeIndex];
  if (!node) {
    return;
  }
  const local = nodeLocalMatrix(node);
  const world = mat4.create();
  mat4.multiply(world, parentMatrix, local);

  if (
    node.mesh !== undefined &&
    (meshFilter == null || node.mesh === meshFilter)
  ) {
    appendPrimitive(
      gltf,
      json,
      node.mesh,
      world,
      posChunks,
      normalChunks,
      uvChunks,
      uv1Chunks,
      idxChunks,
      vertexOffset,
      materialOut,
      partRanges,
      baseUrl,
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
      uvChunks,
      uv1Chunks,
      idxChunks,
      vertexOffset,
      materialOut,
      partRanges,
      baseUrl,
      meshFilter,
    );
  }
}

/** Flatten glTF scene meshes into a unit-bounds {@link Mesh3D} buffer set. */
export function bakeGltfMesh(
  gltf: GltfContainer,
  options?: { mesh?: number; scene?: number; baseUrl?: string },
): GltfMeshBakeResult {
  const json = gltf.json as GltfJson;
  const posChunks: Float32Array[] = [];
  const normalChunks: Float32Array[] = [];
  const uvChunks: Float32Array[] = [];
  const uv1Chunks: Float32Array[] = [];
  const idxChunks: number[] = [];
  const vertexOffset = { value: 0 };
  const materialOut = {
    value: {
      baseColor: [1, 1, 1, 1] as [number, number, number, number],
      map: null,
      mapTexCoord: 0,
      mapTextureTransform: null,
      metallicRoughnessMap: null,
      metallicRoughnessTexCoord: 0,
      metallicRoughnessTextureTransform: null,
      metallic: 1,
      roughness: 1,
      alphaMode: 'opaque',
      alphaCutoff: 0.5,
    } as ImportedMaterial,
    selected: false,
  };
  const partRanges: {
    vertexStart: number;
    vertexCount: number;
    indexStart: number;
    hasUv1: boolean;
    material: ImportedMaterial;
  }[] = [];
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
        uvChunks,
        uv1Chunks,
        idxChunks,
        vertexOffset,
        materialOut,
        partRanges,
        options?.baseUrl,
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
      uvChunks,
      uv1Chunks,
      idxChunks,
      vertexOffset,
      materialOut,
      partRanges,
      options?.baseUrl,
    );
  }

  if (posChunks.length === 0) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      indices: new Uint32Array(0),
      parts: [],
      ...materialOut.value,
    };
  }

  const totalFloats = posChunks.reduce((s, c) => s + c.length, 0);
  const positions = new Float32Array(totalFloats);
  const normals = new Float32Array(totalFloats);
  const uvs = new Float32Array((totalFloats / 3) * 2);
  const uvs1 = new Float32Array(uvs.length);
  let offset = 0;
  let uvOffset = 0;
  for (let i = 0; i < posChunks.length; i++) {
    positions.set(posChunks[i], offset);
    const chunkNormals = normalChunks[i];
    if (chunkNormals.length === posChunks[i].length) {
      normals.set(chunkNormals, offset);
    }
    const chunkUvs = uvChunks[i];
    const chunkUvs1 = uv1Chunks[i];
    if (chunkUvs.length === (posChunks[i].length / 3) * 2) {
      uvs.set(chunkUvs, uvOffset);
      uvs1.set(chunkUvs1, uvOffset);
    }
    offset += posChunks[i].length;
    uvOffset += chunkUvs.length;
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

  const parts = partRanges.map((range, i): GltfMeshPart => {
    const start = range.vertexStart;
    const end = start + range.vertexCount;
    const partIndices = indices.slice(
      range.indexStart,
      partRanges[i + 1]?.indexStart ?? indices.length,
    );
    for (let j = 0; j < partIndices.length; j++) partIndices[j] -= start;
    return {
      positions: positions.subarray(start * 3, end * 3),
      normals: normals.subarray(start * 3, end * 3),
      uvs: uvs.subarray(start * 2, end * 2),
      uvs1: range.hasUv1 ? uvs1.subarray(start * 2, end * 2) : undefined,
      indices: partIndices,
      ...range.material,
    };
  });

  return {
    positions,
    normals,
    indices,
    uvs,
    uvs1: partRanges.some(({ hasUv1 }) => hasUv1) ? uvs1 : undefined,
    parts,
    ...materialOut.value,
  };
}
