import '../../../packages/webcomponents/src/spectrum/context-vector-network-edit-bar';
import '../../../packages/webcomponents/src/spectrum/infinite-canvas';
import '../../../packages/webcomponents/src/spectrum/fill-icon';
import '../../../packages/webcomponents/src/spectrum/input-solid';
import '../../../packages/webcomponents/src/spectrum/input-gradient';
import {
  API,
  App,
  Canvas,
  Theme,
  Grid,
  Camera,
  Parent,
  Children,
  Transform,
  Renderable,
  FillLayers,
  StrokeLayers,
  Stroke,
  Rect,
  Visibility,
  Name,
  DropShadow,
  ZIndex,
  Opacity,
  GlobalTransform,
  VectorNetwork,
  Editable,
  Selected,
  Transformable,
  Culled,
  Pen,
  Commands,
  ComputeZIndex,
  DefaultPlugins,
  DefaultStateManagement,
  GPUResource,
  PreStartUp,
  System,
  system,
  type SerializedNode,
  type AppState,
} from '@infinite-canvas-tutorial/ecs';
import { WorkerClient } from '../../../packages/ecs/src/WorkerClient';
import { bindDocument } from '../../../packages/site/docs/collaboration/document';
import {
  createYjsDemoDocument,
  yjsDocument,
} from '../../../packages/site/docs/collaboration/yjs';
import {
  createLoroDemoDocument,
  loroDocument,
} from '../../../packages/site/docs/collaboration/loro';
import * as Y from 'yjs';

type Side = 'left' | 'right';
// Mirror LitStateManagement's immediate updates, including non-history state.
class ToolbarStateManagement extends DefaultStateManagement {
  listeners = new Set<() => void>();
  setAppState(state: AppState) {
    super.setAppState(state);
    this.listeners.forEach((listener) => listener());
  }
  setNodes(nodes: SerializedNode[]) {
    super.setNodes(nodes);
    this.listeners.forEach((listener) => listener());
  }
}

type Slot = {
  api: API;
  stateManagement: ToolbarStateManagement;
  entity: ReturnType<API['createCanvas']>;
  canvas: HTMLCanvasElement;
  svgLayer: HTMLDivElement;
  worker: WorkerClient;
};
const slots = new Map<Side, Slot>();
const workers = {
  created: 0,
  terminated: 0,
  started: [] as string[],
  settled: [] as string[],
};
const status = document.querySelector<HTMLOutputElement>('#status')!;
let commands: Commands;
let revision = 0;

const seed = (): SerializedNode => ({
  id: 'shape',
  type: 'rect',
  x: 40,
  y: 40,
  width: 120,
  height: 100,
  zIndex: 0,
  fills: [{ type: 'solid', value: '#ff0000' }],
});
function create(side: Side) {
  const canvas = document.querySelector<HTMLCanvasElement>(`#${side} canvas`)!;
  canvas.tabIndex = 0;
  const svgLayer = document.createElement('div');
  const host = document.createElement('div');
  host.style.cssText = 'position:relative;width:320px;height:220px';
  canvas.replaceWith(host);
  host.append(canvas, svgLayer);
  svgLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const stateManagement = new ToolbarStateManagement();
  const api = new API(stateManagement, commands);
  const entity = api.createCanvas({
    element: canvas,
    svgLayer,
    width: 320,
    height: 220,
    devicePixelRatio: 1,
  });
  api.createCamera({ zoom: 1 });
  api.updateNodes([seed()]);
  api.record();
  const worker = new WorkerClient(() => {
    workers.created++;
    const native = new Worker(new URL('./model.worker.ts', import.meta.url), {
      type: 'module',
    });
    native.addEventListener('message', ({ data }) => {
      if (data.type === 'started') workers.started.push(`${side}:${data.data}`);
    });
    const terminate = native.terminate.bind(native);
    native.terminate = () => {
      workers.terminated++;
      terminate();
    };
    return native;
  });
  api.onDestroy(() => worker.dispose());
  const slot = { api, stateManagement, entity, canvas, svgLayer, worker };
  slots.set(side, slot);
  return slot;
}

