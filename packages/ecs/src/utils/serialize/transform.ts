import { path2Absolute, path2String } from '@antv/util';
import { mat3, vec2 } from 'gl-matrix';
import {
  fromTransformAttribute,
  translate,
  scale,
  decomposeTSR,
  compose,
  fromDefinition,
  Matrix,
  rotateDEG,
} from 'transformation-matrix';
import { SerializedNode } from './type';
import { serializePoints } from './points';
import { deserializePoints } from '../deserialize';
import { getGeometryBounds } from '../style';
import { computeBidi, measureText } from '../../systems/ComputeTextMetrics';
import { ComputedTextMetrics } from '../../components';

export function fixTransform(transform: string, attributes: SerializedNode) {
  let metrics: Partial<ComputedTextMetrics>;
  if (attributes.type === 'text') {
    computeBidi(attributes.content);
    metrics = measureText(attributes);
    attributes.fontBoundingBoxAscent =
      metrics.fontMetrics.fontBoundingBoxAscent;
    attributes.fontBoundingBoxDescent =
      metrics.fontMetrics.fontBoundingBoxDescent;
    attributes.hangingBaseline = metrics.fontMetrics.hangingBaseline;
    attributes.ideographicBaseline = metrics.fontMetrics.ideographicBaseline;
  }

  const { minX, minY, maxX, maxY } = getGeometryBounds(attributes, metrics);

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
        matrices.push(rotateDEG(angle, cx - minX, cy - minY));
      } else if (type === 'matrix') {
        matrices.push(fromDefinition(d));
      }
    });
    const matrix = compose(matrices);

    const {
      translate: { tx, ty },
      scale: { sx, sy },
      rotation: { angle },
    } = decomposeTSR(matrix);

    attributes.x = tx + minX;
    attributes.y = ty + minY;
    attributes.rotation = angle;
    attributes.scaleX = sx;
    attributes.scaleY = sy;
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
    attributes.d = shiftPath(attributes.d, -minX, -minY);
  } else if (type === 'text') {
    attributes.anchorX -= minX;
    attributes.anchorY -= minY;
  }

  // @ts-ignore
  delete attributes.transform;
}

export function shiftPath(d: string, dx: number, dy: number) {
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

  return path2String(absoluteArray);
}

export function transformPath(d: string, transform: mat3) {
  const absoluteArray = path2Absolute(d);

  absoluteArray.forEach((segment) => {
    const [command] = segment;
    if (command === 'M' || command === 'L' || command === 'T') {
      const [newX, newY] = vec2.transformMat3(
        vec2.create(),
        [segment[1], segment[2]],
        transform,
      );
      segment[1] = newX;
      segment[2] = newY;
    } else if (command === 'H') {
      const [newX] = vec2.transformMat3(
        vec2.create(),
        [segment[1], 0],
        transform,
      );
      segment[1] = newX;
    } else if (command === 'V') {
      const [, newY] = vec2.transformMat3(
        vec2.create(),
        [0, segment[1]],
        transform,
      );
      segment[1] = newY;
    } else if (command === 'A') {
      const [newX, newY] = vec2.transformMat3(
        vec2.create(),
        [segment[6], segment[7]],
        transform,
      );
      segment[6] = newX;
      segment[7] = newY;
    } else if (command === 'C') {
      const [newX1, newY1] = vec2.transformMat3(
        vec2.create(),
        [segment[1], segment[2]],
        transform,
      );
      segment[1] = newX1;
      segment[2] = newY1;
      const [newX2, newY2] = vec2.transformMat3(
        vec2.create(),
        [segment[3], segment[4]],
        transform,
      );
      segment[3] = newX2;
      segment[4] = newY2;
      const [newX3, newY3] = vec2.transformMat3(
        vec2.create(),
        [segment[5], segment[6]],
        transform,
      );
      segment[5] = newX3;
      segment[6] = newY3;
    } else if (command === 'Q' || command === 'S') {
      const [newX1, newY1] = vec2.transformMat3(
        vec2.create(),
        [segment[1], segment[2]],
        transform,
      );
      segment[1] = newX1;
      segment[2] = newY1;
      const [newX2, newY2] = vec2.transformMat3(
        vec2.create(),
        [segment[3], segment[4]],
        transform,
      );
      segment[3] = newX2;
      segment[4] = newY2;
    }
  });

  return path2String(absoluteArray);
}
