import { BrushPoint } from '../../components/geometry/Brush';

export function serializePoints(points: [number, number][]) {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

export function serializeBrushPoints(points: BrushPoint[]) {
  return points.map(({ x, y, radius }) => `${x.toFixed(2)},${y.toFixed(2)},${radius.toFixed(2)}`).join(' ');
}
