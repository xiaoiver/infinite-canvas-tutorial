import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultRenderer3DPlugin,
  DefaultStateManagement,
  Pen,
  PreStartUp,
  System,
  system,
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';

const apis: API[] = [];
let app: App;
class BootstrapWorld extends System {
  access = this.query((q) => q.usingAll.write);
  initialize() {
    for (const id of ['first', 'second']) {
      const api = new API(new DefaultStateManagement(), new Commands(this));
      api.createCanvas({
        element: document.querySelector<HTMLCanvasElement>(`#${id}`)!,
        width: 200,
        height: 200,
        devicePixelRatio: 1,
      });
      api.createCamera({ x: 0, y: 0, zoom: 1 });
      api.setAppState({ penbarSelected: Pen.SELECT });
      apis.push(api);
    }
  }
}
function createApp() {
  return new App().addPlugins(
    ...DefaultPlugins,
    DefaultRenderer3DPlugin,
    () => {
      system(PreStartUp)(BootstrapWorld);
      system((s) => s.inAnyOrderWith(s.allSystems))(BootstrapWorld);
    },
  );
}
const harness = {
  async move(index: number, x: number) {
    const api = apis[index];
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('model'), { x }),
    );
    await settleECSFrames(api, 3);
  },
  async destroySecond() {
    apis[1].destroy();
    await settleECSFrames(apis[0], 3);
  },
  async rejectSecondWorld() {
    // Becsy forbids concurrent Worlds sharing component types. Rejection must
    // not replace the active World's renderer with an uninitialized instance.
    try {
      await createApp().run();
      throw new Error('Expected Becsy to reject a concurrent World');
    } catch (error) {
      return (error as Error).message;
    }
  },
  async restart() {
    await app.exit();
    apis.length = 0;
    for (const id of ['first', 'second']) {
      const canvas = document.createElement('canvas');
      canvas.id = id;
      document.getElementById(id)!.replaceWith(canvas);
    }
    await init();
  },
};
declare global {
  interface Window {
    gizmoWorlds: typeof harness;
  }
}
window.gizmoWorlds = harness;
async function init() {
  app = createApp();
  await app.run();
  for (const api of apis) {
    await api.edit(
      (editor) => {
        editor.replaceDocument(
          [
            {
              id: 'model',
              type: 'mesh3d',
              zIndex: 0,
              x: 40,
              y: 60,
              width: 40,
              height: 40,
              scale3d: 20,
            },
          ],
          'remote',
        );
        editor.selectNodes([editor.getNodeById('model')]);
      },
      { capture: 'NEVER' },
    );
    await settleECSFrames(api, 3);
  }
  document.querySelector('#status')!.textContent = 'Ready';
}
void init();
