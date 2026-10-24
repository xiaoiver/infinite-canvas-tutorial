import {
  canExtrudePath,
  type PathSerializedNode,
  type SerializedNode,
} from '../../packages/ecs/src';

const closed: PathSerializedNode = {
  id: 'shape',
  type: 'path',
  d: 'M0 0 H20 V20 H0 Z',
  fills: [{ type: 'solid', value: '#3399ff' }],
};

it('accepts a closed solid Path and inherited group fill', () => {
  expect(canExtrudePath(closed, [closed])).toBe(true);
  const group: SerializedNode = {
    id: 'group',
    type: 'g',
    fills: [{ type: 'solid', value: '#3399ff' }],
  };
  const child = { ...closed, parentId: 'group', fills: undefined };
  expect(canExtrudePath(child, [group, child])).toBe(true);
});

it('rejects open, stroked and layered Paths before enabling extrusion', () => {
  const open = { ...closed, d: 'M0 0 H20 V20' };
  const stroked = {
    ...closed,
    strokes: [{ type: 'solid' as const, value: '#000000' }],
  };
  const layered = {
    ...closed,
    fills: [
      { type: 'solid' as const, value: '#3399ff' },
      { type: 'solid' as const, value: '#ff0000' },
    ],
  };
  expect(canExtrudePath(open, [open])).toBe(false);
  expect(canExtrudePath(stroked, [stroked])).toBe(false);
  expect(canExtrudePath(layered, [layered])).toBe(false);
});

it('rejects a collapsed SVG ring contour during anchor editing', () => {
  const ring: PathSerializedNode = {
    ...closed,
    d: 'M24 30L100 0L100 100L0 100ZM28 28L72 28L72 72L28 72Z',
    fillRule: 'evenodd',
  };
  expect(canExtrudePath(ring, [ring])).toBe(false);
});
