import { JSDOM } from 'jsdom';
import {
  API,
  App,
  Commands,
  ComputedBounds,
  DefaultPlugins,
  DefaultRendererPlugin,
  DefaultStateManagement,
  DOMAdapter,
  GlobalTransform,
  Name,
  PreStartUp,
  Rect,
  RendererPlugin,
  System,
  ToBeDeleted,
  system,
} from '../../packages/ecs/src';

it('applies edits and history before derived data/rendering while preserving late callbacks and deletion', async () => {
  const previousAdapter = DOMAdapter.get();
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const { window } = new JSDOM();
  globalThis.window = window as any;
  globalThis.document = window.document;
  DOMAdapter.set({
    ...previousAdapter,
    getWindow: () => window as any,
    getDocument: () => window.document,
    createCanvas: (width = 200, height = 200) => {
      const canvas = window.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
  });
  let api: API;
  const rendered: {
    id: string;
    x: number;
    width: number;
    minX: number;
    maxX: number;
  }[][] = [];
  class RenderProbe extends System {
    entities = this.query((q) => q.current.with(Rect, Name).usingAll.read);
    execute() {
      rendered.push(
        this.entities.current
          .filter(
            (entity) =>
              !entity.has(ToBeDeleted) && !!api.getNodeByEntity(entity),
          )
          .map((entity) => ({
            id: api.getNodeByEntity(entity).id,
            x: entity.read(GlobalTransform).matrix.m20,
            width: entity.read(Rect).width,
            minX: entity.read(ComputedBounds).geometryWorldBounds.minX,
            maxX: entity.read(ComputedBounds).geometryWorldBounds.maxX,
          })),
      );
    }
  }
  // Run the real scene systems and scheduler without allocating a GPU device.
  class SetupProbe extends System {}
  class StartUpSystem extends System {
    commands = new Commands(this);
    access = this.query((q) => q.usingAll.write);
    initialize() {
      api = new API(new DefaultStateManagement(), this.commands);
      api.createCanvas({
        element: DOMAdapter.get().createCanvas(),
        width: 200,
        height: 200,
      });
      api.createCamera({ zoom: 1, x: 0, y: 0 });
      api.updateNodes([
        {
          id: 'a',
          type: 'rect',
          zIndex: 0,
          x: 10,
          y: 10,
          width: 20,
          height: 20,
        },
      ]);
      api.record('NEVER');
    }
  }
  const app = new App().addPlugins(
    ...DefaultPlugins.map((plugin) =>
      plugin === DefaultRendererPlugin
        ? RendererPlugin.configure({
            rendererSystemCtor: RenderProbe as any,
            setupDeviceSystemCtor: SetupProbe as any,
          })
        : plugin,
    ),
    () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.inAnyOrderWith(s.allSystems))(StartUpSystem);
    },
  );
  try {
    await app.run();
    await app.world.execute();
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 10,
      width: 20,
      minX: 10,
      maxX: 30,
    });
    const legacy = jest.fn();
    const edited = api.edit((editor) => {
      editor.updateNodes([{ ...editor.getNodeById('a'), x: 40, width: 50 }]);
      editor.runAtNextTick(legacy);
    });
    await app.world.execute();
    expect(await edited).toBe(true);
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 40,
      width: 50,
      minX: 40,
      maxX: 90,
    });
    expect(legacy).not.toHaveBeenCalled();
    api.undo();
    await app.world.execute();
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 10,
      width: 20,
      minX: 10,
      maxX: 30,
    });
    expect(legacy).toHaveBeenCalledTimes(1);
    api.redo();
    await app.world.execute();
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 40,
      width: 50,
      minX: 40,
      maxX: 90,
    });
    api.undo();
    const afterUndo = api.edit((editor) =>
      editor.updateNodes([{ ...editor.getNodeById('a'), width: 60 }]),
    );
    await app.world.execute();
    expect(await afterUndo).toBe(true);
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 10,
      width: 60,
      minX: 10,
      maxX: 70,
    });
    api.undo();
    await app.world.execute();
    expect(api.getNodeById('a').width).toBe(20);

    // Structural rebuilds keep old entities alive until the renderer has
    // processed their removal; the replacement is derived in this same frame.
    const previousEntity = api.getEntity(api.getNodeById('a')).hold();
    const replacement = api.edit(
      (editor) =>
        editor.replaceDocument([
          { id: 'parent', type: 'g', zIndex: 0, x: 30, y: 0 },
          {
            id: 'a',
            type: 'rect',
            parentId: 'parent',
            zIndex: 0,
            x: 5,
            y: 10,
            width: 25,
            height: 20,
          },
        ]),
      { capture: 'NEVER' },
    );
    await app.world.execute();
    expect(await replacement).toBe(true);
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 35,
      width: 25,
      minX: 35,
      maxX: 60,
    });
    expect(api.getEntity(api.getNodeById('a'))).not.toBe(previousEntity);
    expect(() => previousEntity.read(Rect)).toThrow();

    const deleted = api.edit((editor) => editor.deleteNodesById(['parent']));
    await app.world.execute();
    expect(await deleted).toBe(true);
    expect(rendered.at(-1)).toEqual([]);
    api.undo();
    await app.world.execute();
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 35,
      width: 25,
      minX: 35,
      maxX: 60,
    });

    api.runAtNextTick(() => {
      api.updateNodes([{ ...api.getNodeById('a'), width: 80 }]);
      api.record();
    });
    await app.world.execute();
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 35,
      width: 25,
      minX: 35,
      maxX: 60,
    });
    await app.world.execute();
    expect(rendered.at(-1)).toContainEqual({
      id: 'a',
      x: 35,
      width: 80,
      minX: 35,
      maxX: 115,
    });
  } finally {
    await app.exit();
    DOMAdapter.set(previousAdapter);
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    window.close();
  }
});
