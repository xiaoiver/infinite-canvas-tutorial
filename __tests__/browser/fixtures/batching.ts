import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  GPUResource,
  Renderable,
  MeshPipeline,
  Pen,
  Screenshot,
  ExportFormat,
} from '@infinite-canvas-tutorial/ecs';
let api: API, pipeline: MeshPipeline;
class BatchRegressionProbe extends System {
  renderer = this.attach(MeshPipeline);
  access = this.query((q) => q.usingAll.read);
  initialize() {
    pipeline = this.renderer;
  }
}
class BatchRegressionBootstrap extends System {
  commands = new Commands(this);
  access = this.query((q) => q.usingAll.write);
  initialize() {
    api = new API(new DefaultStateManagement(), this.commands);
    api.createCanvas({
      element: document.querySelector('canvas')!,
      width: 240,
      height: 160,
    });
    api.createCamera({ x: 0, y: 0, zoom: 1 });
  }
}
const app = new App({ maxEntities: 131072 }).addPlugins(
  ...DefaultPlugins,
  () => {
    system(PreStartUp)(BatchRegressionBootstrap);
    system((s) => s.inAnyOrderWith(s.allSystems))(BatchRegressionBootstrap);
    system((s) => s.inAnyOrderWith(s.allSystems))(BatchRegressionProbe);
  },
);
async function frames(count = 3) {
  for (let i = 0; i < count; i++)
    await new Promise<void>((resolve) => api.runAtNextTick(resolve));
}
function draws() {
  return [...pipeline.renderers.values()][0].batchManager
    .buildFlushSegments()
    .flatMap((s) => s.drawcalls);
}
async function snapshot() {
  const image = new Image();
  image.src = api.getCanvasElement().toDataURL();
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return {
    flags: api
      .getNodes()
      .map((n) => [n.id, api.getEntity(n).read(Renderable).batchable]),
    pixel: [...ctx.getImageData(50, 50, 1, 1).data],
    groups: draws().map((d) => ({
      ctor: d.constructor.name,
      instanced: (d as any).instanced,
      nodes: d.shapes.map((s) => api.getNodeByEntity(s)?.id),
    })),
    png: canvas.toDataURL(),
  };
}
const rects = ['red', 'blue', 'red'].map((value, i) => ({
  id: `r${i}`,
  type: 'rect',
  x: 20,
  y: 20,
  width: 100,
  height: 100,
  zIndex: i,
  opacity: 0.5,
  fills: [{ type: 'solid', value }],
}));
const texts = [18, 28].map((fontSize, i) => ({
  id: `t${i}`,
  type: 'text',
  x: 20 + i * 100,
  y: 20,
  width: 80,
  height: 50,
  zIndex: i,
  content: 'abc',
  fontFamily: i ? 'serif' : 'sans-serif',
  fontSize,
  fills: [{ type: 'solid', value: 'black' }],
}));
const harness = {
  async sample(kind: 'rect' | 'text', batchable: boolean) {
    await api.edit((e) => e.replaceDocument([], 'remote'), {
      capture: 'NEVER',
    });
    await frames();
    await api.edit(
      (e) => {
        const nodes = kind === 'rect' ? rects : texts;
        e.replaceDocument(nodes as any, 'remote');
        for (const node of nodes)
          e.getEntity(node as any).write(Renderable).batchable = batchable;
      },
      { capture: 'NEVER' },
    );
    await frames();
    return snapshot();
  },
  async export(partial: boolean, id = 'r1') {
    const canvas = api.getCanvas();
    const dataURL = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('export timeout')),
        10000,
      );
      const poll = () => {
        if (canvas.has(Screenshot)) {
          clearTimeout(timer);
          resolve(canvas.read(Screenshot).dataURL);
        } else api.runAtNextTick(poll);
      };
      api.runAtNextTick(() => {
        if (canvas.has(Screenshot)) canvas.remove(Screenshot);
        api.export({
          format: ExportFormat.PNG,
          download: false,
          nodes: partial ? [api.getNodeById(id)] : [],
        });
        poll();
      });
    });
    await frames();
    return dataURL;
  },
  async enableLOD(enabled: boolean) {
    api.setTextLODEnabled(enabled);
    await frames();
    return snapshot();
  },
  async select(id?: string) {
    await api.edit((e) => {
      e.setAppState({ penbarSelected: id ? Pen.SELECT : Pen.HAND });
      e.selectNodes(id ? [e.getNodeById(id)] : []);
    });
    await frames();
    return snapshot();
  },
  async flags(batchable: boolean) {
    await api.edit((e) => {
      for (const node of e.getNodes())
        e.getEntity(node).write(Renderable).batchable = batchable;
    });
    await frames();
    return snapshot();
  },
  async pan(x: number) {
    await api.edit((e) => e.setAppState({ cameraX: x }));
    await frames();
    return snapshot();
  },
  async deleteAll() {
    await api.edit((e) => {
      // Refresh and delete in one transaction: later queued adds must not revive it.
      for (const node of e.getNodes()) e.updateNode(node, { opacity: 0.4 });
      e.deleteNodesById(e.getNodes().map((n) => n.id));
    });
    await frames();
    return snapshot();
  },
  async benchmark(count: number, batchable: boolean, samples = 90) {
    await api.edit((e) =>
      e.setAppState({ cameraX: 0, cameraY: 0, cameraZoom: 1 }),
    );
    const nodes = Array.from({ length: count }, (_, i) => ({
      id: `bench-${i}`,
      type: 'rect',
      x: (i % 100) * 2,
      y: Math.floor(i / 100) * 1.2,
      width: 1.5,
      height: 1,
      zIndex: i,
      fills: [{ type: 'solid', value: i % 2 ? 'red' : 'blue' }],
    }));
    await harness.scene(nodes, batchable);
    const times: number[] = [];
    const original = app.world.execute.bind(app.world);
    app.world.execute = async (...args: Parameters<typeof original>) => {
      const start = performance.now();
      await original(...args);
      times.push(performance.now() - start);
    };
    try {
      for (let i = 0; i < samples + 15; i++)
        await api.edit((e) =>
          e.setAppState({ cameraZoom: 1 + (i % 2) * 0.001 }),
        );
    } finally {
      app.world.execute = original;
    }
    const measured = times.slice(15).sort((a, b) => a - b);
    const calls = draws();
    return {
      count,
      batchable,
      visible: new Set(calls.flatMap((d) => d.shapes)).size,
      drawcalls: calls.length,
      vertices: calls.reduce((n, d) => n + d.shapes.length * 4, 0),
      pageSizes: batchable ? calls.map((d) => d.shapes.length) : undefined,
      cpuP50: measured[Math.floor(measured.length * 0.5)],
      cpuP95: measured[Math.floor(measured.length * 0.95)],
      samples: measured.length,
      dpr: devicePixelRatio,
      size: [240, 160],
      userAgent: navigator.userAgent,
    };
  },
  async mutate() {
    await api.edit(
      (e) =>
        e.updateNode(e.getNodeById('r2'), {
          fills: [{ type: 'solid', value: 'green' }],
        }),
      { capture: 'NEVER' },
    );
    await frames();
    const entity = api.getEntity(api.getNodeById('r2'));
    const batch = draws().find((d) => d.shapes.includes(entity))!;
    const acceptedByCurrentRules = batch.validate(entity);
    return { ...(await snapshot()), acceptedByCurrentRules };
  },
  async edit(id: string, patch: Record<string, unknown>) {
    await api.edit((e) => e.updateNode(e.getNodeById(id), patch), {
      capture: 'NEVER',
    });
    await frames();
    return snapshot();
  },
  async scene(nodes: any[], batchable: boolean) {
    await api.edit((e) => e.replaceDocument([], 'remote'), {
      capture: 'NEVER',
    });
    await frames();
    await api.edit(
      (e) => {
        e.replaceDocument(nodes, 'remote');
        for (const node of nodes)
          e.getEntity(node).write(Renderable).batchable = batchable;
      },
      { capture: 'NEVER' },
    );
    await frames();
    return snapshot();
  },
  async camera(zoom: number) {
    await api.edit((e) => e.setAppState({ cameraZoom: zoom }));
    await frames();
    return snapshot();
  },
  async destroy() {
    await app.exit();
  },
};
Object.assign(window, { batching: harness });
await app.run();
while (!api.getCanvas().has(GPUResource)) await frames();
document.querySelector('output')!.textContent = 'Ready';

export type BatchingHarness = typeof harness;
