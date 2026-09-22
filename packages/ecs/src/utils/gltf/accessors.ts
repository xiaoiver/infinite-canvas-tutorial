export type GltfContainer = {
  json: {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
  };
  buffers: { arrayBuffer: ArrayBuffer; byteOffset?: number }[];
};

export function readAccessor(
  gltf: GltfContainer,
  accessorIndex: number,
): { array: Float32Array | Uint32Array | Uint16Array; components: number } {
  const acc = gltf.json.accessors[accessorIndex] as {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
  };
  const bv = gltf.json.bufferViews[acc.bufferView] as {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  };
  const buf = gltf.buffers[bv.buffer];
  if (!buf?.arrayBuffer) {
    throw new Error('glTF buffer missing (external .bin not loaded?)');
  }
  const base =
    (buf.byteOffset ?? 0) + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const ab = buf.arrayBuffer;

  const comps =
    acc.type === 'SCALAR'
      ? 1
      : acc.type === 'VEC2'
        ? 2
        : acc.type === 'VEC3'
          ? 3
          : acc.type === 'VEC4'
            ? 4
            : 3;

  if (acc.componentType === 5126 && acc.type === 'VEC2') {
    const count = acc.count;
    const stride = bv.byteStride ?? 8;
    if (stride === 8) {
      return {
        array: new Float32Array(ab, base, count * 2),
        components: 2,
      };
    }
    const out = new Float32Array(count * 2);
    const view = new DataView(ab);
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 2] = view.getFloat32(off, true);
      out[i * 2 + 1] = view.getFloat32(off + 4, true);
      off += stride;
    }
    return { array: out, components: 2 };
  }

  if (acc.componentType === 5126 && acc.type === 'VEC3') {
    const count = acc.count;
    const stride = bv.byteStride ?? 12;
    if (stride === 12) {
      return {
        array: new Float32Array(ab, base, count * 3),
        components: 3,
      };
    }
    const out = new Float32Array(count * 3);
    const view = new DataView(ab);
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 3] = view.getFloat32(off, true);
      out[i * 3 + 1] = view.getFloat32(off + 4, true);
      out[i * 3 + 2] = view.getFloat32(off + 8, true);
      off += stride;
    }
    return { array: out, components: 3 };
  }

  if (acc.componentType === 5123) {
    return {
      array: new Uint16Array(ab, base, acc.count * comps),
      components: comps,
    };
  }
  if (acc.componentType === 5125) {
    return {
      array: new Uint32Array(ab, base, acc.count * comps),
      components: comps,
    };
  }
  throw new Error(
    `Unsupported glTF accessor type ${acc.type} / component ${acc.componentType}`,
  );
}
