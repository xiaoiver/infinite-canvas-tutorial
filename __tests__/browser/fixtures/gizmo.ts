import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultRenderer3DPlugin,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  Pen,
  Mesh3DNode,
  Transform3D,
  Selected3D,
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';

let api: API;
class Bootstrap extends System {
  access = this.query((q) => q.usingAll.write);
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    api.createCanvas({
      element: document.querySelector<HTMLCanvasElement>('#canvas')!,
      width: 200,
      height: 200,
      devicePixelRatio: 1,
    });
    api.createCamera({ zoom: 1, x: 0, y: 0 });
    api.setAppState({ penbarSelected: Pen.SELECT });
  }
}
const app = new App().addPlugins(
  ...DefaultPlugins,
  DefaultRenderer3DPlugin,
  () => {
    system(PreStartUp)(Bootstrap);
    system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
  },
);
const harness = {
  api: () => api,
  settle: () => settleECSFrames(api, 3),
  state: () => {
    const node = api.getNodeById('model');
    const mesh = api.getEntity(node).read(Mesh3DNode).meshEntity!;
    return {
      node,
      translation: [...mesh.read(Transform3D).translation],
      dragging: mesh.has(Selected3D) && mesh.read(Selected3D).dragging,
    };
  },
};
declare global {
  interface Window {
    gizmoTest: typeof harness;
  }
}
window.gizmoTest = harness;
async function init() {
  await app.run();
  await api.edit(
    (editor) => {
      editor.replaceDocument(
        [
          {
            id: 'model',
            type: 'mesh3d',
            zIndex: 0,
            x: 60,
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
  await harness.settle();
  api.clearHistory();
  document.querySelector('#status')!.textContent = 'Ready';
}
void init();
