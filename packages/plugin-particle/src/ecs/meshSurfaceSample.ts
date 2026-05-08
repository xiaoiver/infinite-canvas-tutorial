/**
 * glTF / OBJ → 三角网格 → 表面采样（面积加权 / 按三角个数均分）→ vec4 点云（xyzw，w=1）
 */
import { parse } from '@loaders.gl/core';
import { DracoLoader } from '@loaders.gl/draco';
import { GLTFLoader } from '@loaders.gl/gltf';
import { OBJLoader } from '@loaders.gl/obj';

export const DEFAULT_MESH_SAMPLE_COUNT = 12_000;

/**
 * 表面粒子 CPU 采样策略。
 * - **area**：按三角面积加权选三角，再三角内均匀（默认；大面粒子多）。
 * - **perTriangle**：总粒子按三角**个数**均分，每三角约 `N/T` 个，再三角内随机（小脸与大脸粒子数接近）。
 */
export type MeshSurfaceSampleStrategy = 'area' | 'perTriangle';

/** 并集网格：有 indices 则为索引三角；无则为每 9 个 float 一个三角形（三个顶点 xyz） */
export interface MeshTriangleSoup {
  positions: Float32Array;
  indices: Uint32Array | null;
  /** 与 positions 同顶点序，每顶点 RGBA（线性），无顶点色时为 null */
  colors: Float32Array | null;
  hasVertexColor: boolean;
  /** 与 positions 同顶点序，每顶点 UV（glTF TEXCOORD_0）；无则 null */
  uvs: Float32Array | null;
  /** 是否至少有一个 primitive 提供了 TEXCOORD_0（其余缺省补 0） */
  hasTexCoord0: boolean;
  /**
   * 首个带 `baseColorTexture` 的材质之 `baseColorFactor`（线性 RGBA），无则 [1,1,1,1]。
   * GPU 采样路径下与贴图相乘。
   */
  baseColorFactor: readonly [number, number, number, number];
  /**
   * 解码后的首张 baseColor 贴图（由 {@link loadMeshTriangleSoupFromFile} 在 `loadImages` 下填充）。
   * **`EcsMeshParticle` 多次 `setMeshSoup` 会复用同一指针，勿在上传中间 `close()`；**
   * 换模型、永久丢弃 soup 时再 `close()` 以释内存。
   */
  baseColorImage?: ImageBitmap;
  /** 解析 glTF 时临时写入，指向 `gltf.images` 下标；loader 解码后可忽略 */
  baseColorImageIndex?: number;
}

/** {@link sampleMeshSurfaceUniform} 的输出 */
export interface MeshSurfaceSampleResult {
  positions: Float32Array;
  colors: Float32Array;
  hasVertexColor: boolean;
  /** 每粒子 2D UV（重心插值）；无网格 UV 时为全 0 */
  uvs: Float32Array;
  /** 网格是否提供可用 UV（长度与顶点一致） */
  hasMeshUvs: boolean;
}

function whiteColors(vertexCount: number): Float32Array {
  const c = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) {
    c[i * 4] = 1;
    c[i * 4 + 1] = 1;
    c[i * 4 + 2] = 1;
    c[i * 4 + 3] = 1;
  }
  return c;
}

/** 与 glTF `materials[].pbrMetallicRoughness.baseColorFactor` 对齐（线性 RGBA） */
function solidVertexColors(
  vertexCount: number,
  rgba: readonly [number, number, number, number],
): Float32Array {
  const c = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) {
    c[i * 4] = rgba[0];
    c[i * 4 + 1] = rgba[1];
    c[i * 4 + 2] = rgba[2];
    c[i * 4 + 3] = rgba[3];
  }
  return c;
}

/** 仅当 JSON 中显式写了 `baseColorFactor` 时返回（未写则走默认 PBR，不当作顶点色） */
function readMaterialBaseColorFactor(
  json: {
    materials?: {
      pbrMetallicRoughness?: {
        baseColorFactor?: number[];
      };
    }[];
  },
  materialIndex: number | undefined,
): [number, number, number, number] | null {
  if (materialIndex === undefined) {
    return null;
  }
  const mat = json.materials?.[materialIndex];
  const pbr = mat?.pbrMetallicRoughness;
  if (!pbr || !Object.prototype.hasOwnProperty.call(pbr, 'baseColorFactor')) {
    return null;
  }
  const f = pbr.baseColorFactor;
  if (!f || f.length < 3) {
    return null;
  }
  const a = f.length >= 4 ? f[3]! : 1;
  return [f[0]!, f[1]!, f[2]!, a];
}

