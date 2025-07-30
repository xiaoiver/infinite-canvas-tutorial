import { BrushPoint } from '../../components/geometry/Brush';

export function serializePoints(points: [number, number][]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

export function serializeBrushPoints(points: BrushPoint[]) {
  return points.map(({ x, y, radius }) => `${x},${y},${radius}`).join(' ');
}
