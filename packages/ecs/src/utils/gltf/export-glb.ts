import { mat4 } from 'gl-matrix';
import type {
  Material3D,
  Material3DTextureTransform,
} from '../../components/geometry3d/Material3D';
import type { Mesh3D } from '../../components/geometry3d/Mesh3D';
import type { Transform3D } from '../../components/geometry3d/Transform3D';

export interface GlbMeshSource {
  mesh: Pick<Mesh3D, 'positions' | 'normals' | 'uvs' | 'indices'> &
    Partial<Pick<Mesh3D, 'uvs1'>>;
  material: Pick<
    Material3D,
    'baseColor' | 'sideColor' | 'metallic' | 'roughness'
  > &
    Partial<
      Pick<
        Material3D,
        | 'alphaMode'
        | 'alphaCutoff'
        | 'map'
        | 'mapTexCoord'
        | 'mapTextureTransform'
        | 'metallicRoughnessMap'
        | 'metallicRoughnessTexCoord'
        | 'metallicRoughnessTextureTransform'
        | 'emissiveFactor'
        | 'emissiveStrength'
        | 'unlit'
        | 'emissiveMap'
        | 'emissiveTexCoord'
        | 'emissiveTextureTransform'
      >
    >;
  transform: Pick<Transform3D, 'translation' | 'rotation' | 'scale'>;
  name?: string;
}

type Accessor = {
  bufferView: number;
  componentType: 5125 | 5126;
  count: number;
  type: 'SCALAR' | 'VEC2' | 'VEC3';
  min?: number[];
  max?: number[];
};

type Primitive = {
  attributes: {
    POSITION: number;
    NORMAL: number;
    TEXCOORD_0?: number;
    TEXCOORD_1?: number;
  };
  indices: number;
  material: number;
  mode: 4;
};

type GlbTextureInfo = {
  index: number;
  texCoord?: 1;
  extensions?: {
    KHR_texture_transform: Material3DTextureTransform;
  };
};

export type GlbImageData = {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg';
};

const align4 = (length: number) => Math.ceil(length / 4) * 4;
const linear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const finite = (values: ArrayLike<number>): boolean => {
  for (let i = 0; i < values.length; i++)
    if (!Number.isFinite(Math.fround(values[i]))) return false;
  return true;
};