/** glTF 材质 `baseColorFactor`（未写则视为 [1,1,1,1]） */
function materialBaseColorTintLinear(
  json: {
    materials?: {
      pbrMetallicRoughness?: { baseColorFactor?: number[] };
    }[];
  },
  materialIndex: number | undefined,
): readonly [number, number, number, number] {
  if (materialIndex === undefined) {
    return [1, 1, 1, 1];
  }
  const f = json.materials?.[materialIndex]?.pbrMetallicRoughness?.baseColorFactor;
  if (!f || f.length < 3) {
    return [1, 1, 1, 1];
  }
  return [f[0]!, f[1]!, f[2]!, f.length >= 4 ? f[3]! : 1];
}

function baseColorTextureImageIndex(
  json: {
    materials?: {
      pbrMetallicRoughness?: { baseColorTexture?: { index?: number } };
    }[];
    textures?: { source?: number }[];
  },
  materialIndex: number | undefined,
): number | undefined {
  if (materialIndex === undefined) {
    return undefined;
  }
  const ti =
    json.materials?.[materialIndex]?.pbrMetallicRoughness?.baseColorTexture
      ?.index;
  if (ti === undefined) {
    return undefined;
  }
  return json.textures?.[ti]?.source;
}

/**
 * 共用 glTF 解析选项（Draco + 解码 JSON 内 data: base64 buffer）。
 * 使用 `parse(file, GLTFLoader, …)`（`@loaders.gl/core`）而非仅 `GLTFLoader.parse(string)`，
 * 以便单文件 **glTF Embedded**（无外链 .bin）与 **GLB** 走完整异步解码路径。
 */
const GLTF_LOAD_OPTIONS = {
  gltf: {
    loadImages: true,
    decompressMeshes: true,
    loadBuffers: true,
  },
  DracoLoader,
} as const;

function triangleCount(mesh: MeshTriangleSoup): number {
  if (mesh.indices) {
    return Math.floor(mesh.indices.length / 3);
  }
  return Math.floor(mesh.positions.length / 9);
}

/**
 * 开发时在控制台打印三角数、顶点坐标范围。若 `triangleCount === 0` 且文件是 glTF，
 * 常见于 **Draco / KHR_draco_mesh_compression**：当前示例未注册 Draco 解码器，需换未压缩 GLB 或 OBJ。
 */
export function logMeshTriangleSoupDiagnostics(
  soup: MeshTriangleSoup,
  label = '[MeshTriangleSoup]',
): void {
  const nt = triangleCount(soup);
  const p = soup.positions;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const hasBounds = p.length >= 3 && Number.isFinite(minX);
  console.info(label, {
    triangleCount: nt,
    positionFloats: p.length,
    indexCount: soup.indices?.length ?? 0,
    vertexBounds: hasBounds
      ? { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
      : null,
    hasVertexColor: soup.hasVertexColor,
    hasTexCoord0: soup.hasTexCoord0,
    hasBaseColorTexture: !!soup.baseColorImage,
    hint:
      nt === 0
        ? 'No triangles parsed — try another GLB/OBJ, or ensure Draco extension can load (WASM).'
        : undefined,
  });
}

/** loaders.gl `gltf.images[i]` → `ImageBitmap`（浏览器） */
export async function gltfImageEntryToBitmap(
  img: unknown,
): Promise<ImageBitmap | undefined> {
  if (img == null) {
    return undefined;
  }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return img;
  }
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    if (!img.complete || img.naturalWidth === 0) {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('glTF image decode failed'));
      });
    }
    return createImageBitmap(img);
  }
  if (typeof ImageBitmap !== 'undefined' && img instanceof Blob) {
    return createImageBitmap(img);
  }
  return undefined;
}

