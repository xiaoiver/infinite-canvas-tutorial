import { GsplatData } from '../GsplatData';
import { shDcToColor, sigmoid } from '../math/sh';

/** PLY scalar property types mapped to byte sizes and DataView readers. */
const PLY_TYPES: Record<
  string,
  { size: number; read: (dv: DataView, off: number, le: boolean) => number }
> = {
  char: { size: 1, read: (dv, o) => dv.getInt8(o) },
  int8: { size: 1, read: (dv, o) => dv.getInt8(o) },
  uchar: { size: 1, read: (dv, o) => dv.getUint8(o) },
  uint8: { size: 1, read: (dv, o) => dv.getUint8(o) },
  short: { size: 2, read: (dv, o, le) => dv.getInt16(o, le) },
  int16: { size: 2, read: (dv, o, le) => dv.getInt16(o, le) },
  ushort: { size: 2, read: (dv, o, le) => dv.getUint16(o, le) },
  uint16: { size: 2, read: (dv, o, le) => dv.getUint16(o, le) },
  int: { size: 4, read: (dv, o, le) => dv.getInt32(o, le) },
  int32: { size: 4, read: (dv, o, le) => dv.getInt32(o, le) },
  uint: { size: 4, read: (dv, o, le) => dv.getUint32(o, le) },
  uint32: { size: 4, read: (dv, o, le) => dv.getUint32(o, le) },
  float: { size: 4, read: (dv, o, le) => dv.getFloat32(o, le) },
  float32: { size: 4, read: (dv, o, le) => dv.getFloat32(o, le) },
  double: { size: 8, read: (dv, o, le) => dv.getFloat64(o, le) },
  float64: { size: 8, read: (dv, o, le) => dv.getFloat64(o, le) },
};

interface PlyProperty {
  name: string;
  type: string;
}

interface PlyHeader {
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
  vertexCount: number;
  properties: PlyProperty[];
  headerLength: number;
}

const HEADER_END = 'end_header';

function parseHeader(bytes: Uint8Array): PlyHeader {
  // Header is ASCII; find the byte offset just past the "end_header\n" line.
  const decoder = new TextDecoder('ascii');
  // Limit decode to a reasonable header window to avoid decoding huge bodies.
  const window = bytes.subarray(0, Math.min(bytes.length, 1 << 16));
  const text = decoder.decode(window);
  const endIdx = text.indexOf(HEADER_END);
  if (endIdx < 0) {
    throw new Error('parsePly: missing end_header');
  }
  // Account for the newline after end_header.
  const afterEnd = text.indexOf('\n', endIdx);
  const headerLength = afterEnd >= 0 ? afterEnd + 1 : endIdx + HEADER_END.length;

  const lines = text.slice(0, endIdx).split(/\r?\n/);
  let format: PlyHeader['format'] | undefined;
  let vertexCount = 0;
  let inVertexElement = false;
  const properties: PlyProperty[] = [];

  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    const keyword = tokens[0];
    if (keyword === 'format') {
      format = tokens[1] as PlyHeader['format'];
    } else if (keyword === 'element') {
      inVertexElement = tokens[1] === 'vertex';
      if (inVertexElement) {
        vertexCount = parseInt(tokens[2], 10);
      }
    } else if (keyword === 'property' && inVertexElement) {
      // "property <type> <name>"; list properties are unsupported for vertices.
      if (tokens[1] === 'list') {
        throw new Error('parsePly: list properties on vertex are unsupported');
      }
      properties.push({ type: tokens[1], name: tokens[2] });
    }
  }

  if (!format) {
    throw new Error('parsePly: missing format line');
  }
  return { format, vertexCount, properties, headerLength };
}

/**
 * Parse a 3D Gaussian Splatting `.ply` file (INRIA reference / SuperSplat
 * export) into {@link GsplatData}.
 *
 * Recognised per-vertex properties: `x y z`, `scale_0..2` (log scale),
 * `rot_0..3` (quaternion, `rot_0 = w`), `opacity` (logit), and `f_dc_0..2`
 * (degree-0 SH color). Normals and higher-order `f_rest_*` bands are ignored in
 * this MVP. Both ASCII and binary (little/big endian) bodies are supported.
 *
 * @see https://github.com/graphdeco-inria/gaussian-splatting
 */