/** Export 3D meshes to a self-contained GLB in glTF's Y-up space. */
export function exportMeshesToGlb(
  sources: readonly GlbMeshSource[],
  imageData: ReadonlyMap<string, GlbImageData> = new Map(),
): Uint8Array {
  if (!sources.length) throw new Error('No 3D meshes to export');

  const chunks: Uint8Array[] = [];
  const bufferViews: {
    buffer: 0;
    byteOffset: number;
    byteLength: number;
    target?: 34962 | 34963;
  }[] = [];
  const accessors: Accessor[] = [];
  const materials: {
    pbrMetallicRoughness: {
      baseColorFactor: number[];
      baseColorTexture?: GlbTextureInfo;
      metallicRoughnessTexture?: GlbTextureInfo;
      metallicFactor: number;
      roughnessFactor: number;
    };
    alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
    alphaCutoff?: number;
    doubleSided: boolean;
    emissiveFactor?: number[];
    emissiveTexture?: GlbTextureInfo;
    extensions?: {
      KHR_materials_emissive_strength?: { emissiveStrength: number };
      KHR_materials_unlit?: Record<string, never>;
    };
  }[] = [];
  const images: { bufferView: number; mimeType: GlbImageData['mimeType'] }[] =
    [];
  const textures: { source: number }[] = [];
  const textureIndices = new Map<string, number>();
  let usesTextureTransform = false;
  let usesEmissiveStrength = false;
  let usesUnlit = false;
  const meshes: { primitives: Primitive[] }[] = [];
  const nodes: {
    name?: string;
    rotation?: number[];
    children?: number[];
    mesh?: number;
    matrix?: number[];
  }[] = [
    // Canvas coordinates are Y-down and Z-into-screen. A half turn around X
    // converts them to glTF's Y-up, Z-toward-viewer coordinate system.
    { name: 'Canvas', rotation: [1, 0, 0, 0], children: [] },
  ];
  let byteLength = 0;
  const append = (bytes: Uint8Array, target?: 34962 | 34963): number => {
    const offset = align4(byteLength);
    if (offset > byteLength) chunks.push(new Uint8Array(offset - byteLength));
    chunks.push(bytes);
    byteLength = offset + bytes.length;
    return (
      bufferViews.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: bytes.length,
        ...(target ? { target } : {}),
      }) - 1
    );
  };
  const floats = (values: ArrayLike<number>): Uint8Array => {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < values.length; i++)
      view.setFloat32(i * 4, values[i], true);
    return bytes;
  };
  const uints = (values: readonly number[]): Uint8Array => {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < values.length; i++)
      view.setUint32(i * 4, values[i], true);
    return bytes;
  };
  const accessor = (
    bytes: Uint8Array,
    target: 34962 | 34963,
    componentType: 5125 | 5126,
    count: number,
    type: Accessor['type'],
    bounds?: { min: number[]; max: number[] },
  ): number =>
    accessors.push({
      bufferView: append(bytes, target),
      componentType,
      count,
      type,
      ...bounds,
    }) - 1;
  const textureIndexFor = (
    url: string | null | undefined,
  ): number | undefined => {
    if (!url) return;
    const image = imageData.get(url);
    if (!image) return;
    let index = textureIndices.get(url);
    if (index === undefined) {
      const imageIndex =
        images.push({
          bufferView: append(image.bytes),
          mimeType: image.mimeType,
        }) - 1;
      index = textures.push({ source: imageIndex }) - 1;
      textureIndices.set(url, index);
    }
    return index;
  };
  const material = (
    color: readonly number[],
    metallic: number,
    roughness: number,
    alphaMode: Material3D['alphaMode'] | undefined,
    alphaCutoff: number | undefined,
    map: string | null | undefined,
    mapTexCoord: number | undefined,
    mapTextureTransform: Material3DTextureTransform | null | undefined,
    metallicRoughnessMap: string | null | undefined,
    metallicRoughnessTexCoord: number | undefined,
    metallicRoughnessTextureTransform:
      | Material3DTextureTransform
      | null
      | undefined,
    emissiveFactor: readonly number[] | undefined,
    emissiveStrength: number | undefined,
    unlit: boolean | undefined,
    emissiveMap: string | null | undefined,
    emissiveTexCoord: number | undefined,
    emissiveTextureTransform: Material3DTextureTransform | null | undefined,
  ): number => {
    const mode = alphaMode ?? (color[3] < 1 ? 'blend' : 'opaque');
    const cutoff = alphaCutoff ?? 0.5;
    if (
      color.length !== 4 ||
      ![0, 1].includes(mapTexCoord ?? 0) ||
      ![0, 1].includes(metallicRoughnessTexCoord ?? 0) ||
      ![0, 1].includes(emissiveTexCoord ?? 0) ||
      (emissiveFactor &&
        (emissiveFactor.length !== 3 ||
          emissiveFactor.some(
            (value) => !Number.isFinite(value) || value < 0 || value > 1,
          ))) ||
      (emissiveStrength !== undefined &&
        (!Number.isFinite(emissiveStrength) || emissiveStrength < 0)) ||
      !['opaque', 'mask', 'blend'].includes(mode) ||
      !Number.isFinite(cutoff) ||
      [...color, metallic, roughness].some(
        (n) => !Number.isFinite(n) || n < 0 || n > 1,
      )
    )
      throw new Error('Invalid 3D material');
    const textureIndex = textureIndexFor(map);
    const pbrTextureIndex = textureIndexFor(metallicRoughnessMap);
    const emissiveTextureIndex = textureIndexFor(emissiveMap);
    if (emissiveStrength !== undefined && emissiveStrength !== 1)
      usesEmissiveStrength = true;
    if (unlit) usesUnlit = true;
    const textureInfo = (
      index: number,
      texCoord: number | undefined,
      transform: Material3DTextureTransform | null | undefined,
    ): GlbTextureInfo => {
      if (transform) {
        const offset = transform.offset ?? [0, 0];
        const scale = transform.scale ?? [1, 1];
        if (
          offset.length !== 2 ||
          scale.length !== 2 ||
          ![...offset, ...scale, transform.rotation ?? 0].every(Number.isFinite)
        )
          throw new Error('Invalid 3D texture transform');
        usesTextureTransform = true;
      }
      return {
        index,
        ...(texCoord === 1 ? { texCoord: 1 as const } : {}),
        ...(transform
          ? { extensions: { KHR_texture_transform: transform } }
          : {}),
      };
    };
    return (
      materials.push({
        pbrMetallicRoughness: {
          baseColorFactor: [
            linear(color[0]),
            linear(color[1]),
            linear(color[2]),
            color[3],
          ],
          ...(textureIndex === undefined
            ? {}
            : {
                baseColorTexture: textureInfo(
                  textureIndex,
                  mapTexCoord,
                  mapTextureTransform,
                ),
              }),
          ...(pbrTextureIndex === undefined
            ? {}
            : {
                metallicRoughnessTexture: textureInfo(
                  pbrTextureIndex,
                  metallicRoughnessTexCoord,
                  metallicRoughnessTextureTransform,
                ),
              }),
          metallicFactor: metallic,
          roughnessFactor: roughness,
        },
        alphaMode: mode.toUpperCase() as 'OPAQUE' | 'MASK' | 'BLEND',
        ...(mode === 'mask'
          ? { alphaCutoff: Math.max(0, Math.min(1, cutoff)) }
          : {}),
        doubleSided: true,
        ...(emissiveFactor?.some((value) => value > 0)
          ? { emissiveFactor: [...emissiveFactor] }
          : {}),
        ...(unlit || (emissiveStrength !== undefined && emissiveStrength !== 1)
          ? {
              extensions: {
                ...(emissiveStrength !== undefined && emissiveStrength !== 1
                  ? { KHR_materials_emissive_strength: { emissiveStrength } }
                  : {}),
                ...(unlit ? { KHR_materials_unlit: {} } : {}),
              },
            }
          : {}),
        ...(emissiveTextureIndex === undefined
          ? {}
          : {
              emissiveTexture: textureInfo(
                emissiveTextureIndex,
                emissiveTexCoord,
                emissiveTextureTransform,
              ),
            }),
      }) - 1
    );
  };

  for (const source of sources) {
    const { positions, normals, uvs, uvs1, indices } = source.mesh;
    const count = positions.length / 3;
    if (
      !count ||
      !Number.isInteger(count) ||
      normals.length !== positions.length ||
      (uvs && uvs.length !== count * 2) ||
      (uvs1 && uvs1.length !== count * 2) ||
      !finite(positions) ||
      !finite(normals) ||
      (uvs && !finite(uvs)) ||
      (uvs1 && !finite(uvs1))
    )
      throw new Error('Invalid 3D mesh vertices');
    const triangles = indices
      ? Array.from(indices)
      : Array.from({ length: count }, (_, i) => i);
    if (triangles.length % 3 || triangles.some((i) => i >= count))
      throw new Error('Invalid 3D mesh indices');

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], positions[i + axis]);
        max[axis] = Math.max(max[axis], positions[i + axis]);
      }
    }
    const attributes: Primitive['attributes'] = {
      POSITION: accessor(floats(positions), 34962, 5126, count, 'VEC3', {
        min,
        max,
      }),
      NORMAL: accessor(floats(normals), 34962, 5126, count, 'VEC3'),
    };
    if (uvs)
      attributes.TEXCOORD_0 = accessor(floats(uvs), 34962, 5126, count, 'VEC2');
    if (uvs1)
      attributes.TEXCOORD_1 = accessor(
        floats(uvs1),
        34962,
        5126,
        count,
        'VEC2',
      );
    const textureIfUv = (
      url: string | null | undefined,
      texCoord: number | undefined,
    ) => (((texCoord ?? 0) === 1 ? uvs1 : uvs) ? url : null);

    const frontIndices: number[] = [];
    const sideIndices: number[] = [];
    for (let i = 0; i < triangles.length; i += 3) {
      const face = triangles.slice(i, i + 3);
      const side =
        source.material.sideColor &&
        (face.every((index) => Math.abs(normals[index * 3 + 2]) < 1) ||
          face.some(
            (index) => positions[index * 3 + 2] !== positions[face[0] * 3 + 2],
          ));
      (side ? sideIndices : frontIndices).push(...face);
    }
    const baseMaterial = material(
      source.material.baseColor,
      source.material.metallic,
      source.material.roughness,
      source.material.alphaMode,
      source.material.alphaCutoff,
      textureIfUv(source.material.map, source.material.mapTexCoord),
      source.material.mapTexCoord,
      source.material.mapTextureTransform,
      textureIfUv(
        source.material.metallicRoughnessMap,
        source.material.metallicRoughnessTexCoord,
      ),
      source.material.metallicRoughnessTexCoord,
      source.material.metallicRoughnessTextureTransform,
      source.material.emissiveFactor,
      source.material.emissiveStrength,
      source.material.unlit,
      textureIfUv(
        source.material.emissiveMap,
        source.material.emissiveTexCoord,
      ),
      source.material.emissiveTexCoord,
      source.material.emissiveTextureTransform,
    );
    const primitives: Primitive[] = [];
    const primitive = (faceIndices: number[], materialIndex: number) => {
      if (faceIndices.length)
        primitives.push({
          attributes,
          indices: accessor(
            uints(faceIndices),
            34963,
            5125,
            faceIndices.length,
            'SCALAR',
          ),
          material: materialIndex,
          mode: 4,
        });
    };
    primitive(frontIndices, baseMaterial);
    if (sideIndices.length && source.material.sideColor)
      primitive(
        sideIndices,
        material(
          source.material.sideColor,
          source.material.metallic,
          source.material.roughness,
          source.material.alphaMode,
          source.material.alphaCutoff,
          textureIfUv(source.material.map, source.material.mapTexCoord),
          source.material.mapTexCoord,
          source.material.mapTextureTransform,
          textureIfUv(
            source.material.metallicRoughnessMap,
            source.material.metallicRoughnessTexCoord,
          ),
          source.material.metallicRoughnessTexCoord,
          source.material.metallicRoughnessTextureTransform,
          source.material.emissiveFactor,
          source.material.emissiveStrength,
          source.material.unlit,
          textureIfUv(
            source.material.emissiveMap,
            source.material.emissiveTexCoord,
          ),
          source.material.emissiveTexCoord,
          source.material.emissiveTextureTransform,
        ),
      );

    const pose = source.transform;
    if (
      [...pose.translation, ...pose.rotation, ...pose.scale].some(
        (n) => !Number.isFinite(n),
      )
    )
      throw new Error('Invalid 3D mesh transform');
    const matrix = mat4.create();
    mat4.translate(matrix, matrix, pose.translation);
    mat4.rotateX(matrix, matrix, pose.rotation[0]);
    mat4.rotateY(matrix, matrix, pose.rotation[1]);
    mat4.rotateZ(matrix, matrix, pose.rotation[2]);
    mat4.scale(matrix, matrix, pose.scale);
    if (!finite(matrix)) throw new Error('Invalid 3D mesh transform');
    const meshIndex = meshes.push({ primitives }) - 1;
    const nodeIndex =
      nodes.push({
        name: source.name,
        mesh: meshIndex,
        matrix: Array.from(matrix),
      }) - 1;
    nodes[0].children!.push(nodeIndex);
  }

  const bin = new Uint8Array(align4(byteLength));
  let offset = 0;
  for (const chunk of chunks) {
    bin.set(chunk, offset);
    offset += chunk.length;
  }
  const json = {
    asset: { version: '2.0', generator: 'Infinite Canvas' },
    ...(usesTextureTransform || usesEmissiveStrength || usesUnlit
      ? {
          extensionsUsed: [
            ...(usesTextureTransform ? ['KHR_texture_transform'] : []),
            ...(usesEmissiveStrength
              ? ['KHR_materials_emissive_strength']
              : []),
            ...(usesUnlit ? ['KHR_materials_unlit'] : []),
          ],
        }
      : {}),
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    materials,
    ...(images.length ? { images, textures } : {}),
    buffers: [{ byteLength: bin.length }],
    bufferViews,
    accessors,
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = align4(jsonBytes.length);
  const glb = new Uint8Array(12 + 8 + jsonLength + 8 + bin.length);
  const header = new DataView(glb.buffer);
  header.setUint32(0, 0x46546c67, true); // glTF
  header.setUint32(4, 2, true);
  header.setUint32(8, glb.length, true);
  header.setUint32(12, jsonLength, true);
  header.setUint32(16, 0x4e4f534a, true); // JSON
  glb.fill(0x20, 20, 20 + jsonLength);
  glb.set(jsonBytes, 20);
  const binHeader = 20 + jsonLength;
  header.setUint32(binHeader, bin.length, true);
  header.setUint32(binHeader + 4, 0x004e4942, true); // BIN
  glb.set(bin, binHeader + 8);
  return glb;
}
