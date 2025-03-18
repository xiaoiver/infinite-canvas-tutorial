export function serializePoints(points: [number, number][]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}
