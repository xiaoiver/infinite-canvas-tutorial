import type { Entity } from '../../packages/ecs/src';
import type { API } from '../../packages/ecs/src/API';
import type { MeshPipeline3D } from '../../packages/ecs/src/systems/MeshPipeline3D';
import {
  getMeshPipeline3D,
  registerMeshPipeline3D,
  syncMeshPipeline3DCanvases,
  unregisterMeshPipeline3D,
} from '../../packages/ecs/src/systems/mesh3d-bridge';

const first = {} as MeshPipeline3D;
const second = {} as MeshPipeline3D;
const a = {} as API;
const b = {} as API;
const canvas = (api: API) => ({ read: () => ({ api }) } as unknown as Entity);
afterEach(() => {
  unregisterMeshPipeline3D(first);
  unregisterMeshPipeline3D(second);
});

it('keeps the legacy accessor only when its initialized owner is unambiguous', () => {
  expect(getMeshPipeline3D()).toBeNull();
  registerMeshPipeline3D(first);
  expect(getMeshPipeline3D()).toBe(first);
  registerMeshPipeline3D(second);
  expect(getMeshPipeline3D()).toBeNull();
  unregisterMeshPipeline3D(second);
  expect(getMeshPipeline3D()).toBe(first);
});

it('resolves by canvas identity and removes disposed canvases without disturbing others', () => {
  syncMeshPipeline3DCanvases(first, [a, b]);
  registerMeshPipeline3D(first); // repeated registration must preserve membership
  expect(getMeshPipeline3D(canvas(a))).toBe(first);
  expect(getMeshPipeline3D(canvas(b))).toBe(first);
  syncMeshPipeline3DCanvases(first, [a]);
  expect(getMeshPipeline3D(canvas(b))).toBeNull();
  expect(getMeshPipeline3D(canvas(a))).toBe(first);
  unregisterMeshPipeline3D(first);
  expect(getMeshPipeline3D(canvas(a))).toBeNull();
});

it('does not erase reassigned canvas ownership when an old renderer exits', () => {
  syncMeshPipeline3DCanvases(first, [a, b]);
  syncMeshPipeline3DCanvases(second, [a, b]);
  syncMeshPipeline3DCanvases(first, [a]);
  unregisterMeshPipeline3D(second);
  expect(getMeshPipeline3D(canvas(a))).toBe(first);
  expect(getMeshPipeline3D(canvas(b))).toBeNull();
  expect(getMeshPipeline3D(canvas({} as API))).toBeNull();
});
