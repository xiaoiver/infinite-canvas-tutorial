/** Split-sum GGX environment BRDF lookup, indexed by N·V and roughness. */
export const ENVIRONMENT_BRDF_SIZE = 64;
const SAMPLE_COUNT = 128;
let cachedPixels: Uint8Array | undefined;

function radicalInverse(index: number): number {
  let bits = index;
  bits = (bits << 16) | (bits >>> 16);
  bits = ((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1);
  bits = ((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2);
  bits = ((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4);
  bits = ((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8);
  return (bits >>> 0) / 4294967296;
}

function smithGeometry(
  nDotV: number,
  nDotL: number,
  roughness: number,
): number {
  const k = roughness * roughness * 0.5;
  const gV = nDotV / (nDotV * (1 - k) + k);
  const gL = nDotL / (nDotL * (1 - k) + k);
  return gV * gL;
}

/** Monte Carlo integration of the two Schlick Fresnel coefficients. */
export function integrateEnvironmentBrdf(
  nDotV: number,
  roughness: number,
  sampleCount = SAMPLE_COUNT,
): [number, number] {
  const nv = Math.max(1e-4, Math.min(1, nDotV));
  const r = Math.max(0.04, Math.min(1, roughness));
  const vx = Math.sqrt(1 - nv * nv);
  const alpha = r * r;
  let a = 0;
  let b = 0;
  for (let i = 0; i < sampleCount; i++) {
    const phi = (2 * Math.PI * i) / sampleCount;
    const xi = radicalInverse(i);
    const cosTheta = Math.sqrt((1 - xi) / (1 + (alpha * alpha - 1) * xi));
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const hx = Math.cos(phi) * sinTheta;
    const hz = cosTheta;
    const vDotH = Math.max(0, vx * hx + nv * hz);
    const nDotL = Math.max(0, 2 * vDotH * hz - nv);
    if (nDotL <= 0) continue;
    const geometry = smithGeometry(nv, nDotL, r);
    const visibility = (geometry * vDotH) / Math.max(hz * nv, 1e-5);
    const fresnel = (1 - vDotH) ** 5;
    a += (1 - fresnel) * visibility;
    b += fresnel * visibility;
  }
  return [a / sampleCount, b / sampleCount];
}

/** Cached RGBA8 table. Row zero is roughness zero for both GPU backends. */
export function environmentBrdfPixels(): Uint8Array {
  if (cachedPixels) return cachedPixels;
  const pixels = new Uint8Array(ENVIRONMENT_BRDF_SIZE ** 2 * 4);
  for (let y = 0; y < ENVIRONMENT_BRDF_SIZE; y++) {
    const roughness = (y + 0.5) / ENVIRONMENT_BRDF_SIZE;
    for (let x = 0; x < ENVIRONMENT_BRDF_SIZE; x++) {
      const nDotV = (x + 0.5) / ENVIRONMENT_BRDF_SIZE;
      const [a, b] = integrateEnvironmentBrdf(nDotV, roughness);
      const offset = (y * ENVIRONMENT_BRDF_SIZE + x) * 4;
      pixels[offset] = Math.round(Math.max(0, Math.min(1, a)) * 255);
      pixels[offset + 1] = Math.round(Math.max(0, Math.min(1, b)) * 255);
      pixels[offset + 3] = 255;
    }
  }
  cachedPixels = pixels;
  return pixels;
}
