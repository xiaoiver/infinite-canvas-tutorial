import {
  groupGizmoPose,
  groupMemberPose,
} from '../../packages/ecs/src/utils/gizmo-group';
import type { GizmoPose } from '../../packages/ecs/src/systems/pick3d/gizmo-gesture';

const first: GizmoPose = {
  translation: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [2, 3, 4],
};
const second: GizmoPose = {
  translation: [10, 0, 0],
  rotation: [0, 0, Math.PI / 4],
  scale: [5, 6, 7],
};

it('places one world-aligned gizmo at the selected center', () => {
  expect(groupGizmoPose([first, second])).toEqual({
    translation: [5, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });
});

it('translates every member by the same world-space delta', () => {
  const initial = groupGizmoPose([first, second])!;
  const current = {
    ...initial,
    translation: [15, 2, 3] as [number, number, number],
  };
  expect(groupMemberPose(first, initial, current)).toEqual({
    ...first,
    translation: [10, 2, 3],
  });
  expect(groupMemberPose(second, initial, current)).toEqual({
    ...second,
    translation: [20, 2, 3],
  });
});

it('rotates member positions and orientations around the shared center', () => {
  const initial = groupGizmoPose([first, second])!;
  const current = {
    ...initial,
    rotation: [0, 0, Math.PI / 2] as [number, number, number],
  };
  const a = groupMemberPose(first, initial, current);
  const b = groupMemberPose(second, initial, current);
  expect(a.translation[0]).toBeCloseTo(5);
  expect(a.translation[1]).toBeCloseTo(-5);
  expect(b.translation[0]).toBeCloseTo(5);
  expect(b.translation[1]).toBeCloseTo(5);
  expect(a.rotation[2]).toBeCloseTo(Math.PI / 2);
  expect(b.rotation[2]).toBeCloseTo((3 * Math.PI) / 4);
  expect(a.scale).toEqual(first.scale);
  expect(b.scale).toEqual(second.scale);
});