/** 三角形三个顶点的 RGBA，写入 out[0..11] */
function triangleCornerColors(
  mesh: MeshTriangleSoup,
  triIndex: number,
  out: Float32Array,
): void {
  if (!mesh.colors || !mesh.hasVertexColor) {
    for (let k = 0; k < 3; k++) {
      out[k * 4] = 1;
      out[k * 4 + 1] = 1;
      out[k * 4 + 2] = 1;
      out[k * 4 + 3] = 1;
    }
    return;
  }
  const c = mesh.colors;
  if (mesh.indices) {
    const i0 = mesh.indices[triIndex * 3];
    const i1 = mesh.indices[triIndex * 3 + 1];
    const i2 = mesh.indices[triIndex * 3 + 2];
    out.set(c.subarray(i0 * 4, i0 * 4 + 4), 0);
    out.set(c.subarray(i1 * 4, i1 * 4 + 4), 4);
    out.set(c.subarray(i2 * 4, i2 * 4 + 4), 8);
  } else {
    const i0 = triIndex * 3;
    const i1 = triIndex * 3 + 1;
    const i2 = triIndex * 3 + 2;
    out.set(c.subarray(i0 * 4, i0 * 4 + 4), 0);
    out.set(c.subarray(i1 * 4, i1 * 4 + 4), 4);
    out.set(c.subarray(i2 * 4, i2 * 4 + 4), 8);
  }
}

/** 三角形三个顶点的 UV，写入 out[0..5]（u0,v0,u1,v1,u2,v2） */
function triangleCornerUVs(
  mesh: MeshTriangleSoup,
  triIndex: number,
  out: Float32Array,
): void {
  if (!mesh.uvs) {
    out.fill(0);
    return;
  }
  const u = mesh.uvs;
  if (mesh.indices) {
    const i0 = mesh.indices[triIndex * 3];
    const i1 = mesh.indices[triIndex * 3 + 1];
    const i2 = mesh.indices[triIndex * 3 + 2];
    out[0] = u[i0 * 2];
    out[1] = u[i0 * 2 + 1];
    out[2] = u[i1 * 2];
    out[3] = u[i1 * 2 + 1];
    out[4] = u[i2 * 2];
    out[5] = u[i2 * 2 + 1];
  } else {
    const i0 = triIndex * 3;
    const i1 = triIndex * 3 + 1;
    const i2 = triIndex * 3 + 2;
    out[0] = u[i0 * 2];
    out[1] = u[i0 * 2 + 1];
    out[2] = u[i1 * 2];
    out[3] = u[i1 * 2 + 1];
    out[4] = u[i2 * 2];
    out[5] = u[i2 * 2 + 1];
  }
}

function trianglePositions(
  mesh: MeshTriangleSoup,
  triIndex: number,
  out: Float32Array,
): void {
  const p = mesh.positions;
  if (mesh.indices) {
    const i0 = mesh.indices[triIndex * 3] * 3;
    const i1 = mesh.indices[triIndex * 3 + 1] * 3;
    const i2 = mesh.indices[triIndex * 3 + 2] * 3;
    out.set(p.subarray(i0, i0 + 3), 0);
    out.set(p.subarray(i1, i1 + 3), 3);
    out.set(p.subarray(i2, i2 + 3), 6);
  } else {
    const o = triIndex * 9;
    out.set(p.subarray(o, o + 9), 0);
  }
}

