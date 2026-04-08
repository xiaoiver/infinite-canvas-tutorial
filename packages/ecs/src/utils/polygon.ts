function formatNumber(value: number) {
  return Number(value.toFixed(2));
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

  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
    .concat(' Z');
}
