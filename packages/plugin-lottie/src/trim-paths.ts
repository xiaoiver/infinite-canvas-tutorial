import { getTotalLength, type PathArray } from '@antv/util';

/** Ramanujan approximation for ellipse circumference. */
export function ellipsePerimeter(rx: number, ry: number): number {
  const a = Math.abs(rx);
  const b = Math.abs(ry);
  if (a === 0 && b === 0) {
    return 0;
  }
  if (a === 0) {
    return 2 * b;
  }
  if (b === 0) {
    return 2 * a;
  }
  const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function mod(n: number, m: number): number {
  if (m === 0) {
    return 0;
  }
  return ((n % m) + m) % m;
}

/**
 * Map Lottie trim-paths (`s` / `e` / `o`) to SVG stroke dash.
 *
 * @see https://lottiefiles.github.io/lottie-docs/shapes/#trim-paths
 */
export function lottieTrimToStrokeDash(
  perimeter: number,
  trimStart: number,
  trimEnd: number,
  trimOffset = 0,
): { dasharray: [number, number]; dashoffset: number } {
  if (!Number.isFinite(perimeter) || perimeter <= 0) {
    return { dasharray: [0, 0], dashoffset: 0 };
  }

  // Lottie clamps percentages and sorts endpoints BEFORE applying the offset.
  // Modulo both endpoints first makes 0..100 indistinguishable from an empty trim.
  const clamp = (value: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : fallback;
  const s = clamp(trimStart, 0);
  const e = clamp(trimEnd, 1);
  const dashLen = Math.abs(e - s) * perimeter;
  const offset = Number.isFinite(trimOffset) ? trimOffset / 360 : 0;
  const startLen = mod(Math.min(s, e) + offset, 1) * perimeter;

  const gapLen = Math.max(0, perimeter - dashLen);
  return {
    dasharray: [dashLen, gapLen],
    dashoffset: dashLen === perimeter || dashLen === 0 ? 0 : -startLen,
  };
}

export function hasLottieTrim(shape?: Record<string, unknown> | null): boolean {
  if (!shape) {
    return false;
  }
  // Presence matters: a full-trim keyframe must reset the previous partial dash.
  return ['trimStart', 'trimEnd', 'trimOffset'].some(
    (key) => typeof shape[key] === 'number' && Number.isFinite(shape[key]),
  );
}

export function readLottieTrim(shape?: Record<string, unknown> | null): {
  trimStart: number;
  trimEnd: number;
  trimOffset: number;
} {
  return {
    trimStart:
      typeof shape?.trimStart === 'number' && Number.isFinite(shape.trimStart)
        ? shape.trimStart
        : 0,
    trimEnd:
      typeof shape?.trimEnd === 'number' && Number.isFinite(shape.trimEnd)
        ? shape.trimEnd
        : 100,
    trimOffset:
      typeof shape?.trimOffset === 'number' && Number.isFinite(shape.trimOffset)
        ? shape.trimOffset
        : 0,
  };
}

export function getShapePerimeter(
  type: string | undefined,
  shape: Record<string, unknown>,
  pathD?: string,
): number {
  if (type === 'ellipse') {
    const rx = Number(shape.rx);
    const ry = Number(shape.ry);
    if (Number.isFinite(rx) && Number.isFinite(ry)) {
      return ellipsePerimeter(rx, ry);
    }
  }
  if (type === 'rect') {
    const w = Number(shape.width);
    const h = Number(shape.height);
    if (Number.isFinite(w) && Number.isFinite(h)) {
      const radius = Math.max(
        0,
        Math.min(Number(shape.r) || 0, Math.abs(w) / 2, Math.abs(h) / 2),
      );
      return (
        2 * (Math.abs(w) + Math.abs(h)) - 8 * radius + 2 * Math.PI * radius
      );
    }
  }
  if (pathD && pathD.length > 0) {
    try {
      const len = getTotalLength(pathD as unknown as PathArray);
      if (Number.isFinite(len) && len > 0) {
        return len;
      }
    } catch {
      /* fall through */
    }
  }
  return 0;
}

export function strokeDasharrayToWireString(
  dasharray: [number, number],
): string {
  return `${dasharray[0]} ${dasharray[1]}`;
}
