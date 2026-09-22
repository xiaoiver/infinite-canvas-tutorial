function formatNumber(value: number) {
  return Number(value.toFixed(2));
}

function regularPolygonPoints(
  sides: number,
  width: number,
  height: number,
  rotation = -Math.PI / 2,
): [number, number][] {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const step = (Math.PI * 2) / sides;
  const points: [number, number][] = [];

  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * step;
    points.push([
      formatNumber(cx + Math.cos(angle) * rx),
      formatNumber(cy + Math.sin(angle) * ry),
    ]);
  }

  return points;
}

function pointsToPath(points: [number, number][]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
    .concat(' Z');
}

export function regularPolygonPathInRect(
  sides: number,
  width: number,
  height: number,
  rotation = -Math.PI / 2,
): string {
  if (sides < 3 || width <= 0 || height <= 0) {
    return '';
  }

  return pointsToPath(regularPolygonPoints(sides, width, height, rotation));
}

/**
 * Like {@link regularPolygonPathInRect}, but the returned path `d` is normalized
 * so that its geometry bounding box starts at the local origin `(0, 0)`.
 *
 * A serialized shape node keeps the invariant that its local geometry begins at
 * `(0, 0)` and that `x`/`y`/`width`/`height` describe the geometry bounding box.
 * A regular polygon inscribed in a rect generally does not touch all four edges
 * (e.g. a triangle), so the raw `d` from {@link regularPolygonPathInRect} would
 * violate that invariant and break the first resize via the Transformer.
 *
 * `offsetX`/`offsetY` are the geometry bounding box origin inside the inscribing
 * rect, so callers can keep the polygon at the same position by shifting their
 * `x`/`y` accordingly.
 */
export function regularPolygonInRect(
  sides: number,
  width: number,
  height: number,
  rotation = -Math.PI / 2,
): {
  d: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
} | null {
  if (sides < 3 || width <= 0 || height <= 0) {
    return null;
  }

  const points = regularPolygonPoints(sides, width, height, rotation);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const shifted = points.map(
    ([x, y]) =>
      [formatNumber(x - minX), formatNumber(y - minY)] as [number, number],
  );

  return {
    d: pointsToPath(shifted),
    offsetX: minX,
    offsetY: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
