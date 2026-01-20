import { IPointData } from '@pixi/math';
import { SerializedNode } from '../serialize';

export function rectanglePerimeter(
  bounds: { x: number; y: number; width: number; height: number },
  vertex: SerializedNode,
  next: IPointData,
  orthogonal: boolean,
): IPointData {
  const { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const dx = next.x - cx;
  const dy = next.y - cy;
  const alpha = Math.atan2(dy, dx);
  const p: IPointData = { x: 0, y: 0 };
  const pi = Math.PI;
  const pi2 = Math.PI / 2;
  const beta = pi2 - alpha;
  const t = Math.atan2(height, width);
  if (alpha < -pi + t || alpha > pi - t) {
    // Left edge
    p.x = x;
    p.y = cy - (width * Math.tan(alpha)) / 2;
  } else if (alpha < -t) {
    // Top Edge
    p.y = y;
    p.x = cx - (height * Math.tan(beta)) / 2;
  } else if (alpha < t) {
    // Right Edge
    p.x = x + width;
    p.y = cy + (width * Math.tan(alpha)) / 2;
  } else {
    // Bottom Edge
    p.y = y + height;
    p.x = cx + (height * Math.tan(beta)) / 2;
  }

  if (orthogonal) {
    if (next.x >= x && next.x <= x + width) {
      p.x = next.x;
    } else if (next.y >= y && next.y <= y + height) {
      p.y = next.y;
    }
    if (next.x < x) {
      p.x = x;
    } else if (next.x > x + width) {
      p.x = x + width;
    }
    if (next.y < y) {
      p.y = y;
    } else if (next.y > y + height) {
      p.y = y + height;
    }
  }
  return p;
}
