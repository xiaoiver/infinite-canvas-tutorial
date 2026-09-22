import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultStateManagement,
  DOMAdapter,
  PreStartUp,
  Pen,
  System,
  system,
  Rect,
  Canvas,
  Theme,
  Grid,
  Camera,
  Parent,
  Children,
  Transform,
  Renderable,
  FillSolid,
  Stroke,
  Visibility,
  Name,
  DropShadow,
  ZIndex,
  ComputeZIndex,
} from '../../packages/ecs/src';
import { NodeJSAdapter } from '../utils';

// Drive frame boundaries explicitly; no timers or rendering sleeps are needed.
DOMAdapter.set({
  ...NodeJSAdapter,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

describe('API transactions in the real ECS world', () => {
  it('commits a mixed batch once and preserves undo/redo and nested task ordering', async () => {
    let api: API;
    const state = new DefaultStateManagement();
    class StartUpSystem extends System {
      commands = new Commands(this);
      access = this.query(
        (q) =>
          q.using(
            Canvas,
            Theme,
            Grid,
            Camera,
            Parent,
            Children,
            Transform,
            Renderable,
            FillSolid,
            Stroke,
            Rect,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
          ).write,
      );
      initialize() {
        api = new API(state, this.commands);
        api.createCanvas({
          element: DOMAdapter.get().createCanvas(100, 100),
          width: 100,
          height: 100,
        });
        api.createCamera({ zoom: 1 });
        api.updateNodes([
          { id: 'a', type: 'rect', width: 10, height: 10, x: 0, y: 0 },
        ]);
        api.record();
      }
    }
    const app = new App().addPlugins(...DefaultPlugins, () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.before(ComputeZIndex))(StartUpSystem);
    });
    await app.run();
    try {
      const commit = jest.spyOn(state, 'setNodes');
      const nested = jest.fn();
      api.runAtNextTick(() => {
        api.updateNodes([
          { ...api.getNodeById('a'), width: 30 },
          { id: 'b', type: 'rect', width: 20, height: 20, x: 10, y: 10 },
        ]);
        api.record();
        api.runAtNextTick(nested);
      });
      await app.world.execute();
      expect(commit).toHaveBeenCalledTimes(1);
      expect(api.getNodes().map((node) => node.id)).toEqual(['a', 'b']);
      expect(api.getEntity({ id: 'a' }).read(Rect).width).toBe(30);
      expect(nested).not.toHaveBeenCalled();
      await app.world.execute();
      expect(nested).toHaveBeenCalledTimes(1);
      api.undo();
      await app.world.execute();
      expect(api.getNodeById('a').width).toBe(10);
      expect(api.getNodeById('b')).toBeUndefined();
      api.redo();
      await app.world.execute();
      expect(api.getNodeById('a').width).toBe(30);
      expect(api.getNodeById('b').width).toBe(20);

      const changes = jest.fn();
      api.onchange = changes;
      api.clearHistory();
      commit.mockClear();
      api.runAtNextTick(() =>
        api.replaceDocument(
          [
            {
              id: 'b',
              type: 'rect',
              width: 44,
              height: 20,
              x: 10,
              y: 10,
              version: 1,
            },
          ],
          'remote',
        ),
      );
      await app.world.execute();
      expect(api.getNodes().map((node) => node.id)).toEqual(['b']);
      expect(api.getEntity({ id: 'a' })).toBeUndefined();
      expect(api.getEntity({ id: 'b' }).read(Rect).width).toBe(44);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(api.isUndoStackEmpty()).toBe(true);
      expect(changes).not.toHaveBeenCalled();

      api.runAtNextTick(() => {
        api.updateNode(api.getNodeById('b'), { width: 55 });
        api.record();
        api.replaceDocument(
          [{ ...api.getNodeById('b'), fill: 'green' }],
          'remote',
        );
      });
      await app.world.execute();
      expect(changes).toHaveBeenCalledTimes(1);
      api.undo();
      await app.world.execute();
      expect(api.getNodeById('b').width).toBe(44);
      expect(api.getNodeById('b').fill).toBe('green');
      expect(changes).toHaveBeenCalledTimes(2);
      api.redo();
      await app.world.execute();
      expect(api.getNodeById('b').width).toBe(55);
      expect(changes).toHaveBeenCalledTimes(3);

      // Validate the complete hierarchy before modifying anything.
      const before = api.getNodes();
      expect(() =>
        api.replaceDocument([{ id: 'b', parentId: 'missing', type: 'rect' }]),
      ).toThrow('Missing parent');
      expect(api.getNodes()).toEqual(before);
      api.runAtNextTick(() =>
        api.replaceDocument([
          { id: 'parent', type: 'rect', x: 0, y: 0, width: 50, height: 50 },
          {
            id: 'child',
            parentId: 'parent',
            type: 'rect',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            fill: 'red',
          },
        ]),
      );
      await app.world.execute();
      expect(api.getParent(api.getNodeById('child'))).toBe(
        api.getEntity({ id: 'parent' }),
      );
      api.clearHistory();
      api.runAtNextTick(() => {
        api.setAppState({ penbarSelected: Pen.SELECT });
        api.selectNodes([api.getNodeById('child')]);
        api.record('NEVER');
      });
      await app.world.execute();
      expect(api.getAppState().layersSelected).toEqual(['child']);
      // Reparent and remove an attribute; retained IDs must receive fresh ECS defaults.
      api.runAtNextTick(() =>
        api.replaceDocument(
          [{ id: 'child', type: 'rect', x: 0, y: 0, width: 10, height: 10 }],
          'local',
        ),
      );
      await app.world.execute();
      expect(api.getParent(api.getNodeById('child')).has(Camera)).toBe(true);
      expect(api.getNodeById('child').fill).toBeUndefined();
      expect(api.getEntity({ id: 'child' }).has(FillSolid)).toBe(false);
      expect(api.getAppState().layersSelected).toEqual(['child']);
      api.undo();
      await app.world.execute();
      expect(api.getNodeById('parent')).toBeDefined();
      expect(api.getNodeById('child').parentId).toBe('parent');
      expect(api.getEntity({ id: 'child' }).has(FillSolid)).toBe(true);
      api.redo();
      await app.world.execute();
      expect(api.getNodeById('parent')).toBeUndefined();
      expect(api.getParent(api.getNodeById('child')).has(Camera)).toBe(true);
      expect(api.getEntity({ id: 'child' }).has(FillSolid)).toBe(false);
      api.runAtNextTick(() => api.replaceDocument([]));
      await app.world.execute();
      expect(api.getNodes()).toEqual([]);
    } finally {
      await app.exit();
    }
  });
});
