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

  const offsetLen = (trimOffset / 360) * perimeter;
  const startLen = mod((trimStart / 100) * perimeter + offsetLen, perimeter);
  const endLen = mod((trimEnd / 100) * perimeter + offsetLen, perimeter);

  let dashLen: number;
  if (endLen >= startLen) {
    dashLen = endLen - startLen;
  } else {
    dashLen = perimeter - startLen + endLen;
  }

  const gapLen = Math.max(0, perimeter - dashLen);
  return {
    dasharray: [dashLen, gapLen],
    dashoffset: -startLen,
  };
}

export function hasLottieTrim(shape?: Record<string, unknown> | null): boolean {
  if (!shape) {
    return false;
  }
  const s = shape.trimStart;
  const e = shape.trimEnd;
  const o = shape.trimOffset;
  if (typeof s === 'number' && Number.isFinite(s) && s !== 0) {
    return true;
  }
  if (typeof e === 'number' && Number.isFinite(e) && e !== 100) {
    return true;
  }
  if (typeof o === 'number' && Number.isFinite(o) && o !== 0) {
    return true;
  }
  return false;
}

export function readLottieTrim(
  shape?: Record<string, unknown> | null,
): { trimStart: number; trimEnd: number; trimOffset: number } {
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
      return 2 * (w + h);
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

export function strokeDasharrayToWireString(dasharray: [number, number]): string {
  return `${dasharray[0]} ${dasharray[1]}`;
}
