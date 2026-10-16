import type { Matrix } from 'transformation-matrix';

export function positivePixelLength(value: string | null): number | undefined {
  if (!value || !/^\s*[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:px)?\s*$/.test(value))
    return;
  const length = Number.parseFloat(value);
  return Number.isFinite(length) && length > 0 ? length : undefined;
}

export function sliceAspectRatio(element: SVGElement): boolean {
  const preserve = element.getAttribute('preserveAspectRatio')?.trim() || '';
  const tokens = preserve.replace(/^defer\s+/, '').split(/\s+/);
  return tokens[0] !== 'none' && tokens[1] === 'slice';
}

/** Map SVG viewBox coordinates into an explicit pixel viewport. */
export function viewBoxMatrix(
  element: SVGElement,
  width: number,
  height: number,
): Matrix | undefined {
  const viewBox = element.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || !width || !height) return;
  const [x, y, vw, vh] = viewBox;
  if (![x, y, vw, vh].every(Number.isFinite) || vw <= 0 || vh <= 0) return;

  const preserve = element.getAttribute('preserveAspectRatio')?.trim() || 'xMidYMid meet';
  const tokens = preserve.replace(/^defer\s+/, '').split(/\s+/);
  if (tokens[0] === 'none') {
    const sx = width / vw, sy = height / vh;
    return { a: sx, b: 0, c: 0, d: sy, e: -x * sx, f: -y * sy };
  }
  const align = /^(xMin|xMid|xMax)(YMin|YMid|YMax)$/.exec(tokens[0]);
  if (!align) return;
  const scale = tokens[1] === 'slice'
    ? Math.max(width / vw, height / vh)
    : Math.min(width / vw, height / vh);
  const dx = (width - vw * scale) * ({ xMin: 0, xMid: 0.5, xMax: 1 }[align[1]] ?? 0.5);
  const dy = (height - vh * scale) * ({ YMin: 0, YMid: 0.5, YMax: 1 }[align[2]] ?? 0.5);
  return { a: scale, b: 0, c: 0, d: scale, e: dx - x * scale, f: dy - y * scale };
}