function triangleArea(a: Float32Array): number {
  const ax = a[3] - a[0];
  const ay = a[4] - a[1];
  const az = a[5] - a[2];
  const bx = a[6] - a[0];
  const by = a[7] - a[1];
  const bz = a[8] - a[2];
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

function randomBarycentric(r1: number, r2: number, out: Float32Array): void {
  const sr = Math.sqrt(r1);
  out[0] = 1 - sr;
  out[1] = sr * (1 - r2);
  out[2] = sr * r2;
}

/** 在三角 `triIndex` 内随机一点，写入第 `outIndex` 个粒子 */
function writeOneMeshSurfaceSample(
  mesh: MeshTriangleSoup,
  triIndex: number,
  outIndex: number,
  out: Float32Array,
  outC: Float32Array,
  outUv: Float32Array,
  corner: Float32Array,
  bary: Float32Array,
  cornerC: Float32Array,
  cornerUv: Float32Array,
  useVc: boolean,
  hasMeshUvs: boolean,
  rng: () => number,
): void {
  trianglePositions(mesh, triIndex, corner);
  randomBarycentric(rng(), rng(), bary);
  const x =
    bary[0] * corner[0] + bary[1] * corner[3] + bary[2] * corner[6];
  const y =
    bary[0] * corner[1] + bary[1] * corner[4] + bary[2] * corner[7];
  const z =
    bary[0] * corner[2] + bary[1] * corner[5] + bary[2] * corner[8];
  const i = outIndex;
  out[i * 4] = x;
  out[i * 4 + 1] = y;
  out[i * 4 + 2] = z;
  out[i * 4 + 3] = 1;

  if (hasMeshUvs) {
    triangleCornerUVs(mesh, triIndex, cornerUv);
    const u =
      bary[0] * cornerUv[0] +
      bary[1] * cornerUv[2] +
      bary[2] * cornerUv[4];
    const v =
      bary[0] * cornerUv[1] +
      bary[1] * cornerUv[3] +
      bary[2] * cornerUv[5];
    outUv[i * 2] = u;
    outUv[i * 2 + 1] = v;
  }

  if (useVc) {
    triangleCornerColors(mesh, triIndex, cornerC);
    const r =
      bary[0] * cornerC[0] +
      bary[1] * cornerC[4] +
      bary[2] * cornerC[8];
    const g =
      bary[0] * cornerC[1] +
      bary[1] * cornerC[5] +
      bary[2] * cornerC[9];
    const b =
      bary[0] * cornerC[2] +
      bary[1] * cornerC[6] +
      bary[2] * cornerC[10];
    outC[i * 4] = clamp01(r);
    outC[i * 4 + 1] = clamp01(g);
    outC[i * 4 + 2] = clamp01(b);
    outC[i * 4 + 3] = 1;
  } else {
    outC[i * 4] = 1;
    outC[i * 4 + 1] = 1;
    outC[i * 4 + 2] = 1;
    outC[i * 4 + 3] = 1;
  }
}

/** 将点集归一化到以原点为中心、最大半轴约 0.35 的包围盒内 */
export function normalizeSamplesToUnit(out: Float32Array, stride = 4): void {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const n = Math.floor(out.length / stride);
  for (let i = 0; i < n; i++) {
    let x = out[i * stride];
    let y = out[i * stride + 1];
    let z = out[i * stride + 2];
    if (!Number.isFinite(x)) {
      x = 0;
    }
    if (!Number.isFinite(y)) {
      y = 0;
    }
    if (!Number.isFinite(z)) {
      z = 0;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const sx = maxX - minX;
  const sy = maxY - minY;
  const sz = maxZ - minZ;
  const ext = Math.max(sx, sy, sz, 1e-6);
  const scale = 0.7 / ext;
  for (let i = 0; i < n; i++) {
    out[i * stride] = (out[i * stride] - cx) * scale;
    out[i * stride + 1] = (out[i * stride + 1] - cy) * scale;
    out[i * stride + 2] = (out[i * stride + 2] - cz) * scale;
    if (stride === 4) {
      out[i * stride + 3] = 1;
    }
  }
}

/** 面积加权表面均匀采样；若有顶点色则重心插值到每个粒子 */
export function sampleMeshSurfaceUniform(
  mesh: MeshTriangleSoup,
  sampleCount: number,
  rng: () => number = Math.random,
): MeshSurfaceSampleResult {
  const nt = triangleCount(mesh);
  const useVc = !!(mesh.hasVertexColor && mesh.colors);
  const hasMeshUvs = !!(mesh.uvs && mesh.uvs.length >= (mesh.positions.length / 3) * 2);
  if (nt <= 0 || sampleCount <= 0) {
    return {
      positions: new Float32Array(0),
      colors: new Float32Array(0),
      hasVertexColor: false,
      uvs: new Float32Array(0),
      hasMeshUvs: false,
    };
  }

  const areas = new Float32Array(nt);
  const corner = new Float32Array(9);
  let sum = 0;
  for (let t = 0; t < nt; t++) {
    trianglePositions(mesh, t, corner);
    const ar = triangleArea(corner);
    areas[t] = ar;
    sum += ar;
  }
  if (!(sum > 0)) {
    sum = nt;
    for (let t = 0; t < nt; t++) {
      areas[t] = 1;
    }
  }

  const cdf = new Float32Array(nt);
  let acc = 0;
  for (let t = 0; t < nt; t++) {
    acc += areas[t] / sum;
    cdf[t] = acc;
  }
  cdf[nt - 1] = 1;

  const out = new Float32Array(sampleCount * 4);
  const outC = new Float32Array(sampleCount * 4);
  const outUv = new Float32Array(sampleCount * 2);
  const bary = new Float32Array(3);
  const cornerC = new Float32Array(12);
  const cornerUv = new Float32Array(6);
  for (let i = 0; i < sampleCount; i++) {
    const rTri = rng();
    let lo = 0;
    let hi = nt - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cdf[mid] < rTri) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const t = lo;
    writeOneMeshSurfaceSample(
      mesh,
      t,
      i,
      out,
      outC,
      outUv,
      corner,
      bary,
      cornerC,
      cornerUv,
      useVc,
      hasMeshUvs,
      rng,
    );
  }
  normalizeSamplesToUnit(out, 4);
  return {
    positions: out,
    colors: outC,
    hasVertexColor: useVc,
    uvs: outUv,
    hasMeshUvs,
  };
}

/**
 * 按三角**个数**均分粒子：每个三角分得 `⌊N/T⌋` 或 `⌊N/T⌋+1` 个（余数随机摊到若干三角），
 * 再在各自三角内重心均匀随机。**小脸、大脸的期望粒子数相同**（但总表面密度仍会因面积而异）。
 */
export function sampleMeshSurfacePerTriangleUniform(
  mesh: MeshTriangleSoup,
  sampleCount: number,
  rng: () => number = Math.random,
): MeshSurfaceSampleResult {
  const nt = triangleCount(mesh);
  const useVc = !!(mesh.hasVertexColor && mesh.colors);
  const hasMeshUvs = !!(
    mesh.uvs &&
    mesh.uvs.length >= (mesh.positions.length / 3) * 2
  );
  if (nt <= 0 || sampleCount <= 0) {
    return {
      positions: new Float32Array(0),
      colors: new Float32Array(0),
      hasVertexColor: false,
      uvs: new Float32Array(0),
      hasMeshUvs: false,
    };
  }

  const base = Math.floor(sampleCount / nt);
  const rem = sampleCount % nt;
  const counts = new Uint32Array(nt);
  counts.fill(base);
  const perm = new Uint32Array(nt);
  for (let i = 0; i < nt; i++) {
    perm[i] = i;
  }
  for (let i = nt - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = tmp;
  }
  for (let k = 0; k < rem; k++) {
    counts[perm[k]!]++;
  }

  const out = new Float32Array(sampleCount * 4);
  const outC = new Float32Array(sampleCount * 4);
  const outUv = new Float32Array(sampleCount * 2);
  const corner = new Float32Array(9);
  const bary = new Float32Array(3);
  const cornerC = new Float32Array(12);
  const cornerUv = new Float32Array(6);

  let idx = 0;
  for (let t = 0; t < nt; t++) {
    const c = counts[t]!;
    for (let k = 0; k < c; k++) {
      writeOneMeshSurfaceSample(
        mesh,
        t,
        idx,
        out,
        outC,
        outUv,
        corner,
        bary,
        cornerC,
        cornerUv,
        useVc,
        hasMeshUvs,
        rng,
      );
      idx++;
    }
  }

  normalizeSamplesToUnit(out, 4);
  return {
    positions: out,
    colors: outC,
    hasVertexColor: useVc,
    uvs: outUv,
    hasMeshUvs,
  };
}

export function sampleMeshSurface(
  mesh: MeshTriangleSoup,
  sampleCount: number,
  strategy: MeshSurfaceSampleStrategy = 'area',
  rng: () => number = Math.random,
): MeshSurfaceSampleResult {
  if (strategy === 'perTriangle') {
    return sampleMeshSurfacePerTriangleUniform(mesh, sampleCount, rng);
  }
  return sampleMeshSurfaceUniform(mesh, sampleCount, rng);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.min(1, Math.max(0, x));
}

/** glTF COLOR_0：FLOAT 或 normalized UNSIGNED_BYTE，输出每顶点 RGBA */
function readVertexColorAccessor(
  gltf: {
    json: {
      accessors: Record<string, unknown>[];
      bufferViews: Record<string, unknown>[];
    };
    buffers: { arrayBuffer: ArrayBuffer; byteOffset?: number }[];
  },
  accessorIndex: number,
): Float32Array {
  const acc = gltf.json.accessors[accessorIndex] as {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
    normalized?: boolean;
  };
  const bv = gltf.json.bufferViews[acc.bufferView] as {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  };
  const buf = gltf.buffers[bv.buffer];
  if (!buf?.arrayBuffer) {
    throw new Error('glTF buffer missing (COLOR_0)');
  }
  const base =
    (buf.byteOffset ?? 0) +
    (bv.byteOffset ?? 0) +
    (acc.byteOffset ?? 0);
  const ab = buf.arrayBuffer;
  const count = acc.count;
  const out = new Float32Array(count * 4);
  const view = new DataView(ab);

  if (acc.componentType === 5126 && acc.type === 'VEC3') {
    const stride = bv.byteStride ?? 12;
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 4] = view.getFloat32(off, true);
      out[i * 4 + 1] = view.getFloat32(off + 4, true);
      out[i * 4 + 2] = view.getFloat32(off + 8, true);
      out[i * 4 + 3] = 1;
      off += stride;
    }
    return out;
  }
  if (acc.componentType === 5126 && acc.type === 'VEC4') {
    const stride = bv.byteStride ?? 16;
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 4] = view.getFloat32(off, true);
      out[i * 4 + 1] = view.getFloat32(off + 4, true);
      out[i * 4 + 2] = view.getFloat32(off + 8, true);
      out[i * 4 + 3] = view.getFloat32(off + 12, true);
      off += stride;
    }
    return out;
  }
  if (acc.componentType === 5121 && acc.normalized && acc.type === 'VEC3') {
    const stride = bv.byteStride ?? 3;
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 4] = view.getUint8(off) / 255;
      out[i * 4 + 1] = view.getUint8(off + 1) / 255;
      out[i * 4 + 2] = view.getUint8(off + 2) / 255;
      out[i * 4 + 3] = 1;
      off += stride;
    }
    return out;
  }
  if (acc.componentType === 5121 && acc.normalized && acc.type === 'VEC4') {
    const stride = bv.byteStride ?? 4;
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 4] = view.getUint8(off) / 255;
      out[i * 4 + 1] = view.getUint8(off + 1) / 255;
      out[i * 4 + 2] = view.getUint8(off + 2) / 255;
      out[i * 4 + 3] = view.getUint8(off + 3) / 255;
      off += stride;
    }
    return out;
  }
  if (acc.componentType === 5123 && acc.normalized && acc.type === 'VEC3') {
    const stride = bv.byteStride ?? 6;
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 4] = view.getUint16(off, true) / 65535;
      out[i * 4 + 1] = view.getUint16(off + 2, true) / 65535;
      out[i * 4 + 2] = view.getUint16(off + 4, true) / 65535;
      out[i * 4 + 3] = 1;
      off += stride;
    }
    return out;
  }
  if (acc.componentType === 5123 && acc.normalized && acc.type === 'VEC4') {
    const stride = bv.byteStride ?? 8;
    let off = base;
    for (let i = 0; i < count; i++) {
      out[i * 4] = view.getUint16(off, true) / 65535;
      out[i * 4 + 1] = view.getUint16(off + 2, true) / 65535;
      out[i * 4 + 2] = view.getUint16(off + 4, true) / 65535;
      out[i * 4 + 3] = view.getUint16(off + 6, true) / 65535;
      off += stride;
    }
    return out;
  }
  throw new Error(
    `Unsupported COLOR_0 accessor type ${acc.type} / component ${acc.componentType}`,
  );
}

