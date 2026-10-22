export type GltfContainer = {
  json: {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
  };
  buffers: { arrayBuffer: ArrayBuffer; byteOffset?: number }[];
};

type Accessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  normalized?: boolean;
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: number };
    values: { bufferView: number; byteOffset?: number };
  };
};

type AccessorData = {
  array: Float32Array | Uint32Array | Uint16Array | Uint8Array;
  components: number;
};

function componentCount(type: string): number {
  return type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : type === 'VEC4' ? 4 : 3;
}

function readAccessorData(gltf: GltfContainer, acc: Accessor): AccessorData {
  if (acc.bufferView === undefined)
    throw new Error('glTF accessor has no bufferView');
  const bv = gltf.json.bufferViews[acc.bufferView] as {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  };
  if (!bv) throw new Error('glTF accessor bufferView missing');
  const buf = gltf.buffers[bv.buffer];
  if (!buf?.arrayBuffer) {
    throw new Error('glTF buffer missing (external .bin not loaded?)');
  }
  const base =
    (buf.byteOffset ?? 0) + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const ab = buf.arrayBuffer;

  const comps = componentCount(acc.type);

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

  if (
    acc.type === 'VEC2' &&
    acc.normalized &&
    (acc.componentType === 5121 || acc.componentType === 5123)
  ) {
    const short = acc.componentType === 5123;
    const stride = bv.byteStride ?? (short ? 4 : 2);
    const view = new DataView(ab);
    const out = new Float32Array(acc.count * 2);
    for (let i = 0; i < acc.count; i++) {
      const offset = base + i * stride;
      out[i * 2] =
        (short ? view.getUint16(offset, true) : view.getUint8(offset)) /
        (short ? 65535 : 255);
      out[i * 2 + 1] =
        (short ? view.getUint16(offset + 2, true) : view.getUint8(offset + 1)) /
        (short ? 65535 : 255);
    }
    return { array: out, components: 2 };
  }

  if (
    (acc.type === 'VEC3' || acc.type === 'VEC4') &&
    acc.normalized &&
    (acc.componentType === 5121 || acc.componentType === 5123)
  ) {
    const short = acc.componentType === 5123;
    const size = short ? 2 : 1;
    const stride = bv.byteStride ?? comps * size;
    const view = new DataView(ab);
    const out = new Float32Array(acc.count * comps);
    for (let i = 0; i < acc.count; i++) {
      const offset = base + i * stride;
      for (let c = 0; c < comps; c++)
        out[i * comps + c] =
          (short
            ? view.getUint16(offset + c * size, true)
            : view.getUint8(offset + c)) / (short ? 65535 : 255);
    }
    return { array: out, components: comps };
  }

  if (
    acc.componentType === 5126 &&
    (acc.type === 'VEC3' || acc.type === 'VEC4')
  ) {
    const count = acc.count;
    const elementSize = comps * 4;
    const stride = bv.byteStride ?? elementSize;
    if (stride === elementSize) {
      return {
        array: new Float32Array(ab, base, count * comps),
        components: comps,
      };
    }
    const out = new Float32Array(count * comps);
    const view = new DataView(ab);
    let off = base;
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < comps; c++)
        out[i * comps + c] = view.getFloat32(off + c * 4, true);
      off += stride;
    }
    return { array: out, components: comps };
  }

  if (acc.componentType === 5123) {
    return {
      array: new Uint16Array(ab, base, acc.count * comps),
      components: comps,
    };
  }
  if (acc.componentType === 5121) {
    return {
      array: new Uint8Array(ab, base, acc.count * comps),
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

function zeroAccessor(acc: Accessor): AccessorData {
  const components = componentCount(acc.type);
  const length = acc.count * components;
  if (
    acc.componentType === 5126 ||
    (acc.normalized && [5121, 5123].includes(acc.componentType))
  )
    return { array: new Float32Array(length), components };
  if (acc.componentType === 5121)
    return { array: new Uint8Array(length), components };
  if (acc.componentType === 5123)
    return { array: new Uint16Array(length), components };
  if (acc.componentType === 5125)
    return { array: new Uint32Array(length), components };
  throw new Error(
    `Unsupported glTF accessor type ${acc.type} / component ${acc.componentType}`,
  );
}

export function readAccessor(
  gltf: GltfContainer,
  accessorIndex: number,
): AccessorData {
  const acc = gltf.json.accessors[accessorIndex] as Accessor;
  if (!acc) throw new Error('glTF accessor missing');
  const sparse = acc.sparse;
  if (!sparse) return readAccessorData(gltf, acc);
  if (
    !Number.isInteger(sparse.count) ||
    sparse.count < 1 ||
    sparse.count > acc.count ||
    ![5121, 5123, 5125].includes(sparse.indices.componentType)
  )
    throw new Error('Invalid glTF sparse accessor');

  const base =
    acc.bufferView === undefined
      ? zeroAccessor(acc)
      : readAccessorData(gltf, acc);
  const indices = readAccessorData(gltf, {
    bufferView: sparse.indices.bufferView,
    byteOffset: sparse.indices.byteOffset,
    componentType: sparse.indices.componentType,
    count: sparse.count,
    type: 'SCALAR',
  }).array;
  const values = readAccessorData(gltf, {
    bufferView: sparse.values.bufferView,
    byteOffset: sparse.values.byteOffset,
    componentType: acc.componentType,
    count: sparse.count,
    type: acc.type,
    normalized: acc.normalized,
  }).array;
  // Dense accessors can view a shared glTF buffer. Never patch the source bytes.
  const array = base.array.slice();
  let previous = -1;
  for (let i = 0; i < sparse.count; i++) {
    const index = indices[i];
    if (index <= previous || index >= acc.count)
      throw new Error('Invalid glTF sparse accessor index');
    for (let component = 0; component < base.components; component++) {
      array[index * base.components + component] =
        values[i * base.components + component];
    }
    previous = index;
  }
  return { array, components: base.components };
}
