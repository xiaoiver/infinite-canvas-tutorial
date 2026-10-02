import { JSDOM } from 'jsdom';
import { XMLSerializer as NodeXMLSerializer } from '@xmldom/xmldom';
import { toMatchSVGSnapshot } from '../toMatchSVGSnapshot';
import {
  API,
  App,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultRendererPlugin,
  DefaultStateManagement,
  Grid,
  PreStartUp,
  RendererPlugin,
  System,
  Theme,
  system,
} from '../../packages/ecs/src';

describe('Export SVG', () => {
  it('should export stroke alignment outer correctly', async () => {
    const previousAdapter = DOMAdapter.get();
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const { window } = new JSDOM();
    globalThis.window = window as unknown as Window & typeof globalThis;
    globalThis.document = window.document;
    DOMAdapter.set({
      ...previousAdapter,
      getWindow: () => window as unknown as typeof globalThis,
      getDocument: () => window.document,
      getXMLSerializer: () =>
        new NodeXMLSerializer() as unknown as XMLSerializer,
      createCanvas: (width = 200, height = 200) => {
        const canvas = window.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      },
      // Advance the real ECS schedule explicitly; SVG export needs no GPU.
      requestAnimationFrame: () => 0,
      cancelAnimationFrame() {},
    });

    let api!: API;
    class StartUpSystem extends System {
      commands = new Commands(this);
      access = this.query((q) => q.usingAll.write);
      initialize() {
        api = new API(new DefaultStateManagement(), this.commands);
        api.createCanvas({
          element: DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });
        api.getCanvas().add(Theme);
        api.getCanvas().add(Grid);
        api.createCamera({ zoom: 1 });
        api.updateNodes([
          {
            id: '1',
            type: 'rect',
            fills: [{ type: 'solid', value: 'red', opacity: 0.5 }],
            strokes: [{ type: 'solid', value: 'blue', opacity: 0.5 }],
            strokeWidth: 10,
            strokeAlignment: 'outer',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            zIndex: 0,
          },
        ]);
      }
    }
    class SetupDevice extends System {}
    class Render extends System {}
    const app = new App().addPlugins(
      ...DefaultPlugins.map((plugin) =>
        plugin === DefaultRendererPlugin
          ? RendererPlugin.configure({
              setupDeviceSystemCtor: SetupDevice,
              rendererSystemCtor: Render,
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
      const svg = await api.renderToSVG([]);
      const serialized = DOMAdapter.get()
        .getXMLSerializer()!
        .serializeToString(svg);
      const result = toMatchSVGSnapshot(
        serialized,
        `${__dirname}/snapshots`,
        'export-stroke-alignment-outer',
      );
      if (!result.pass) throw new Error(result.message());
    } finally {
      try {
        await app.exit();
      } finally {
        DOMAdapter.set(previousAdapter);
        globalThis.window = previousWindow;
        globalThis.document = previousDocument;
        window.close();
      }
    }
  });
});
