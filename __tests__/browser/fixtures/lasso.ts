import { createApp } from 'vue';
import LassoDemo from '../../../packages/site/docs/components/Lasso.vue';
import { type API, type SerializedNode, Pen } from '../../../packages/ecs/src';

let api: API;
const drawn: string[] = [];
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function settle() {
  for (let i = 0; i < 4; i++) await frame();
}
let app: ReturnType<typeof createApp>;
function mount() {
  api = undefined;
  app = createApp(LassoDemo);
  app.mount('#demo');
  document.querySelector('ic-spectrum-canvas')!.addEventListener(
    'ic-ready',
    (event) => {
      api = (event as CustomEvent<API>).detail;
    },
    true,
  );
  document
    .querySelector('ic-spectrum-canvas')!
    .addEventListener('ic-lasso-drawn', (event) => {
      drawn.push(
        (event as CustomEvent<{ node: SerializedNode }>).detail.node.id,
      );
    });
}
mount();

const harness = {
  ready: () => !!api && api.getNodes().length >= 2,
  settle,
  state: () => api.getAppState(),
  masks: () => api.getNodes().filter((node) => node.type === 'path'),
  drawn: () => drawn,
  async mask() {
    await api.edit(() =>
      api.setAppState({
        penbarSelected: Pen.LASSO,
        layersLassoing: ['lasso-rect-1'],
        penbarLasso: { ...api.getAppState().penbarLasso, mode: 'draw' },
      }),
    );
    await settle();
  },
  async undo() {
    await api.undo();
    await settle();
  },
  async camera() {
    await api.edit(() =>
      api.gotoLandmark(api.createLandmark({ x: -30, y: -30, zoom: 0.8 }), {
        duration: 0,
      }),
    );
    await settle();
  },
  async activate(mode?: 'select' | 'draw') {
    await api.edit(() =>
      api.setAppState({
        penbarSelected: Pen.LASSO,
        penbarLasso: { ...api.getAppState().penbarLasso, mode },
      }),
    );
    await settle();
  },
  async scene(nodes: SerializedNode[]) {
    await api.edit(() => {
      api.deleteNodesById(api.getNodes().map((node) => node.id));
      api.updateNodes(nodes);
      api.setAppState({ penbarSelected: Pen.LASSO });
    });
    await settle();
  },
  point(x: number, y: number) {
    return api.canvas2Viewport({ x, y });
  },
  unmount() {
    app.unmount();
  },
  mount,
};
declare global {
  interface Window {
    lassoTest: typeof harness;
  }
}
window.lassoTest = harness;
