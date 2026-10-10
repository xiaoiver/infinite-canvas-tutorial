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
  Extrude3D,
  Camera3D,
  Canvas3DScope,
  type SerializedNode,
  Transform3D,
  Selected3D,
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';

let api: API;
const params = new URLSearchParams(location.search);
const width = Number(params.get('width') || 200);
const height = Number(params.get('height') || 200);
const zoom = Number(params.get('zoom') || 1);
const rotation = Number(params.get('rotation') || 0);
const z = Number(params.get('z') || 0);
class Bootstrap extends System {
  access = this.query((q) => q.usingAll.write);
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    const element = document.querySelector<HTMLCanvasElement>('#canvas')!;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    api.createCanvas({
      element,
      width,
      height,
      devicePixelRatio: Number(params.get('dpr') || 1),
    });
    api.createCamera({ zoom, x: 0, y: 0, rotation });
    api.setAppState({ penbarSelected: Pen.SELECT });
    if (params.has('extrude')) {
      const commands = new Commands(this);
      commands.spawn(
        new Camera3D({
          linked: true,
          projection: 'perspective',
          clearColor: false,
        }),
        new Canvas3DScope({ canvas: api.getCanvas() }),
      );
      commands.execute();
    }
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
    const entity = api.getEntity(node);
    const mesh = entity.has(Extrude3D)
      ? entity.read(Extrude3D).meshEntity!
      : entity.read(Mesh3DNode).meshEntity!;
    return {
      node,
      translation: [...mesh.read(Transform3D).translation],
      rotation: [...mesh.read(Transform3D).rotation],
      scale: [...mesh.read(Transform3D).scale],
      dragging: mesh.has(Selected3D) && mesh.read(Selected3D).dragging,
      axis: mesh.has(Selected3D) ? mesh.read(Selected3D).activeAxis : 'none',
      partKind: mesh.has(Selected3D)
        ? mesh.read(Selected3D).activePartKind
        : null,
      center: api.canvas2Viewport({ x: 80, y: 80 }),
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
      const node: SerializedNode = params.has('extrude')
        ? {
            id: 'model',
            type: 'rect',
            zIndex: 0,
            x: 60,
            y: 60,
            width: 40,
            height: 40,
            extrude3d: { depth: 20, z: 10 },
            fills: [{ type: 'solid', value: '#33aabb' }],
          }
        : {
            id: 'model',
            type: 'mesh3d',
            zIndex: 0,
            x: 60,
            y: 60,
            z,
            width: 40,
            height: 40,
            scale3d: 20,
          };
      editor.replaceDocument([node], 'remote');
      editor.selectNodes([editor.getNodeById('model')]);
    },
    { capture: 'NEVER' },
  );
  await harness.settle();
  api.clearHistory();
  document.querySelector('#status')!.textContent = 'Ready';
}
void init();
