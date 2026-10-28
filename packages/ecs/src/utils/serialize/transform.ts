import { path2Absolute, path2String } from '@antv/util';
import { mat3 } from 'gl-matrix';
import {
  fromTransformAttribute,
  translate,
  scale,
  compose,
  fromDefinition,
  Matrix,
  rotateDEG,
} from 'transformation-matrix';
import { SerializedNode } from '../../types/serialized-node';
import { serializePoints } from './points';
import { deserializePoints } from '../deserialize';
import { getGeometryBounds } from '../style';
import { measureText } from '../../systems/ComputeTextMetrics';
import type { ComputedTextMetrics } from '../../components';
import { roundNumberToDecimals } from './path-transform';
export { roundNumberToDecimals, transformPath } from './path-transform';

export type PathTransformCache = Map<
  string,
  {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    shifted: string;
  }
>;

export function fixTransform(
  transform: string,
  attributes: SerializedNode,
  pathCache?: PathTransformCache,
) {
  let metrics: Partial<ComputedTextMetrics>;
  if (attributes.type === 'text') {
    metrics = measureText(attributes);
    attributes.fontBoundingBoxAscent =
      metrics.fontMetrics.fontBoundingBoxAscent;
    attributes.fontBoundingBoxDescent =
      metrics.fontMetrics.fontBoundingBoxDescent;
    attributes.hangingBaseline = metrics.fontMetrics.hangingBaseline;
    attributes.ideographicBaseline = metrics.fontMetrics.ideographicBaseline;
  }

  const sourcePath = attributes.type === 'path' ? attributes.d : undefined;
  const cachedPath =
    sourcePath === undefined ? undefined : pathCache?.get(sourcePath);
  const { minX, minY, maxX, maxY } =
    cachedPath ?? getGeometryBounds(attributes, metrics);

  attributes.x = minX;
  attributes.y = minY;
  attributes.width = maxX - minX;
  attributes.height = maxY - minY;
  attributes.rotation = 0;
  attributes.scaleX = 1;
  attributes.scaleY = 1;

  if (transform !== '') {
    const matrices: Matrix[] = [];
    fromTransformAttribute(transform).forEach((d) => {
      const { type } = d;
      if (type === 'translate') {
        const { tx, ty } = d;
        matrices.push(translate(tx, ty));
      } else if (type === 'scale') {
        const { sx, sy } = d;
        matrices.push(scale(sx, sy));
      } else if (type === 'rotate') {
        // Incorrect type definition sx, sy in d.ts
        // @ts-ignore
        const { cx, cy, angle } = d;
        matrices.push(rotateDEG(angle, cx, cy));
      } else if (type === 'matrix') {
        matrices.push(fromDefinition(d));
      } else if (type === 'skewX' || type === 'skewY') {
        matrices.push(fromDefinition(d));
      }
    });
    const matrix = compose(matrices);

    const { a, b, c, d, e, f } = matrix;
    const scaleX = Math.hypot(a, b);
    attributes.x = a * minX + c * minY + e;
    attributes.y = b * minX + d * minY + f;
    attributes.rotation = Math.atan2(b, a);
    attributes.scaleX = scaleX;
    attributes.scaleY = scaleX ? (a * d - b * c) / scaleX : Math.hypot(c, d);
  }

  const { type } = attributes;

  if (type === 'ellipse') {
    // @ts-ignore
    delete attributes.cx;
    // @ts-ignore
    delete attributes.cy;
    delete attributes.rx;
    delete attributes.ry;
  } else if (type === 'polyline') {
    attributes.points = serializePoints(
      deserializePoints(attributes.points).map((point) => {
        return [point[0] - minX, point[1] - minY];
      }),
    );
  } else if (type === 'path') {
    attributes.d = cachedPath?.shifted ?? shiftPath(attributes.d, -minX, -minY);
    if (!cachedPath && sourcePath !== undefined)
      pathCache?.set(sourcePath, {
        minX,
        minY,
        maxX,
        maxY,
        shifted: attributes.d,
      });
  } else if (type === 'text') {
    attributes.anchorX = (attributes.anchorX ?? 0) - minX;
    attributes.anchorY = (attributes.anchorY ?? 0) - minY;
  } else if (type === 'line') {
    attributes.x1 = attributes.x1 - minX;
    attributes.y1 = attributes.y1 - minY;
    attributes.x2 = attributes.x2 - minX;
    attributes.y2 = attributes.y2 - minY;
  }

  // @ts-ignore
  delete attributes.transform;

  return { minX, minY };
}

export function shiftPath(d: string, dx: number, dy: number, decimals = 2) {
  const absoluteArray = path2Absolute(d);
  const hasDx = dx !== 0;
  const hasDy = dy !== 0;

  absoluteArray.forEach((segment) => {
    const [command] = segment;
    if (command === 'M') {
      if (hasDx) {
        segment[1] += dx;
      }
      if (hasDy) {
        segment[2] += dy;
      }
    } else if (command === 'L') {
      if (hasDx) {
        segment[1] += dx;
      }
      if (hasDy) {
        segment[2] += dy;
      }
    } else if (command === 'H') {
      if (hasDx) {
        segment[1] += dx;
      }
    } else if (command === 'V') {
      if (hasDy) {
        segment[1] += dy;
      }
    } else if (command === 'A') {
      if (hasDx) {
        segment[6] += dx;
      }
      if (hasDy) {
        segment[7] += dy;
      }
    } else if (command === 'T') {
      if (hasDx) {
        segment[1] += dx;
      }
      if (hasDy) {
        segment[2] += dy;
      }
    } else if (command === 'C') {
      if (hasDx) {
        segment[1] += dx;
        segment[3] += dx;
        segment[5] += dx;
      }
      if (hasDy) {
        segment[2] += dy;
        segment[4] += dy;
        segment[6] += dy;
      }
    } else if (command === 'S') {
      if (hasDx) {
        segment[1] += dx;
        segment[3] += dx;
      }
      if (hasDy) {
        segment[2] += dy;
        segment[4] += dy;
      }
    } else if (command === 'Q') {
      if (hasDx) {
        segment[1] += dx;
        segment[3] += dx;
      }
      if (hasDy) {
        segment[2] += dy;
        segment[4] += dy;
      }
    }
  });

  absoluteArray.forEach((segment) => {
    for (let i = 1; i < segment.length; i++) {
      const v = segment[i] as number;
      if (typeof v === 'number' && Number.isFinite(v)) {
        segment[i] = roundNumberToDecimals(v, decimals);
      }
    }
  });

  return path2String(absoluteArray);
}

/**
 * 局部路径/折线顶点在「几何 min 归一化」坐标系下，不应再叠加节点位姿里的平移（m20/m21），
 * 否则 transformPath / 点乘会与 obb 里的 x,y 重复平移。
 */
export function mat3WithoutTranslation(m: mat3): mat3 {
  const out = mat3.clone(m);
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;
  return out;
}
