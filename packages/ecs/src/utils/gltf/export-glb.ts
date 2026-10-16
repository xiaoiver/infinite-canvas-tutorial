import { mat4 } from 'gl-matrix';
import type { Material3D } from '../../components/geometry3d/Material3D';
import type { Mesh3D } from '../../components/geometry3d/Mesh3D';
import type { Transform3D } from '../../components/geometry3d/Transform3D';

export interface GlbMeshSource {
  mesh: Pick<Mesh3D, 'positions' | 'normals' | 'uvs' | 'indices'>;
  material: Pick<
    Material3D,
    'baseColor' | 'sideColor' | 'metallic' | 'roughness'
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
  attributes: { POSITION: number; NORMAL: number; TEXCOORD_0?: number };
  indices: number;
  material: number;
  mode: 4;
};

const align4 = (length: number) => Math.ceil(length / 4) * 4;
const linear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const finite = (values: ArrayLike<number>): boolean => {
  for (let i = 0; i < values.length; i++)
    if (!Number.isFinite(Math.fround(values[i]))) return false;
  return true;
};

/** Export untextured 3D meshes to a self-contained GLB in glTF's Y-up space. */
export function exportMeshesToGlb(
  sources: readonly GlbMeshSource[],
): Uint8Array {
  if (!sources.length) throw new Error('No 3D meshes to export');

  const chunks: Uint8Array[] = [];
  const bufferViews: {
    buffer: 0;
    byteOffset: number;
    byteLength: number;
    target: 34962 | 34963;
  }[] = [];
  const accessors: Accessor[] = [];
  const materials: {
    pbrMetallicRoughness: {
      baseColorFactor: number[];
      metallicFactor: number;
      roughnessFactor: number;
    };
    alphaMode: 'OPAQUE' | 'BLEND';
    doubleSided: boolean;
  }[] = [];
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
  const append = (bytes: Uint8Array, target: 34962 | 34963): number => {
    const offset = align4(byteLength);
    if (offset > byteLength) chunks.push(new Uint8Array(offset - byteLength));
    chunks.push(bytes);
    byteLength = offset + bytes.length;
    return (
      bufferViews.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: bytes.length,
        target,
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
  const material = (
    color: readonly number[],
    metallic: number,
    roughness: number,
  ): number => {
    if (
      color.length !== 4 ||
      [...color, metallic, roughness].some(
        (n) => !Number.isFinite(n) || n < 0 || n > 1,
      )
    )
      throw new Error('Invalid 3D material');
    return (
      materials.push({
        pbrMetallicRoughness: {
          baseColorFactor: [
            linear(color[0]),
            linear(color[1]),
            linear(color[2]),
            color[3],
          ],
          metallicFactor: metallic,
          roughnessFactor: roughness,
        },
        alphaMode: color[3] < 1 ? 'BLEND' : 'OPAQUE',
        doubleSided: true,
      }) - 1
    );
  };

  for (const source of sources) {
    const { positions, normals, uvs, indices } = source.mesh;
    const count = positions.length / 3;
    if (
      !count ||
      !Number.isInteger(count) ||
      normals.length !== positions.length ||
      (uvs && uvs.length !== count * 2) ||
      !finite(positions) ||
      !finite(normals) ||
      (uvs && !finite(uvs))
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
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    materials,
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
