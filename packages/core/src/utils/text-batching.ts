export const TEXT_BATCH_GLYPHS = 4096;
export type TextBatchMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
};

/** Conservative first slice: bounded ordinary labels in stock generic fonts. */
export function ordinaryTextCount(
  content: string,
  family: string,
  size: number,
  width: number,
  height: number,
) {
  if (
    !['sans-serif', 'serif', 'monospace', 'system-ui'].includes(
      family.toLowerCase(),
    ) ||
    !content.trim() ||
    /[^\x20-\x7e\r\n\t]/.test(content) ||
    content.length > TEXT_BATCH_GLYPHS ||
    ![size, width, height].every(Number.isFinite) ||
    size <= 0 ||
    size > 256 ||
    width < 0 ||
    height < 0 ||
    width > 8192 ||
    height > 8192
  )
    return 0;
  return content.length; // Includes whitespace, a conservative glyph-budget bound.
}

/** Same linear transform and a local cell keep merged vertices numerically local. */
export function textBatchMatrixKey(m: TextBatchMatrix): number[] | null {
  const { a, b, c, d, tx, ty } = m,
    determinant = a * d - b * c;
  if (
    ![a, b, c, d, tx, ty, determinant].every(Number.isFinite) ||
    Math.abs(determinant) <= 1e-12 ||
    Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)) ** 2 /
      Math.abs(determinant) >
      1e4 ||
    Math.abs(tx) > 2 ** 40 ||
    Math.abs(ty) > 2 ** 40
  )
    return null;
  const x = Math.floor((d * tx - c * ty) / determinant / 8192),
    y = Math.floor((a * ty - b * tx) / determinant / 8192);
  return Number.isSafeInteger(x) && Number.isSafeInteger(y)
    ? [a, b, c, d, x, y]
    : null;
}

/** Subtract large translations before applying the inverse common linear part. */
export function bakeTextVertices(
  positions: number[],
  first: TextBatchMatrix,
  current: TextBatchMatrix,
) {
  const det = first.a * first.d - first.b * first.c;
  const dx = current.tx - first.tx,
    dy = current.ty - first.ty;
  const x = (first.d * dx - first.c * dy) / det,
    y = (first.a * dy - first.b * dx) / det;
  for (let v = 0; v < positions.length / 3; v++) {
    positions[v * 3] += x;
    positions[v * 3 + 1] += y;
  }
}