class Bootstrap extends System {
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
        FillLayers,
        StrokeLayers,
        Stroke,
        Rect,
        Visibility,
        Name,
        DropShadow,
        ZIndex,
        Opacity,
        GlobalTransform,
        VectorNetwork,
        Editable,
        Selected,
      ).write,
  );
  initialize() {
    commands = new Commands(this);
    create('left');
    create('right');
  }
}
const app = new App().addPlugins(...DefaultPlugins, () => {
  system(PreStartUp)(Bootstrap);
  system((s) => s.before(ComputeZIndex))(Bootstrap);
});

function act(side: Side, fn: (slot: Slot) => void) {
  const slot = slots.get(side)!;
  return new Promise<void>((resolve, reject) =>
    slot.api.runAtNextTick(() => {
      try {
        fn(slot);
        revision++;
        resolve();
      } catch (error) {
        reject(error);
      }
    }),
  );
}
async function destroy(side: Side) {
  await act(side, ({ api, canvas }) => {
    api.destroy();
    canvas.parentElement!.remove();
    slots.delete(side);
  });
}
async function recreate(side: Side) {
  if (slots.has(side)) await destroy(side);
  const other: Side = side === 'left' ? 'right' : 'left';
  await act(other, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 220;
    document.getElementById(side)!.append(canvas);
    create(side);
  });
}

function connect(kind: 'yjs' | 'loro', room: string) {
  const api = slots.get('left')!.api;
  const channel = new BroadcastChannel(room);
  const remote = {};
  if (kind === 'yjs') {
    const doc = createYjsDemoDocument();
    const adapter = yjsDocument(doc);
    const unbind = bindDocument(api, adapter);
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== remote) channel.postMessage({ update });
    };
    doc.on('update', onUpdate);
    channel.onmessage = ({ data }) => {
      if (data.hello)
        channel.postMessage({ update: Y.encodeStateAsUpdate(doc) });
      else Y.applyUpdate(doc, data.update, remote);
    };
    api.onDestroy(() => {
      unbind();
      channel.close();
      doc.destroy();
    });
  } else {
    const doc = createLoroDemoDocument();
    const unbind = bindDocument(api, loroDocument(doc));
    const unsubscribe = doc.subscribeLocalUpdates((update) =>
      channel.postMessage({ update }),
    );
    channel.onmessage = ({ data }) => {
      if (data.hello)
        channel.postMessage({ update: doc.export({ mode: 'snapshot' }) });
      else doc.import(data.update);
    };
    api.onDestroy(() => {
      unbind();
      unsubscribe();
      channel.close();
      doc.free();
    });
  }
  channel.postMessage({ hello: true });
}

