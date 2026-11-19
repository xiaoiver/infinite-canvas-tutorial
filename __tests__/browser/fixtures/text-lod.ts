import {
  API,
  Pen,
  App,
  Commands,
  DefaultPlugins,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  Selected,
  Highlighted,
  Editable,
  ComputedLOD,
  ComputedBounds,
  GPUResource,
  MeshPipeline,
  Renderable,
  ExportFormat,
  Screenshot,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { TextProxy } from '../../../packages/ecs/src/drawcalls/TextProxy';
import { settleECSFrames } from './ecs-frames';

let api: API;
let meshPipeline: MeshPipeline;
class ProbeTextLOD extends System {
  pipeline = this.attach(MeshPipeline);
  access = this.query((q) => q.usingAll.read);
  initialize() {
    meshPipeline = this.pipeline;
  }
}
class BootstrapTextLOD extends System {
  commands = new Commands(this);
  access = this.query((q) => q.usingAll.write);
  initialize() {
    api = new API(new DefaultStateManagement(), this.commands);
    api.createCanvas({
      element: document.querySelector('canvas')!,
      htmlLayer: document.querySelector('#html-layer')!,
      svgLayer: document.querySelector('#svg-layer')!,
      width: 800,
      height: 600,
      devicePixelRatio: window.devicePixelRatio,
    });
    api.createCamera({ zoom: 1 });
    api.setAppState({ penbarSelected: Pen.SELECT });
  }
}
const app = new App({ maxEntities: 131072 }).addPlugins(
  ...DefaultPlugins,
  () => {
    system(PreStartUp)(BootstrapTextLOD);
    system((s) => s.inAnyOrderWith(s.allSystems))(ProbeTextLOD);
    system((s) => s.inAnyOrderWith(s.allSystems))(BootstrapTextLOD);
  },
);
const frames = () => settleECSFrames(api, 3);
const node = (id: string, x = 30, y = 30): SerializedNode =>
  ({
    id,
    type: 'text',
    x,
    y,
    width: 260,
    height: 36,
    zIndex: 0,
    fontSize: 12,
    content: 'Ordinary canvas text LOD\nShort second line',
    fills: [{ type: 'solid', value: '#123456', opacity: 0.7 }],
  } as SerializedNode);
const renderer = () => [...meshPipeline.renderers.values()][0];
const queued = () =>
  renderer()
    ?.batchManager.buildFlushSegments()
    .flatMap((s) => s.drawcalls) ?? [];
const mode = () => {
  const entity = api.getEntity(api.getNodeById('text'));
  return entity?.has(ComputedLOD) ? entity.read(ComputedLOD).level : 'full';
};
const harness = {
  async seed(count = 1, batchable = false) {
    await api.edit(
      (editor) => {
        editor.selectNodes([]);
        editor.highlightNodes([]);
        editor.replaceDocument(
          Array.from({ length: count }, (_, i) => ({
            ...node(
              i === 0 ? 'text' : `text-${i}`,
              (i % 100) * 300 + 30,
              Math.floor(i / 100) * 60 + 30,
            ),
          })),
          'remote',
        );
        for (const node of editor.getNodes())
          editor.getEntity(node).write(Renderable).batchable = batchable;
      },
      { capture: 'NEVER' },
    );
    await frames();
  },
  async document(nodes: (SerializedNode & { batchable?: boolean })[]) {
    await api.edit(
      (e) => {
        e.selectNodes([]);
        e.highlightNodes([]);
        e.replaceDocument(
          nodes.map(
            ({ batchable: _flag, ...node }) => node,
          ) as SerializedNode[],
          'remote',
        );
        for (const node of nodes)
          e.getEntity(node).write(Renderable).batchable = !!node.batchable;
      },
      { capture: 'NEVER' },
    );
    await frames();
  },
  async camera(x: number, y = 0) {
    await api.edit((e) => e.setAppState({ cameraX: x, cameraY: y }));
    await frames();
  },
  async enable(value: boolean) {
    api.setTextLODEnabled(value);
    await frames();
  },
  async zoom(value: number) {
    await api.edit((e) =>
      e.setAppState({ cameraZoom: value, cameraX: 0, cameraY: 0 }),
    );
    await frames();
  },
  async patch(patch: Record<string, unknown>) {
    await api.edit((e) => {
      const node = e.getNodeById('text');
      const { batchable, ...data } = patch;
      if (Object.keys(data).length) e.updateNode(node, data);
      if (typeof batchable === 'boolean')
        e.getEntity(node).write(Renderable).batchable = batchable;
    });
    await frames();
  },
  async select(value: boolean) {
    await api.edit((e) => e.selectNodes(value ? [e.getNodeById('text')] : []));
    await frames();
  },
  async hover(value: boolean) {
    await api.edit((e) =>
      e.highlightNodes(value ? [e.getNodeById('text')] : []),
    );
    await frames();
  },
  mode,
  screen: () => document.querySelector('canvas')!.toDataURL(),
  state() {
    const draws = queued();
    const bounds = api
      .getEntity(api.getNodeById('text'))
      .read(ComputedBounds).geometryWorldBounds;
    return {
      selected: api.getEntity(api.getNodeById('text')).has(Selected),
      highlighted: api.getEntity(api.getNodeById('text')).has(Highlighted),
      editing:
        api.getEntity(api.getNodeById('text')).has(Editable) &&
        api.getEntity(api.getNodeById('text')).read(Editable).isEditing,
      level: mode(),
      ctors: draws.map((d) => d.constructor.name),
      drawcalls: draws.length,
      vertices: draws.reduce(
        (sum, d) =>
          sum +
          (d instanceof TextProxy
            ? d.lineInstanceCount * 4
            : (((d as any).indexBufferData?.length ?? 0) / 6) * 4),
        0,
      ),
      nodes: api.getNodes(),
      bounds: {
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.maxX,
        maxY: bounds.maxY,
      },
      proxyIds: draws
        .filter((d) => d.constructor.name === 'TextProxy')
        .map((d) => d.uid),
    };
  },
  async export(partial: boolean) {
    const canvas = api.getCanvas();
    // Wait for the actual Screenshot output; exporter performs async preparation.
    const screenshot = await new Promise<string>((resolve, reject) => {
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
          nodes: partial ? [api.getNodeById('text')] : [],
        });
        poll();
      });
    });
    await frames();
    return screenshot;
  },
  async failExport() {
    await new Promise<void>((resolve) =>
      api.runAtNextTick(() => {
        const canvas = api.getCanvasElement();
        const original = canvas.toDataURL;
        canvas.toDataURL = () => {
          throw new Error('injected export failure');
        };
        api.export({ format: ExportFormat.PNG, download: false });
        api.runAtNextTick(() => {
          canvas.toDataURL = original;
          resolve();
        });
      }),
    );
    await frames();
    return harness.state();
  },
  async deleteAllDuringZoom() {
    await api.edit((e) => {
      e.setAppState({ cameraZoom: 0.9 });
      e.deleteNodesById(e.getNodes().map((n) => n.id));
    });
    await frames();
    return queued().flatMap((d) => d.shapes).length;
  },
  async deleteDuringZoom() {
    await api.edit((e) => {
      e.setAppState({ cameraZoom: 0.9 });
      e.deleteNodesById(['text']);
    });
    await frames();
    return queued().flatMap((d) => d.shapes).length;
  },
  async benchmark(
    count: number,
    enabled: boolean,
    samples = 90,
    batchable = false,
  ) {
    await harness.enable(enabled);
    // Entire 100-column document fits in 800x600, so report actual visible draws.
    await harness.zoom(0.024);
    console.log(`text-lod benchmark: seeding ${count}, enabled=${enabled}`);
    await harness.seed(count, batchable);
    console.log(`text-lod benchmark: sampling ${count}, enabled=${enabled}`);
    const times: number[] = [];
    const original = app.world.execute.bind(app.world);
    app.world.execute = async (...args: Parameters<typeof original>) => {
      const start = performance.now();
      await original(...args);
      times.push(performance.now() - start);
    };
    try {
      for (let i = 0; i < samples + 15; i++) {
        await api.edit((e) =>
          e.setAppState({ cameraZoom: 0.024 + (i % 2) * 0.0001 }),
        );
      }
    } finally {
      app.world.execute = original;
    }
    const measured = times.slice(15).sort((a, b) => a - b);
    const draws = queued();
    return {
      count,
      enabled,
      batchable,
      visible: new Set(draws.flatMap((d) => d.shapes)).size,
      cpuP50: measured[Math.floor(measured.length * 0.5)],
      cpuP95: measured[Math.floor(measured.length * 0.95)],
      drawcalls: draws.length,
      vertices: harness.state().vertices,
      samples: measured.length,
      resources: window.lifecycleProbes?.resources(),
      dpr: devicePixelRatio,
      size: [800, 600],
      userAgent: navigator.userAgent,
    };
  },
  async destroy() {
    await app.exit();
  },
};
Object.assign(window, { textLOD: harness });
try {
  await app.run();
  while (!api.getCanvas().has(GPUResource)) await frames();
  await harness.seed();
  document.querySelector('output')!.textContent = 'Ready';
} catch (e) {
  document.querySelector('output')!.textContent = String(e);
  console.error(e);
}
export type TextLODHarness = typeof harness;
