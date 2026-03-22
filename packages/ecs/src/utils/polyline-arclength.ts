/**
 * Point at normalized arc length t ∈ [0, 1] along an open polyline (no NaN breaks).
 */
export function pointAlongPolylineByT(
  points: [number, number][],
  t: number,
): [number, number] {
  if (points.length === 0) {
    return [0, 0];
  }
  if (points.length === 1) {
    return [points[0][0], points[0][1]];
  }
  const clampedT = Math.max(0, Math.min(1, t));

  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    segLens.push(len);
    total += len;
  }
  if (total === 0) {
    return [points[0][0], points[0][1]];
  }

  let dist = clampedT * total;
  for (let i = 0; i < points.length - 1; i++) {
    const len = segLens[i];
    const isLast = i === points.length - 2;
    if (dist <= len || isLast) {
      const u = len === 0 ? 0 : Math.min(1, dist / len);
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
    }
    dist -= len;
  }
  const last = points[points.length - 1];
  return [last[0], last[1]];
}