function readAccessor(
  gltf: {
    json: {
      accessors: Record<string, unknown>[];
      bufferViews: Record<string, unknown>[];
    };
    buffers: { arrayBuffer: ArrayBuffer; byteOffset?: number }[];
  },
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
    (buf.byteOffset ?? 0) +
    (bv.byteOffset ?? 0) +
    (acc.byteOffset ?? 0);
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

  // glTF 常见交错顶点：byteStride≠8 时不能用连续 Float32Array 视图。
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

  // glTF 常见交错顶点：byteStride≠12 时不能用连续 Float32Array 视图。
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

  if (acc.componentType === 5126) {
    return {
      array: new Float32Array(ab, base, acc.count * comps),
      components: comps,
    };
  }
  if (acc.componentType === 5125 && acc.type === 'SCALAR') {
    const stride = bv.byteStride ?? 4;
    if (stride === 4) {
      return {
        array: new Uint32Array(ab, base, acc.count),
        components: 1,
      };
    }
    const out = new Uint32Array(acc.count);
    const view = new DataView(ab);
    let off = base;
    for (let i = 0; i < acc.count; i++) {
      out[i] = view.getUint32(off, true);
      off += stride;
    }
    return { array: out, components: 1 };
  }
  if (acc.componentType === 5123 && acc.type === 'SCALAR') {
    const stride = bv.byteStride ?? 2;
    if (stride === 2) {
      return {
        array: new Uint16Array(ab, base, acc.count),
        components: 1,
      };
    }
    const out = new Uint16Array(acc.count);
    const view = new DataView(ab);
    let off = base;
    for (let i = 0; i < acc.count; i++) {
      out[i] = view.getUint16(off, true);
      off += stride;
    }
    return { array: out, components: 1 };
  }
  if (acc.componentType === 5125) {
    return {
      array: new Uint32Array(ab, base, acc.count * comps),
      components: comps,
    };
  }
  if (acc.componentType === 5123) {
    return {
      array: new Uint16Array(ab, base, acc.count * comps),
      components: comps,
    };
  }
  throw new Error(`Unsupported glTF accessor componentType ${acc.componentType}`);
}

