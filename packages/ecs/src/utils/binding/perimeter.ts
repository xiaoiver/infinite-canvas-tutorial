import { IPointData } from '@pixi/math';
import { SerializedNode } from '../serialize';

export function getPerimeterPoint(vertex: SerializedNode & { width: number; height: number; x: number; y: number }, point: IPointData, orthogonal: boolean): IPointData {
  const perimeter = vertex.type === 'ellipse' ? ellipsePerimeter : rectanglePerimeter;
  return perimeter(vertex, point, orthogonal);
}

function rectanglePerimeter(
  vertex: SerializedNode & { width: number; height: number; x: number; y: number },
  next: IPointData,
  orthogonal: boolean,
): IPointData {
  const { x, y, width, height } = vertex;
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

function ellipsePerimeter(
  vertex: SerializedNode & { width: number; height: number; x: number; y: number },
  next: IPointData,
  orthogonal: boolean,
): IPointData {
  const { x, y, width, height } = vertex;
  const a = width / 2;
  const b = height / 2;
  const cx = x + a;
  const cy = y + b;
  const px = next.x;
  const py = next.y;

  // Calculates straight line equation through
  // point and ellipse center y = d * x + h
  const dx = px - cx;
  const dy = py - cy;

  if (dx == 0 && dy != 0) {
    return { x: cx, y: cy + (b * dy) / Math.abs(dy) };
  } else if (dx == 0 && dy == 0) {
    return { x: px, y: py };
  }

  if (orthogonal) {
    if (py >= y && py <= y + height) {
      const ty = py - cy;
      let tx = Math.sqrt(a * a * (1 - (ty * ty) / (b * b))) || 0;

      if (px <= x) {
        tx = -tx;
      }

      return { x: cx + tx, y: py };
    }

    if (px >= x && px <= x + width) {
      const tx = px - cx;
      let ty = Math.sqrt(b * b * (1 - (tx * tx) / (a * a))) || 0;

      if (py <= y) {
        ty = -ty;
      }

      return { x: px, y: cy + ty };
    }
  }

  // Calculates intersection
  const d = dy / dx;
  const h = cy - d * cx;
  const e = a * a * d * d + b * b;
  const f = -2 * cx * e;
  const g = a * a * d * d * cx * cx + b * b * cx * cx - a * a * b * b;
  const det = Math.sqrt(f * f - 4 * e * g);

  // Two solutions (perimeter points)
  const xout1 = (-f + det) / (2 * e);
  const xout2 = (-f - det) / (2 * e);
  const yout1 = d * xout1 + h;
  const yout2 = d * xout2 + h;
  const dist1 = Math.sqrt(Math.pow(xout1 - px, 2) + Math.pow(yout1 - py, 2));
  const dist2 = Math.sqrt(Math.pow(xout2 - px, 2) + Math.pow(yout2 - py, 2));

  // Correct solution
  let xout = 0;
  let yout = 0;
  if (dist1 < dist2) {
    xout = xout1;
    yout = yout1;
  } else {
    xout = xout2;
    yout = yout2;
  }

  return { x: xout, y: yout };
}
