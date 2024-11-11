import { AbsoluteArray } from '@antv/util';
import rough from 'roughjs';
import { OpSet } from 'roughjs/bin/core';

export const generator = rough.generator();

export function opSet2Absolute(set: OpSet) {
  const array = [];
  set.ops.forEach(({ op, data }) => {
    if (op === 'move') {
      array.push(['M', data[0], data[1]]);
    } else if (op === 'lineTo') {
      array.push(['L', data[0], data[1]]);
    } else if (op === 'bcurveTo') {
      array.push(['C', data[0], data[1], data[2], data[3], data[4], data[5]]);
    }
  });
  return array as AbsoluteArray;
}