/** 从 loaders.gl 解析后的 glTF 容器提取三角网格 */
export function meshTriangleSoupFromGLTF(gltf: {
  json: {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
    materials?: {
      pbrMetallicRoughness?: {
        baseColorFactor?: number[];
        baseColorTexture?: { index?: number };
      };
    }[];
    textures?: { source?: number }[];
    meshes?: {
      primitives: {
        attributes: {
          POSITION: number;
          COLOR_0?: number;
          TEXCOORD_0?: number;
        };
        indices?: number;
        mode?: number;
        material?: number;
      }[];
    }[];
  };
  buffers: { arrayBuffer: ArrayBuffer; byteOffset?: number }[];
  images?: unknown[];
}): MeshTriangleSoup {
  const meshes = gltf.json.meshes || [];
  const json = gltf.json;
  const posChunks: Float32Array[] = [];
  const colorChunks: Float32Array[] = [];
  const uvChunks: Float32Array[] = [];
  const idxChunks: number[] = [];
  let vertexOffset = 0;
  let anyVertexColor = false;
  let anyTexCoord = false;
  let baseColorImageIndex: number | undefined;
  let baseColorFactor: readonly [number, number, number, number] = [
    1, 1, 1, 1,
  ];

  for (const mesh of meshes) {
    for (const prim of mesh.primitives || []) {
      const mode = prim.mode ?? 4;
      if (mode !== 4) {
        continue;
      }
      const posIdx = prim.attributes.POSITION;
      if (posIdx === undefined) {
        continue;
      }
      const posAcc = readAccessor(gltf as never, posIdx);
      if (posAcc.components !== 3) {
        continue;
      }
      const posArr = posAcc.array as Float32Array;
      const vCount = posArr.length / 3;
      posChunks.push(new Float32Array(posArr));

      if (baseColorImageIndex === undefined && prim.material !== undefined) {
        const imgIx = baseColorTextureImageIndex(json, prim.material);
        if (imgIx !== undefined) {
          baseColorImageIndex = imgIx;
          baseColorFactor = materialBaseColorTintLinear(json, prim.material);
        }
      }

      let colChunk = whiteColors(vCount);
      let primHasColor = false;
      const c0 = prim.attributes.COLOR_0;
      if (c0 !== undefined) {
        try {
          const parsed = readVertexColorAccessor(gltf as never, c0);
          if (parsed.length === vCount * 4) {
            colChunk = parsed;
            primHasColor = true;
            anyVertexColor = true;
          }
        } catch {
          /* 忽略不支持的顶点色格式 */
        }
      }
      if (!primHasColor) {
        const factor = readMaterialBaseColorFactor(json, prim.material);
        if (factor) {
          colChunk = solidVertexColors(vCount, factor);
          anyVertexColor = true;
        }
      }
      colorChunks.push(colChunk);

      let uvChunk = new Float32Array(vCount * 2);
      const tc0 = prim.attributes.TEXCOORD_0;
      if (tc0 !== undefined) {
        try {
          const uvAcc = readAccessor(gltf as never, tc0);
          if (
            uvAcc.components === 2 &&
            uvAcc.array instanceof Float32Array &&
            uvAcc.array.length === vCount * 2
          ) {
            uvChunk = new Float32Array(uvAcc.array);
            anyTexCoord = true;
          }
        } catch {
          /* 忽略不支持的 UV 格式 */
        }
      }
      uvChunks.push(uvChunk);

      if (prim.indices !== undefined) {
        const idxAcc = readAccessor(gltf as never, prim.indices);
        let idx: Uint32Array;
        if (idxAcc.array instanceof Uint32Array) {
          idx = idxAcc.array;
        } else if (idxAcc.array instanceof Uint16Array) {
          idx = new Uint32Array(idxAcc.array.length);
          for (let i = 0; i < idxAcc.array.length; i++) {
            idx[i] = idxAcc.array[i];
          }
        } else {
          throw new Error('glTF indices must be uint16 or uint32');
        }
        for (let i = 0; i < idx.length; i++) {
          idxChunks.push(vertexOffset + idx[i]);
        }
      } else {
        for (let i = 0; i < vCount; i += 3) {
          idxChunks.push(
            vertexOffset + i,
            vertexOffset + i + 1,
            vertexOffset + i + 2,
          );
        }
      }
      vertexOffset += vCount;
    }
  }

  if (posChunks.length === 0) {
    return {
      positions: new Float32Array(0),
      indices: null,
      colors: null,
      hasVertexColor: false,
      uvs: null,
      hasTexCoord0: false,
      baseColorFactor: [1, 1, 1, 1],
    };
  }
  const totalFloats = posChunks.reduce((s, c) => s + c.length, 0);
  const positions = new Float32Array(totalFloats);
  let o = 0;
  for (const c of posChunks) {
    positions.set(c, o);
    o += c.length;
  }

  let colors: Float32Array | null = null;
  if (anyVertexColor) {
    colors = new Float32Array((totalFloats / 3) * 4);
    let co = 0;
    for (const c of colorChunks) {
      colors.set(c, co);
      co += c.length;
    }
  }

  let uvs: Float32Array | null = null;
  if (anyTexCoord) {
    uvs = new Float32Array((totalFloats / 3) * 2);
    let uo = 0;
    for (const c of uvChunks) {
      uvs.set(c, uo);
      uo += c.length;
    }
  }

  const out: MeshTriangleSoup = {
    positions,
    indices: new Uint32Array(idxChunks),
    colors,
    hasVertexColor: anyVertexColor,
    uvs,
    hasTexCoord0: anyTexCoord,
    baseColorFactor,
  };
  if (
    baseColorImageIndex !== undefined &&
    gltf.images?.[baseColorImageIndex] != null
  ) {
    out.baseColorImageIndex = baseColorImageIndex;
  }
  return out;
}

