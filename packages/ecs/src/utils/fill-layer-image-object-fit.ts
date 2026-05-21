/** CSS `object-fit` for FillLayers image fills (default `fill` = stretch to box). */
export type FillImageObjectFit =
  | 'fill'
  | 'contain'
  | 'cover'
  | 'none'
  | 'scale-down';

export interface FillLayerImageRasterOptions {
  objectFit?: FillImageObjectFit;
  /** CSS `object-position`; default `50% 50%`. */
  objectPosition?: string;
}

export interface ObjectFitDrawRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

const DEFAULT_OBJECT_POSITION = '50% 50%';

function parsePositionToken(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (t === 'left' || t === 'top') {
    return 0;
  }
  if (t === 'right' || t === 'bottom') {
    return 1;
  }
  if (t === 'center') {
    return 0.5;
  }
  const pct = /^(-?[\d.]+)%$/.exec(t);
  if (pct) {
    return Math.max(0, Math.min(1, parseFloat(pct[1]) / 100));
  }
  return null;
}

/** Parse CSS `object-position` (keywords and %; single value → second axis is center). */
export function parseObjectPosition(position: string): { x: number; y: number } {
  const parts = position.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { x: 0.5, y: 0.5 };
  }
  const xKeywords = new Set(['left', 'right', 'center']);
  const yKeywords = new Set(['top', 'bottom', 'center']);
  const classify = (token: string): 'x' | 'y' | 'either' => {
    const t = token.toLowerCase();
    if (xKeywords.has(t) && !yKeywords.has(t)) {
      return 'x';
    }
    if (yKeywords.has(t) && !xKeywords.has(t)) {
      return 'y';
    }
    return 'either';
  };
  if (parts.length === 1) {
    const k = classify(parts[0]);
    if (k === 'x') {
      return { x: parsePositionToken(parts[0]) ?? 0.5, y: 0.5 };
    }
    if (k === 'y') {
      return { x: 0.5, y: parsePositionToken(parts[0]) ?? 0.5 };
    }
    const v = parsePositionToken(parts[0]) ?? 0.5;
    return { x: v, y: 0.5 };
  }
  const a = parts[0];
  const b = parts[1];
  const ka = classify(a);
  const kb = classify(b);
  let x = 0.5;
  let y = 0.5;
  if (ka === 'x' && kb === 'y') {
    x = parsePositionToken(a) ?? 0.5;
    y = parsePositionToken(b) ?? 0.5;
  } else if (ka === 'y' && kb === 'x') {
    y = parsePositionToken(a) ?? 0.5;
    x = parsePositionToken(b) ?? 0.5;
  } else {
    x = parsePositionToken(a) ?? 0.5;
    y = parsePositionToken(b) ?? 0.5;
  }
  return { x, y };
}

function scaledSizeForFit(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  objectFit: FillImageObjectFit,
): { dw: number; dh: number } {
  if (srcW <= 0 || srcH <= 0 || destW <= 0 || destH <= 0) {
    return { dw: destW, dh: destH };
  }
  if (objectFit === 'fill') {
    return { dw: destW, dh: destH };
  }
  if (objectFit === 'none') {
    return { dw: srcW, dh: srcH };
  }
  if (objectFit === 'scale-down') {
    if (srcW <= destW && srcH <= destH) {
      return { dw: srcW, dh: srcH };
    }
    const scale = Math.min(destW / srcW, destH / srcH);
    return { dw: srcW * scale, dh: srcH * scale };
  }
  if (objectFit === 'contain') {
    const scale = Math.min(destW / srcW, destH / srcH);
    return { dw: srcW * scale, dh: srcH * scale };
  }
  // cover
  const scale = Math.max(destW / srcW, destH / srcH);
  return { dw: srcW * scale, dh: srcH * scale };
}

/**
 * Destination rect for `drawImage` inside a `destW×destH` box (canvas clips overflow).
 */
export function computeObjectFitDrawRect(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  objectFit: FillImageObjectFit = 'fill',
  objectPosition: string = DEFAULT_OBJECT_POSITION,
): ObjectFitDrawRect {
  const { dw, dh } = scaledSizeForFit(srcW, srcH, destW, destH, objectFit);
  const { x, y } = parseObjectPosition(objectPosition);
  return {
    dx: (destW - dw) * x,
    dy: (destH - dh) * y,
    dw,
    dh,
  };
}

export function drawCanvasImageWithObjectFit(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  options?: FillLayerImageRasterOptions,
): void {
  const objectFit = options?.objectFit ?? 'fill';
  const objectPosition = options?.objectPosition ?? DEFAULT_OBJECT_POSITION;
  const { dx, dy, dw, dh } = computeObjectFitDrawRect(
    srcW,
    srcH,
    destW,
    destH,
    objectFit,
    objectPosition,
  );
  ctx.clearRect(0, 0, destW, destH);
  ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, dw, dh);
}

export function fillLayerImageRasterOptions(layer: {
  objectFit?: FillImageObjectFit;
  objectPosition?: string;
}): FillLayerImageRasterOptions {
  const o: FillLayerImageRasterOptions = {};
  const fit = layer.objectFit;
  if (typeof fit === 'string' && fit.length > 0) {
    o.objectFit = fit as FillImageObjectFit;
  }
  const pos = layer.objectPosition;
  if (typeof pos === 'string' && pos.length > 0) {
    o.objectPosition = pos;
  }
  return o;
}
