import { isString } from '@antv/util';
import {
  fromTransformAttribute,
  translate,
  scale,
  decomposeTSR,
  compose,
  Matrix,
  rotateDEG,
} from 'transformation-matrix';
import { SerializedTransform } from './type';
import { Transform } from '../../components';

export function serializeTransform(
  transform: Transform | string,
): SerializedTransform {
  if (isString(transform)) {
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
      }
    });
    const matrix = compose(matrices);

    const {
      translate: { tx, ty },
      scale: { sx, sy },
      rotation: { angle },
    } = decomposeTSR(matrix);

    return {
      matrix: {
        a: matrix.a,
        b: matrix.b,
        c: matrix.c,
        d: matrix.d,
        tx: matrix.e,
        ty: matrix.f,
      },
      translation: {
        x: tx,
        y: ty,
      },
      scale: {
        x: sx,
        y: sy,
      },
      rotation: angle,
    };
  } else {
    const {
      translation: { x: tx, y: ty },
      scale: { x: sx, y: sy },
      rotation,
    } = transform;

    return {
      matrix: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: tx,
        ty: ty,
      },
      translation: {
        x: tx,
        y: ty,
      },
      scale: {
        x: sx,
        y: sy,
      },
      rotation,
    };
  }
}
