import { parsePly } from '../../packages/plugin-gsplat/src/parsers/ply';
import {
  SH_C0,
  shDcToColor,
  sigmoid,
} from '../../packages/plugin-gsplat/src/math/sh';

/** Property layout matching the INRIA / SuperSplat 3DGS PLY export. */
const PROPS = [
  'x',
  'y',
  'z',
  'nx',
  'ny',
  'nz',
  'f_dc_0',
  'f_dc_1',
  'f_dc_2',
  'opacity',
  'scale_0',
  'scale_1',
  'scale_2',
  'rot_0',
  'rot_1',
  'rot_2',
  'rot_3',
];

function buildBinaryPly(vertices: number[][]): ArrayBuffer {
  const header =
    `ply\n` +
    `format binary_little_endian 1.0\n` +
    `element vertex ${vertices.length}\n` +
    PROPS.map((p) => `property float ${p}\n`).join('') +
    `end_header\n`;
  const headerBytes = new TextEncoder().encode(header);
  const stride = PROPS.length * 4;
  const buf = new ArrayBuffer(headerBytes.length + vertices.length * stride);
  new Uint8Array(buf).set(headerBytes, 0);
  const dv = new DataView(buf, headerBytes.length);
  vertices.forEach((row, i) => {
    row.forEach((v, j) => dv.setFloat32(i * stride + j * 4, v, true));
  });
  return buf;
}

describe('parsePly', () => {
  // f_dc, opacity (logit) and scales (log) per the reference decoding.
  const v0 = [
    1, 2, 3, // xyz
    0, 0, 0, // normals (ignored)
    1.0, -1.0, 0.5, // f_dc
    2.0, // opacity logit -> sigmoid
    Math.log(0.1), Math.log(0.2), Math.log(0.3), // log scales
    1, 0, 0, 0, // quaternion (w, x, y, z)
  ];

  it('parses a binary_little_endian 3DGS PLY', () => {
    const data = parsePly(buildBinaryPly([v0]));

    expect(data.count).toBe(1);
    expect(Array.from(data.centers)).toEqual([1, 2, 3]);

    // Scales decoded with exp().
    expect(data.scales[0]).toBeCloseTo(0.1, 5);
    expect(data.scales[1]).toBeCloseTo(0.2, 5);
    expect(data.scales[2]).toBeCloseTo(0.3, 5);

    // Colors decoded via SH degree-0 and clamped.
    expect(data.colors[0]).toBeCloseTo(shDcToColor(1.0), 5);
    expect(data.colors[1]).toBeCloseTo(shDcToColor(-1.0), 5);
    expect(data.colors[2]).toBeCloseTo(0.5 + SH_C0 * 0.5, 5);

    // Opacity decoded via sigmoid.
    expect(data.colors[3]).toBeCloseTo(sigmoid(2.0), 5);

    // Quaternion (w,x,y,z)=(1,0,0,0) re-emitted as (x,y,z,w)=(0,0,0,1).
    expect(Array.from(data.rotations)).toEqual([0, 0, 0, 1]);
  });

  it('parses an ascii 3DGS PLY identically', () => {
    const header =
      `ply\n` +
      `format ascii 1.0\n` +
      `element vertex 1\n` +
      PROPS.map((p) => `property float ${p}\n`).join('') +
      `end_header\n`;
    const body = v0.join(' ') + '\n';
    const buf = new TextEncoder().encode(header + body).buffer;

    const data = parsePly(buf as ArrayBuffer);
    expect(data.count).toBe(1);
    expect(Array.from(data.centers)).toEqual([1, 2, 3]);
    expect(data.scales[0]).toBeCloseTo(0.1, 5);
    expect(data.colors[3]).toBeCloseTo(sigmoid(2.0), 5);
  });

  it('throws on a missing required property', () => {
    const header =
      `ply\nformat binary_little_endian 1.0\nelement vertex 0\n` +
      `property float x\nproperty float y\nproperty float z\nend_header\n`;
    const buf = new TextEncoder().encode(header).buffer;
    expect(() => parsePly(buf as ArrayBuffer)).toThrow(/scale_0/);
  });
});