/** OBJ（loaders.gl 归一化几何）→ 三角汤 */
export function meshTriangleSoupFromOBJ(data: {
  attributes: {
    POSITION: { value: Float32Array; size: number };
    COLOR_0?: { value: Float32Array; size: number };
  };
}): MeshTriangleSoup {
  const pos = data.attributes.POSITION.value;
  const size = data.attributes.POSITION.size;
  const vCount = size === 3 ? Math.floor(pos.length / 3) : 0;
  let colors: Float32Array | null = null;
  let hasVertexColor = false;
  if (data.attributes.COLOR_0 && vCount > 0) {
    const cv = data.attributes.COLOR_0.value;
    const cs = data.attributes.COLOR_0.size;
    colors = new Float32Array(vCount * 4);
    if (cs === 3 && cv.length >= vCount * 3) {
      for (let i = 0; i < vCount; i++) {
        colors[i * 4] = cv[i * 3];
        colors[i * 4 + 1] = cv[i * 3 + 1];
        colors[i * 4 + 2] = cv[i * 3 + 2];
        colors[i * 4 + 3] = 1;
      }
      hasVertexColor = true;
    } else if (cs === 4 && cv.length >= vCount * 4) {
      colors.set(cv.subarray(0, vCount * 4));
      hasVertexColor = true;
    } else {
      colors = null;
    }
  }
  return {
    positions: new Float32Array(pos),
    indices: null,
    colors,
    hasVertexColor,
    uvs: null,
    hasTexCoord0: false,
    baseColorFactor: [1, 1, 1, 1],
  };
}

