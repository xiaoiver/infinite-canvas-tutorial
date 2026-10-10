import type { Entity } from '../../packages/ecs/src';
import {
  Camera3D,
  Canvas,
  Canvas3DScope,
  GPUResource,
  Selected3D,
  Transform3D,
} from '../../packages/ecs/src/components';
import { RenderGizmo3D } from '../../packages/ecs/src/systems/RenderGizmo3D';
import { fakeGizmoGPU } from './helpers/gizmo-gpu';

// Test ownership with real resources/cache and controlled query snapshots. Real
// schedule/access masks and rendered pixels are covered by browser gizmo tests.
jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  ...jest.requireActual<
    typeof import('../../packages/ecs/node_modules/@lastolivegames/becsy')
  >('../../packages/ecs/node_modules/@lastolivegames/becsy'),
  System: class {
    static group = jest.requireActual<any>(
      '../../packages/ecs/node_modules/@lastolivegames/becsy',
    ).System.group;
    query() {
      return { current: [] };
    }
  },
  co: (_target: any, _key: string, descriptor: any) => descriptor,
}));

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
function fixture(count = 1) {
  const renderer = new RenderGizmo3D();
  const entity = (values: Map<any, any>, id = 0) =>
    ({
      __id: id,
      has: (type: any) => values.has(type),
      read: (type: any) => values.get(type),
    } as unknown as Entity);
  const slots = Array.from({ length: count }, (_, id) => {
    const gpu = fakeGizmoGPU();
    cleanups.push(() => gpu.scope.dispose());
    const data = { api: {}, width: 200, height: 200 };
    const values = new Map<any, any>([
      [Canvas, data],
      [GPUResource, gpu],
    ]);
    const canvas = entity(values);
    const selectedValues = new Map<any, any>([
      [Canvas3DScope, { canvas }],
      [Selected3D, { activeAxis: 'none', activePartKind: null }],
      [Transform3D, { translation: [0, 0, 0], rotation: [0, 0, 0] }],
    ]);
    const selected = entity(selectedValues, id);
    const camera = entity(
      new Map<any, any>([
        [Canvas3DScope, { canvas }],
        [
          Camera3D,
          {
            linked: false,
            projection: 'orthographic',
            eye: [0, 0, 300],
            center: [0, 0, 0],
            up: [0, 1, 0],
            near: 0.1,
            far: 1000,
          },
        ],
      ]),
    );
    return { gpu, canvas, data, values, selected, selectedValues, camera };
  });
  const queries = renderer as any;
  queries.canvases.current = slots.map((slot) => slot.canvas);
  queries.cameras3D.current = slots.map((slot) => slot.camera);
  queries.selected3D.current = slots.map((slot) => slot.selected);
  cleanups.push(() => renderer.finalize());
  const draw = (index = 0) =>
    renderer.drawGizmos(slots[index].gpu.pass, slots[index].canvas, 400, 400);
  return { renderer, queries, slots, draw };
}

it('isolates canvas resources and releases them before their GPU owners', () => {
  const { renderer, slots, draw } = fixture(2);
  draw(0);
  draw(1);
  for (const { gpu } of slots) expect(gpu.draws.length).toBeGreaterThan(0);
  slots[1].gpu.scope.dispose();
  for (const buffer of slots[0].gpu.buffers)
    expect(buffer.destroy).not.toHaveBeenCalled();
  draw(0);
  renderer.finalize();
  for (const { gpu } of slots) {
    for (const buffer of gpu.buffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
    const disposed = gpu.releases.filter((entry) => entry.startsWith('buffer'));
    expect(disposed).toHaveLength(gpu.buffers.length);
  }
});

it.each(['renderCache', 'scope', 'device'] as const)(
  'replaces resources when the GPU %s changes',
  (key) => {
    const {
      renderer,
      slots: [slot],
      draw,
    } = fixture();
    draw();
    const old = [...slot.gpu.buffers];
    const replacement = fakeGizmoGPU();
    cleanups.push(() => replacement.scope.dispose());
    slot.values.set(GPUResource, { ...slot.gpu, [key]: replacement[key] });
    // Draw may run before execute sees the replaced component.
    draw();
    for (const buffer of old) expect(buffer.destroy).toHaveBeenCalledTimes(1);
    const currentBuffers = [...slot.gpu.buffers, ...replacement.buffers].filter(
      (buffer) => !old.includes(buffer),
    );
    expect(currentBuffers.length).toBeGreaterThan(0);
    // Disposing the old owner must not dispose the new scope's resources.
    if (key === 'scope') {
      slot.gpu.scope.dispose();
      for (const buffer of currentBuffers)
        expect(buffer.destroy).not.toHaveBeenCalled();
    }
    renderer.finalize();
    for (const buffer of currentBuffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
  },
);

it.each(['removed canvas', 'removed GPU', 'replaced scope'])(
  'execute releases an invalid owner: %s',
  (reason) => {
    const {
      renderer,
      queries,
      slots: [slot],
      draw,
    } = fixture();
    draw();
    if (reason === 'removed canvas') queries.canvases.current = [];
    else if (reason === 'removed GPU') slot.values.delete(GPUResource);
    else {
      const replacement = fakeGizmoGPU();
      cleanups.push(() => replacement.scope.dispose());
      slot.values.set(GPUResource, replacement);
    }
    renderer.execute();
    for (const resource of [...slot.gpu.buffers, ...slot.gpu.bindings])
      expect(resource.destroy).toHaveBeenCalledTimes(1);
  },
);

it('reclaims deselected object uniforms even when no further draws are submitted', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    draw,
  } = fixture();
  draw();
  queries.selected3D.current = [];
  expect(renderer.hasGizmoContent()).toBe(false);
  renderer.execute();
  for (const binding of slot.gpu.bindings)
    expect(binding.destroy).toHaveBeenCalledTimes(1);
  expect(
    slot.gpu.buffers.some((buffer) => !buffer.destroy.mock.calls.length),
  ).toBe(true);
});

it.each([
  'empty selection',
  'no camera',
  'no GPU',
  'invalid viewport',
  'invalid projection',
  'already disposed owner',
])('does not submit draws for %s', (reason) => {
  const {
    renderer,
    queries,
    slots: [slot],
    draw,
  } = fixture();
  if (reason === 'empty selection') queries.selected3D.current = [];
  if (reason === 'no camera') queries.cameras3D.current = [];
  if (reason === 'no GPU') slot.values.delete(GPUResource);
  if (reason === 'invalid projection')
    slot.selectedValues.get(Transform3D).translation = [NaN, 0, 0];
  if (reason === 'already disposed owner') slot.gpu.scope.dispose();
  if (reason === 'invalid viewport')
    renderer.drawGizmos(slot.gpu.pass, slot.canvas, 0, 400);
  else draw();
  expect(slot.gpu.draws).toEqual([]);
});