const harness = {
  ready: false,
  visibleVectorAnchors(side: Side) {
    const tf = slots.get(side)!.api.getCamera().read(Transformable);
    return [
      tf.tlAnchor,
      tf.trAnchor,
      tf.blAnchor,
      tf.brAnchor,
      tf.centerAnchor,
      tf.x1y1Anchor,
      tf.x2y2Anchor,
      ...(tf.controlPoints ?? []),
      ...(tf.segmentMidpoints ?? []),
      ...(tf.vnTangentHandles ?? []),
    ].filter((entity) => entity && !entity.has(Culled)).length;
  },
  async settleFrames() {
    // App awaits world.execute() before scheduling another animation frame.
    // Browser RAFs alone can run while that asynchronous ECS work is pending.
    for (let i = 0; i < 2; i++) {
      const side = slots.keys().next().value as Side | undefined;
      if (!side) return;
      await act(side, () => {});
    }
  },
  setScene(side: Side, nodes: SerializedNode[], selectedId: string) {
    return act(side, ({ api }) => {
      api.replaceDocument(nodes);
      api.setAppState({ penbarSelected: Pen.SELECT });
      api.selectNodes(nodes.filter((node) => node.id === selectedId));
      api.record();
    });
  },
  setPen(side: Side, pen: Pen) {
    return act(side, ({ api }) => api.setAppState({ penbarSelected: pen }));
  },
  setZoom(side: Side, zoom: number) {
    return act(side, ({ api }) => api.setAppState({ cameraZoom: zoom }));
  },
  async vectorToolbar(side: Side, id: string) {
    const theme = document.createElement('sp-theme');
    theme.setAttribute('color', 'light');
    theme.setAttribute('scale', 'medium');
    const toolbar = document.createElement(
      'ic-spectrum-context-vector-network-edit-bar',
    );
    toolbar.style.setProperty(
      '--spectrum-accent-background-color-default',
      '#147af3',
    );
    const { api, stateManagement } = slots.get(side)!;
    const sync = () => {
      toolbar.api = api as typeof toolbar.api;
      toolbar.appState = api.getAppState();
      toolbar.node = api.getNodeById(id) as typeof toolbar.node;
      toolbar.requestUpdate();
    };
    sync();
    stateManagement.listeners.add(sync);
    api.onDestroy(() => {
      stateManagement.listeners.delete(sync);
      theme.remove();
    });
    theme.append(toolbar);
    document.getElementById(side)!.append(theme);
  },
  viewportPoint(side: Side, id: string, point: [number, number]) {
    const { api } = slots.get(side)!;
    const entity = api.getEntity(api.getNodeById(id));
    const m = entity.read(GlobalTransform).matrix;
    return api.canvas2Viewport({
      x: m.m00 * point[0] + m.m10 * point[1] + m.m20,
      y: m.m01 * point[0] + m.m11 * point[1] + m.m21,
    });
  },
  update(side: Side, id: string, patch: Partial<SerializedNode>) {
    return act(side, ({ api }) => {
      api.updateNode(api.getNodeById(id), patch);
      api.record();
    });
  },
  state(side: Side) {
    const slot = slots.get(side);
    return slot
      ? {
          nodes: slot.api.getNodes(),
          state: slot.api.getAppState(),
          gpu: slot.entity.has(GPUResource),
          revision,
        }
      : null;
  },
  edit(side: Side, id = 'shape', width = 160) {
    return act(side, ({ api }) => {
      api.updateNode(api.getNodeById(id), {
        width,
        fills: [{ type: 'solid', value: '#0000ff' }],
      });
      api.record();
    });
  },
  remove(side: Side, id: string) {
    return act(side, ({ api }) => {
      api.deleteNodesById([id]);
      api.record();
    });
  },
  undo(side: Side) {
    slots.get(side)!.api.undo();
  },
  redo(side: Side) {
    slots.get(side)!.api.redo();
  },
  destroy,
  recreate,
  connect,
  pixel(side: Side, x: number, y: number) {
    const canvas = slots.get(side)!.canvas;
    const gl = canvas.getContext('webgl2')!;
    const pixel = new Uint8Array(4);
    gl.readPixels(
      x,
      canvas.height - 1 - y,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    return [...pixel];
  },
  async queueThenDestroy(side: Side) {
    let cancelledRan = false;
    const api = slots.get(side)!.api;
    const destroyed = destroy(side);
    api.runAtNextTick(() => {
      cancelledRan = true;
    });
    await destroyed;
    return cancelledRan;
  },
  startWorker(side: Side) {
    const { worker } = slots.get(side)!;
    const observe = (name: string, result: Promise<unknown>) =>
      result.then(
        () => workers.settled.push(`${name}:resolved`),
        (error: Error) => workers.settled.push(`${name}:${error.message}`),
      );
    void observe(
      'active',
      worker.run(() => worker.request('hold')),
    );
    void observe(
      'queued',
      worker.run(() => worker.request('echo', 'unexpected')),
    );
  },
  echo(side: Side) {
    const { worker } = slots.get(side)!;
    return worker.run(() => worker.request('echo', 'ok'));
  },
  workers,
  async shutdown() {
    for (const side of [...slots.keys()]) await destroy(side);
    await app.exit();
    status.value = 'Stopped';
  },
};
Object.assign(window, { canvasRegression: harness });
document
  .querySelector('#edit')!
  .addEventListener('click', () => void harness.edit('left'));
document
  .querySelector('#undo')!
  .addEventListener('click', () => harness.undo('left'));
document
  .querySelector('#redo')!
  .addEventListener('click', () => harness.redo('left'));
document
  .querySelector('#recreate')!
  .addEventListener('click', () => void recreate('left'));
try {
  await app.run();
  harness.ready = true;
  status.value = 'Ready';
} catch (error) {
  status.value = String(
    error instanceof AggregateError
      ? error.errors.map((e) => e.stack).join('\n')
      : error.stack,
  );
  console.error(status.value);
}
export type BrowserHarness = typeof harness;
