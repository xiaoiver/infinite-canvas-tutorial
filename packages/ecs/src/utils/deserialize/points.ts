import { BrushPoint } from '../../components';

/**
 * "0,0 0,34" -> [[0, 0], [0, 34]]
 * "0,0,0,34" -> [[0, 0], [0, 34]]
 */
export function deserializePoints(points: string) {
  // 如果包含空格，按原来的方式处理（空格分隔的点）
  if (points.includes(' ')) {
    return points.split(' ').map((xy) => xy.split(',').map(Number)) as [
      number,
      number,
    ][];
  }

  // 如果不包含空格，说明是连续的逗号分隔格式，按每两个数字分组
  const numbers = points.split(',').map(Number);
  const result: [number, number][] = [];

  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      result.push([numbers[i], numbers[i + 1]]);
    }
  }

  return result;
}

export function deserializeBrushPoints(points: string) {
  return points.split(' ').map((xyr) => {
    const [x, y, r] = xyr.split(',').map(Number);
    return { x, y, radius: r };
  }) as BrushPoint[];
}
