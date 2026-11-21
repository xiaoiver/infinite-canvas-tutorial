import { Group, Rect } from '../../packages/core/src';

it.each([0, 0.1, -1])(
  'keeps Core painter order clean for paint and unchanged rank %s',
  (zIndex) => {
    const parent = new Group();
    const shape = new Rect({ zIndex, width: 20, height: 20, fill: 'blue' });
    parent.appendChild(shape);
    parent.sortDirtyFlag = false;
    shape.renderDirtyFlag = false;
    shape.fill = 'red';
    shape.zIndex = zIndex;
    expect(parent.sortDirtyFlag).toBe(false);
    expect(shape.renderDirtyFlag).toBe(true);
    expect(shape.zIndex).toBe(zIndex);
    shape.zIndex = zIndex + 1;
    expect(parent.sortDirtyFlag).toBe(true);
  },
);

it('invalidates Core parent order on reparenting without changing the numeric rank', () => {
  const left = new Group(),
    right = new Group();
  const shape = new Rect({ zIndex: 0, width: 20, height: 20 });
  left.appendChild(shape);
  left.sortDirtyFlag = right.sortDirtyFlag = false;
  right.appendChild(shape);
  expect(shape.parent).toBe(right);
  expect(shape.zIndex).toBe(0);
  expect(left.sortDirtyFlag).toBe(true);
  expect(right.sortDirtyFlag).toBe(true);
});
