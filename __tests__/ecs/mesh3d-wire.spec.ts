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

it.each([
  [undefined, 0],
  [-1, 0],
  [0, 0],
  [2, 2],
  [12, 8],
  [Number.NaN, 0],
])('normalizes mesh outlineWidth %s to %s', (outlineWidth, expected) => {
  expect(
    mesh3DNodeFromWire({ ...cube, material3d: { outlineWidth } }).outlineWidth,
  ).toBe(expected);
});

it('parses a mesh outline color separately from the base color', () => {
  const material = mesh3DNodeFromWire({
    ...cube,
    material3d: { baseColor: '#4774df', outlineColor: '#1e3264' },
  });
  expect(material.outlineColor).toEqual([30 / 255, 50 / 255, 100 / 255, 1]);
  expect(material.baseColor).not.toEqual(material.outlineColor);
});

it.each([
  [undefined, 0],
  [-1, 0],
  [0, 0],
  [0.9, 0.9],
  [2, 1],
  [Number.NaN, 0],
])('normalizes mesh rimLightStrength %s to %s', (strength, expected) => {
  expect(
    mesh3DNodeFromWire({
      ...cube,
      material3d: { rimLightStrength: strength },
    }).rimLightStrength,
  ).toBeCloseTo(expected);
});

it('parses rim light color separately from the base color', () => {
  const material = mesh3DNodeFromWire({
    ...cube,
    material3d: { baseColor: '#4774df', rimLightColor: '#9ad9ff' },
  });
  expect(material.rimLightColor).toEqual([154 / 255, 217 / 255, 1, 1]);
  expect(material.baseColor).not.toEqual(material.rimLightColor);
});
