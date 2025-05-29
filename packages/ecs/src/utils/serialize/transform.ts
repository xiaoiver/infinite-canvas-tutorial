import {
  fromTransformAttribute,
  translate,
  scale,
  decomposeTSR,
  compose,
  Matrix,
  rotateDEG,
} from 'transformation-matrix';
import { SerializedNode } from './type';
import { getXY } from './svg';
import { serializePoints } from './points';
import { deserializePoints } from '../deserialize';

export function fixTransform(transform: string, attributes: SerializedNode) {
  const { x, y, width, height } = getXY(attributes);

  if (transform === '') {
    attributes.x = x;
    attributes.y = y;
    attributes.rotation = 0;
  } else {
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
        matrices.push(rotateDEG(angle, cx - x, cy - y));
      }
    });
    const matrix = compose(matrices);

    const {
      translate: { tx, ty },
      scale: { sx, sy }, // FIXME: scale is not working for now
      rotation: { angle },
    } = decomposeTSR(matrix);

    attributes.x = tx + x;
    attributes.y = ty + y;
    attributes.rotation = angle;
  }

  const { type } = attributes;

  if (type === 'ellipse') {
    attributes.width = attributes.rx * 2;
    attributes.height = attributes.ry * 2;
    // @ts-ignore
    delete attributes.cx;
    // @ts-ignore
    delete attributes.cy;
  } else if (type === 'polyline') {
    attributes.width = width;
    attributes.height = height;
    const points = deserializePoints(attributes.points);
    attributes.points = serializePoints(
      points.map((point) => {
        return [point[0] - x, point[1] - y];
      }),
    );
  }
}