export async function loadMeshTriangleSoupFromFile(
  file: File,
): Promise<MeshTriangleSoup> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.obj')) {
    const buf = await file.arrayBuffer();
    const data = await OBJLoader.parse(buf, {});
    return meshTriangleSoupFromOBJ(
      data as unknown as {
        attributes: { POSITION: { value: Float32Array; size: number } };
      },
    );
  }

  const gltf = await parse(file, GLTFLoader, GLTF_LOAD_OPTIONS as never);
  const soup = meshTriangleSoupFromGLTF(gltf as never);
  const ix = soup.baseColorImageIndex;
  if (ix !== undefined) {
    const bmp = await gltfImageEntryToBitmap(
      (gltf as { images?: unknown[] }).images?.[ix],
    );
    if (bmp) {
      soup.baseColorImage = bmp;
    }
    delete soup.baseColorImageIndex;
  }
  return soup;
}

/** 默认球面 Fibonacci 点，用于尚未加载文件时 */
export function fibonacciSphereVec4(count: number): Float32Array {
  const out = new Float32Array(count * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1 || 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const x = Math.cos(theta) * r * 0.25;
    const z = Math.sin(theta) * r * 0.25;
    out[i * 4] = x;
    out[i * 4 + 1] = y * 0.25;
    out[i * 4 + 2] = z;
    out[i * 4 + 3] = 1;
  }
  return out;
}
