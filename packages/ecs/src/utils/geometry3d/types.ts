export interface Mesh3DGeometryData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Optional (u, v) texture coordinates, interleaved. */
  uvs?: Float32Array;
}

export type Mesh3DGeometrySpec =
  | { type: 'cube' }
  | { type: 'sphere'; segments?: [number, number] }
  | { type: 'cylinder'; segments?: number; cap?: boolean }
  | { type: 'plane' }
  | { type: 'gltf'; url: string; mesh?: number };

/** Shorthand primitive name or full parametric spec. */
export type Mesh3DNodeGeometry = Mesh3DGeometrySpec['type'] | Mesh3DGeometrySpec;

const PRIMITIVE_TYPES = new Set<Mesh3DGeometrySpec['type']>([
  'cube',
  'sphere',
  'cylinder',
  'plane',
]);

export function isGltfGeometrySpec(
  spec: Mesh3DGeometrySpec,
): spec is Extract<Mesh3DGeometrySpec, { type: 'gltf' }> {
  return spec.type === 'gltf';
}

export function emptyMesh3DGeometry(): Mesh3DGeometryData {
  return {
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
  };
}

/** Compare primitive geometry buffers (used to pick up generator fixes without spec key bumps). */
export function mesh3DGeometryDataEquals(
  mesh: Mesh3DGeometryData,
  data: Mesh3DGeometryData,
): boolean {
  if (mesh.positions.length !== data.positions.length) {
    return false;
  }
  if (mesh.normals.length !== data.normals.length) {
    return false;
  }
  if ((mesh.uvs?.length ?? 0) !== (data.uvs?.length ?? 0)) {
    return false;
  }
  if ((mesh.indices?.length ?? 0) !== (data.indices?.length ?? 0)) {
    return false;
  }
  for (let i = 0; i < mesh.positions.length; i++) {
    if (mesh.positions[i] !== data.positions[i]) {
      return false;
    }
  }
  if (mesh.uvs && data.uvs) {
    for (let i = 0; i < mesh.uvs.length; i++) {
      if (mesh.uvs[i] !== data.uvs[i]) {
        return false;
      }
    }
  }
  return true;
}

export function normalizeGeometry(
  geometry: Mesh3DNodeGeometry | undefined,
): Mesh3DGeometrySpec {
  if (geometry == null) {
    return { type: 'cube' };
  }
  if (typeof geometry === 'string') {
    if (geometry === 'gltf' || !PRIMITIVE_TYPES.has(geometry as Mesh3DGeometrySpec['type'])) {
      return { type: 'cube' };
    }
    return { type: geometry as Exclude<Mesh3DGeometrySpec['type'], 'gltf'> };
  }
  return geometry;
}

export function geometrySpecKey(spec: Mesh3DGeometrySpec): string {
  return JSON.stringify(spec);
}

export function geometrySpecsEqual(
  a: Mesh3DGeometrySpec,
  b: Mesh3DGeometrySpec,
): boolean {
  return geometrySpecKey(a) === geometrySpecKey(b);
}
