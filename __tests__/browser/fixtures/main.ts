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
  Commands,
  ComputeZIndex,
  DefaultPlugins,
  DefaultStateManagement,
  GPUResource,
  PreStartUp,
  System,
  system,
  type SerializedNode,
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
type Slot = {
  api: API;
  entity: ReturnType<API['createCanvas']>;
  canvas: HTMLCanvasElement;
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
  const api = new API(new DefaultStateManagement(), commands);
  const entity = api.createCanvas({
    element: canvas,
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
  const slot = { api, entity, canvas, worker };
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
    canvas.remove();
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
