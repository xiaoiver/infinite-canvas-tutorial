import { isString } from '@antv/util';
import { Transform as PixiTransform } from '@pixi/math';
import { SerializedTransform } from './type';
import { Transform } from '../../components';

export function serializeTransform(
  transform: Transform | string,
): SerializedTransform {
  if (isString(transform)) {
    return parseTransform(transform);
  }

  const { translation, scale, rotation } = transform;

  const pixiTransform = new PixiTransform();
  pixiTransform.position.set(translation.x, translation.y);
  pixiTransform.rotation = rotation;
  pixiTransform.scale.set(scale.x, scale.y);
  pixiTransform.updateLocalTransform();

  return {
    matrix: pixiTransform.localTransform,
    position: {
      x: pixiTransform.position.x,
      y: pixiTransform.position.y,
    },
    scale: {
      x: pixiTransform.scale.x,
      y: pixiTransform.scale.y,
    },
    rotation: pixiTransform.rotation,
    pivot: {
      x: pixiTransform.pivot.x,
      y: pixiTransform.pivot.y,
    },
    skew: {
      x: pixiTransform.skew.x,
      y: pixiTransform.skew.y,
    },
  };
}

function parseTransform(transformStr: string): SerializedTransform {
  const transform: SerializedTransform = {
    matrix: null,
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    skew: { x: 0, y: 0 },
    rotation: 0,
    pivot: { x: 0, y: 0 },
  };

  const translateRegex = /translate\(([^,]+),([^,]+)\)/;
  const translateXRegex = /translateX\(([^,\)]+)\)/;
  const translateYRegex = /translateY\(([^,\)]+)\)/;
  const rotateRegex = /rotate\(([^,]+)\)/;
  const scaleRegex = /scale\(([^,\)]+)(?:,([^,\)]+))?\)/;
  const scaleXRegex = /scaleX\(([^,\)]+)\)/;
  const scaleYRegex = /scaleY\(([^,\)]+)\)/;
  const skewRegex = /skew\(([^,]+),([^,]+)\)/;
  const skewXRegex = /skewX\(([^,\)]+)\)/;
  const skewYRegex = /skewY\(([^,\)]+)\)/;
  const matrixRegex =
    /matrix\(([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+)\)/;

  // translate(x,y)
  const translateMatch = transformStr.match(translateRegex);
  if (translateMatch) {
    transform.position.x = parseFloat(translateMatch[1]);
    transform.position.y = parseFloat(translateMatch[2]);
  }

  // translateX(x)
  const translateXMatch = transformStr.match(translateXRegex);
  if (translateXMatch) {
    transform.position.x = parseFloat(translateXMatch[1]);
  }

  // translateY(y)
  const translateYMatch = transformStr.match(translateYRegex);
  if (translateYMatch) {
    transform.position.y = parseFloat(translateYMatch[1]);
  }

  const rotateMatch = transformStr.match(rotateRegex);
  if (rotateMatch) {
    transform.rotation = parseFloat(rotateMatch[1]);
  }

  const scaleMatch = transformStr.match(scaleRegex);
  if (scaleMatch) {
    const x = parseFloat(scaleMatch[1]);
    transform.scale.x = x;
    transform.scale.y = scaleMatch[2] ? parseFloat(scaleMatch[2]) : x;
  }

  const scaleXMatch = transformStr.match(scaleXRegex);
  if (scaleXMatch) {
    transform.scale.x = parseFloat(scaleXMatch[1]);
  }

  const scaleYMatch = transformStr.match(scaleYRegex);
  if (scaleYMatch) {
    transform.scale.y = parseFloat(scaleYMatch[1]);
  }

  const skewMatch = transformStr.match(skewRegex);
  if (skewMatch) {
    transform.skew.x = parseFloat(skewMatch[1]);
    transform.skew.y = parseFloat(skewMatch[2]);
  }

  const skewXMatch = transformStr.match(skewXRegex);
  if (skewXMatch) {
    transform.skew.x = parseFloat(skewXMatch[1]);
  }

  const skewYMatch = transformStr.match(skewYRegex);
  if (skewYMatch) {
    transform.skew.y = parseFloat(skewYMatch[1]);
  }

  const matrixMatch = transformStr.match(matrixRegex);
  if (matrixMatch) {
    transform.matrix = {
      a: parseFloat(matrixMatch[1]),
      b: parseFloat(matrixMatch[2]),
      c: parseFloat(matrixMatch[3]),
      d: parseFloat(matrixMatch[4]),
      tx: parseFloat(matrixMatch[5]),
      ty: parseFloat(matrixMatch[6]),
    };
  } else {
    // TODO: calculate matrix
    transform.matrix = null;
  }

  // TODO: transform-origin

  return transform;
}
