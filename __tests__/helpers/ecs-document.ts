import { JSDOM } from 'jsdom';
import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultRendererPlugin,
  DefaultStateManagement,
  DOMAdapter,
  PreStartUp,
  Pen,
  Theme,
  RendererPlugin,
  System,
  system,
  type SerializedNode,
  type Plugin,
} from '../../packages/ecs/src';

/** Real scene/history systems, explicit frames, and no GPU allocation. */
export async function createDocumentWorld(
  count = 1,
  pointerEvents = false,
  extraPlugins: Plugin[] = [],
) {
  const previousAdapter = DOMAdapter.get();
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const { window } = new JSDOM();
  // jsdom has MouseEvent but no PointerEvent. The driver supplies pointer fields.
  if (pointerEvents) {
    Object.defineProperty(window, 'PointerEvent', { value: window.MouseEvent });
  }
  globalThis.window = window as unknown as Window & typeof globalThis;
  globalThis.document = window.document;
  DOMAdapter.set({
    ...previousAdapter,
    getWindow: () => window as unknown as Window & typeof globalThis,
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
  const apis: API[] = [];
  class NoopRenderer extends System {}
  class NoopDevice extends System {}
  class Bootstrap extends System {
    commands = new Commands(this);
    access = this.query((q) => q.usingAll.write);
    initialize() {
      for (let i = 0; i < count; i++) {
        const api = new API(new DefaultStateManagement(), this.commands);
        api.createCanvas({
          element: DOMAdapter.get().createCanvas(),
          width: 200,
          height: 200,
        });
        api.createCamera({ zoom: 1, x: 0, y: 0 });
        api.getCanvas().add(Theme);
        api.setAppState({ penbarSelected: Pen.SELECT });
        api.record('NEVER');
        apis.push(api);
      }
    }
  }
  const app = new App().addPlugins(
    ...DefaultPlugins.map((plugin) =>
      plugin === DefaultRendererPlugin
        ? RendererPlugin.configure({
            rendererSystemCtor: NoopRenderer as any,
            setupDeviceSystemCtor: NoopDevice as any,
          })
        : plugin,
    ),
    ...extraPlugins,
    () => {
      system(PreStartUp)(Bootstrap);
      system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
    },
  );
  const dispose = async () => {
    try {
      await app.exit();
    } finally {
      DOMAdapter.set(previousAdapter);
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      window.close();
    }
  };
  try {
    await app.run();
    await app.world.execute();
  } catch (error) {
    await dispose();
    throw error;
  }
  const frame = () => app.world.execute();
  const edit = async (
    api: API,
    update: (api: API) => void,
    capture: 'IMMEDIATELY' | 'NEVER' = 'IMMEDIATELY',
  ) => {
    const pending = api.edit(update, { capture });
    // Observe rejection immediately, including invalid document validation.
    const settled = pending.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await frame();
    const result = await settled;
    if ('error' in result) throw result.error;
    return result.value;
  };
  return {
    window,
    apis,
    frame,
    edit,
    dispose,
    async reset(api: API, nodes: SerializedNode[]) {
      await edit(
        api,
        (editor) => {
          editor.selectNodes([]);
          editor.highlightNodes([]);
          editor.setAppState({ filter: '' });
          editor.replaceDocument(nodes, 'remote');
        },
        'NEVER',
      );
      api.clearHistory();
    },
    async history(api: API, action: 'undo' | 'redo') {
      api[action]();
      await frame();
    },
  };
}
