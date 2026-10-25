import type { Mesh3DNodeSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import { mesh3DNodeFromWire } from '../../packages/ecs/src/utils/mesh3d-wire';

const cube: Mesh3DNodeSerializedNode = {
  id: 'cube',
  type: 'mesh3d',
  geometry: { type: 'cube' },
};

it.each([
  [undefined, 0],
  [0, 0],
  [1, 0],
  [2, 2],
  [4, 4],
  [8, 8],
  [9, 0],
  [2.5, 0],
  [Number.NaN, 0],
])('normalizes mesh toneSteps %s to %s', (toneSteps, expected) => {
  expect(
    mesh3DNodeFromWire({ ...cube, material3d: { toneSteps } }).toneSteps,
  ).toBe(expected);
});

it('keeps continuous PBR shading as the default for a material-free mesh', () => {
  expect(mesh3DNodeFromWire(cube).toneSteps).toBe(0);
});