export function parsePly(buffer: ArrayBuffer): GsplatData {
  const bytes = new Uint8Array(buffer);
  const header = parseHeader(bytes);
  const { format, vertexCount, properties, headerLength } = header;

  const index: Record<string, number> = {};
  properties.forEach((p, i) => {
    index[p.name] = i;
  });

  const need = (name: string): number => {
    const i = index[name];
    if (i === undefined) {
      throw new Error(`parsePly: missing required property "${name}"`);
    }
    return i;
  };

  const xi = need('x');
  const yi = need('y');
  const zi = need('z');
  const s0 = need('scale_0');
  const s1 = need('scale_1');
  const s2 = need('scale_2');
  const r0 = need('rot_0');
  const r1 = need('rot_1');
  const r2 = need('rot_2');
  const r3 = need('rot_3');
  const oi = need('opacity');
  const c0 = need('f_dc_0');
  const c1 = need('f_dc_1');
  const c2 = need('f_dc_2');

  const centers = new Float32Array(vertexCount * 3);
  const scales = new Float32Array(vertexCount * 3);
  const rotations = new Float32Array(vertexCount * 4);
  const colors = new Float32Array(vertexCount * 4);

  const emit = (i: number, row: number[]): void => {
    centers[i * 3 + 0] = row[xi];
    centers[i * 3 + 1] = row[yi];
    centers[i * 3 + 2] = row[zi];

    scales[i * 3 + 0] = Math.exp(row[s0]);
    scales[i * 3 + 1] = Math.exp(row[s1]);
    scales[i * 3 + 2] = Math.exp(row[s2]);

    colors[i * 4 + 0] = shDcToColor(row[c0]);
    colors[i * 4 + 1] = shDcToColor(row[c1]);
    colors[i * 4 + 2] = shDcToColor(row[c2]);
    colors[i * 4 + 3] = sigmoid(row[oi]);

    // PLY packs the quaternion as (w, x, y, z); re-emit as (x, y, z, w).
    const qw = row[r0];
    const qx = row[r1];
    const qy = row[r2];
    const qz = row[r3];
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    rotations[i * 4 + 0] = qx / len;
    rotations[i * 4 + 1] = qy / len;
    rotations[i * 4 + 2] = qz / len;
    rotations[i * 4 + 3] = qw / len;
  };

  if (format === 'ascii') {
    const text = new TextDecoder('ascii').decode(bytes.subarray(headerLength));
    const lines = text.split(/\r?\n/);
    let read = 0;
    for (let li = 0; li < lines.length && read < vertexCount; li++) {
      const line = lines[li].trim();
      if (!line) continue;
      const row = line.split(/\s+/).map(Number);
      emit(read, row);
      read++;
    }
    if (read !== vertexCount) {
      throw new Error(
        `parsePly: expected ${vertexCount} vertices, parsed ${read}`,
      );
    }
  } else {
    const le = format === 'binary_little_endian';
    const dv = new DataView(buffer, headerLength);

    let stride = 0;
    const readers = properties.map((p) => {
      const t = PLY_TYPES[p.type];
      if (!t) {
        throw new Error(`parsePly: unsupported property type "${p.type}"`);
      }
      const offset = stride;
      stride += t.size;
      return { offset, read: t.read };
    });

    const required = headerLength + stride * vertexCount;
    if (buffer.byteLength < required) {
      throw new Error(
        `parsePly: truncated body (need ${required} bytes, have ${buffer.byteLength})`,
      );
    }

    const row = new Array<number>(properties.length);
    for (let i = 0; i < vertexCount; i++) {
      const base = i * stride;
      for (let p = 0; p < readers.length; p++) {
        row[p] = readers[p].read(dv, base + readers[p].offset, le);
      }
      emit(i, row);
    }
  }

  return new GsplatData({ count: vertexCount, centers, scales, rotations, colors });
}
