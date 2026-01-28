import { BrushPoint } from '../../components/geometry/Brush';

export function formatNumber(n: number) {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  // 对有小数的值保留两位小数
  return n.toFixed(2);
}

export function serializePoints(points: [number, number][]) {
  return points.map(([x, y]) => `${formatNumber(x)},${formatNumber(y)}`).join(' ');
}

export function serializeBrushPoints(points: BrushPoint[]) {
  return points
    .map(({ x, y, radius }) => `${formatNumber(x)},${formatNumber(y)},${formatNumber(radius)}`)
    .join(' ');
}
