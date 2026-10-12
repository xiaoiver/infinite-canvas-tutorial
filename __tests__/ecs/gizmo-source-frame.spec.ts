import {
  Camera,
  Children,
  Rect,
  Transform,
  type Entity,
  type SerializedNode,
} from '../../packages/ecs/src';
import { GizmoSourceFrame } from '../../packages/ecs/src/systems/pick3d/gizmo-source-frame';

function source() {
  const values = new Map<any, any>([
    [
      Transform,
      new Transform({ translation: { x: 50, y: 40 }, scale: { x: 1, y: 1 } }),
    ],
    [Rect, { width: 40, height: 40 }],
  ]);
  const entity = {
    __id: 1,
    has: (type: unknown) => values.has(type),
    read: (type: unknown) => values.get(type),
    write: (type: unknown) => values.get(type),
  } as unknown as Entity;
  const origin = () => values.get(Transform).translation;
  return { entity, values, origin };
}
const node = (pose: { x?: number; y?: number } = {}): SerializedNode => ({
  id: 'model',
  type: 'mesh3d',
  zIndex: 0,
  ...pose,
});

it('rolls back computed coordinates even when document coordinates are omitted', () => {
  const s = source();
  const frame = new GizmoSourceFrame(s.entity, node());
  Object.assign(s.origin(), { x: 70, y: 60 });
  frame.acceptPreview();
  frame.restoreOrigin(node());
  expect(s.origin()).toMatchObject({ x: 50, y: 40 });
});

it('preserves newer document coordinates, including removal to the default origin', () => {
  const s = source();
  const frame = new GizmoSourceFrame(s.entity, node({ x: 60, y: 60 }));
  Object.assign(s.origin(), { x: 70, y: 60 });
  frame.acceptPreview();
  frame.restoreOrigin(node({ x: 15 }));
  expect(s.origin()).toMatchObject({ x: 15, y: 0 });
});

it('keeps an external axis change while undoing the axis still owned by its preview', () => {
  const s = source();
  const frame = new GizmoSourceFrame(s.entity);
  Object.assign(s.origin(), { x: 70.125, y: 60.25 });
  frame.acceptPreview();
  expect(frame.current()).toBe(true);
  s.origin().x = 100;
  expect(frame.current()).toBe(false);
  frame.restoreOrigin();
  expect(s.origin()).toMatchObject({ x: 100, y: 40 });
});

it('can restore a supplied document when the source started without one', () => {
  const s = source();
  const frame = new GizmoSourceFrame(s.entity);
  s.origin().x = 70;
  frame.acceptPreview();
  frame.restoreOrigin(node({ x: 10, y: 20 }));
  expect(s.origin()).toMatchObject({ x: 10, y: 20 });
});

it('tracks local parent transforms and dimensions but excludes the scene camera', () => {
  const s = source();
  const parent = source();
  Object.defineProperty(parent.entity, '__id', { value: 2 });
  const camera = source();
  Object.defineProperty(camera.entity, '__id', { value: 3 });
  camera.values.set(Camera, {});
  parent.values.set(Children, { parent: camera.entity });
  s.values.set(Children, { parent: parent.entity });
  const frame = new GizmoSourceFrame(s.entity);
  camera.origin().x = 100;
  expect(frame.current()).toBe(true);
  parent.values.get(Transform).scale.x = -1;
  expect(frame.current()).toBe(false);
  parent.values.get(Transform).scale.x = 1;
  expect(frame.current()).toBe(true);
  parent.values.get(Rect).width = 80;
  expect(frame.current()).toBe(false);
});

it('invalidates removed geometry and missing transforms without retaining ECS views', () => {
  const s = source();
  const frame = new GizmoSourceFrame(s.entity);
  s.values.delete(Rect);
  expect(frame.current()).toBe(false);
  frame.acceptPreview();
  expect(frame.current()).toBe(true);
  s.values.delete(Transform);
  expect(frame.current()).toBe(false);
});

it('terminates on detached, deleted, or cyclic ancestors', () => {
  const s = source();
  s.values.set(Children, { parent: undefined });
  const detached = new GizmoSourceFrame(s.entity);
  expect(detached.current()).toBe(true);
  const parent = source();
  Object.defineProperty(parent.entity, '__id', { value: 2 });
  s.values.set(Children, { parent: parent.entity });
  parent.values.set(Children, { parent: s.entity });
  expect(detached.current()).toBe(false);
  const cycle = new GizmoSourceFrame(s.entity);
  expect(cycle.current()).toBe(true);
  parent.entity.has = () => {
    throw new Error('deleted entity');
  };
  expect(cycle.current()).toBe(false);
});
