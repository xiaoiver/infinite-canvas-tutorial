export function deserializePoints(points: string) {
  return points.split(' ').map((xy) => xy.split(',').map(Number)) as [
    number,
    number,
  ][];
}
