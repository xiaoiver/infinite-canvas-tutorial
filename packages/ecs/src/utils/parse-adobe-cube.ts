/**
 * Parse Adobe / DaVinci Resolve style `.cube` LUT files (3D LUT, ASCII).
 * Parsing aligns with three.js `LUTCubeLoader` (regexes, domain checks, data rows).
 * Data order per Adobe: red index varies fastest, then green, then blue — same file order
 * as `LUTCubeLoader` sequential fill.
 *
 * @see https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/LUTCubeLoader.js
 * @see https://resolve.cafe/docs/developer-docs/lut-formats/
 */

/** Matches three.js `LUTCubeLoader` header patterns. */
const regExpTitle = /TITLE +"([^"]*)"/;
const regExpSize = /LUT_3D_SIZE +(\d+)/;
/** Same character class as three.js `LUTCubeLoader` (not scientific notation). */
const regExpDomainMin = /DOMAIN_MIN +([\d.]+) +([\d.]+) +([\d.]+)/;
const regExpDomainMax = /DOMAIN_MAX +([\d.]+) +([\d.]+) +([\d.]+)/;
/** Same as three.js: `gm` so `^`/`$` match line boundaries; floats incl. scientific notation. */
const regExpDataPoints =
  /^([\d.e+-]+) +([\d.e+-]+) +([\d.e+-]+) *$/gm;

export type ParsedAdobeCube = {
  /** From `TITLE "…"` when present (three.js returns this too). */
  title: string | null;
  /** Edge length of the LUT cube (e.g. 33 → 33³ entries). */
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /**
   * RGBA8 in Adobe file index order (r fastest → g → b), length `size³×4`.
   * Use for GPU `TEXTURE_3D` upload (same voxel order as three.js `LUTCubeLoader`).
   */
  volumeRgba: Uint8Array;
  /** Same order as {@link volumeRgba}; linear float RGBA (a = 1). */
  volumeRgbaF32: Float32Array;
};

/**
 * @param text Full `.cube` file contents (UTF-8 string).
 * @throws Same failure modes as three.js: missing size, bad domain, wrong triple count.
 */
export function parseAdobeCube(text: string): ParsedAdobeCube {
  let m = regExpTitle.exec(text);
  const title = m !== null ? m[1]! : null;

  m = regExpSize.exec(text);
  if (m === null) {
    throw new Error('parseAdobeCube: Missing LUT_3D_SIZE information');
  }

  const size = Number(m[1]);
  if (!Number.isFinite(size) || size < 1) {
    throw new Error(
      `parseAdobeCube: invalid LUT_3D_SIZE (${String(m[1])})`,
    );
  }

  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];

  m = regExpDomainMin.exec(text);
  if (m !== null) {
    domainMin = [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  m = regExpDomainMax.exec(text);
  if (m !== null) {
    domainMax = [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  if (
    domainMin[0] > domainMax[0] ||
    domainMin[1] > domainMax[1] ||
    domainMin[2] > domainMax[2]
  ) {
    throw new Error('parseAdobeCube: Invalid input domain');
  }

  const rgbRows: [number, number, number][] = [];
  regExpDataPoints.lastIndex = 0;
  while ((m = regExpDataPoints.exec(text)) !== null) {
    rgbRows.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  }

  const expected = size ** 3;
  if (rgbRows.length !== expected) {
    throw new Error(
      `parseAdobeCube: expected ${expected} RGB rows, got ${rgbRows.length}`,
    );
  }

  const volumeRgba = new Uint8Array(expected * 4);
  const volumeRgbaF32 = new Float32Array(expected * 4);
  for (let idx = 0; idx < expected; idx++) {
    const row = rgbRows[idx]!;
    const vo = idx * 4;
    const rf = row[0]!;
    const gf = row[1]!;
    const bf = row[2]!;
    volumeRgbaF32[vo] = rf;
    volumeRgbaF32[vo + 1] = gf;
    volumeRgbaF32[vo + 2] = bf;
    volumeRgbaF32[vo + 3] = 1;
    volumeRgba[vo] = Math.max(0, Math.min(255, Math.round(rf * 255)));
    volumeRgba[vo + 1] = Math.max(0, Math.min(255, Math.round(gf * 255)));
    volumeRgba[vo + 2] = Math.max(0, Math.min(255, Math.round(bf * 255)));
    volumeRgba[vo + 3] = 255;
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    volumeRgba,
    volumeRgbaF32,
  };
}
