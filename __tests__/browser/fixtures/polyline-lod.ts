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
  MeshPipeline,
  ExportFormat,
  Screenshot,
  Renderable,
  Polyline,
  GeometryDirty,
  Editable,
  Path,
  Children,
  Transform,
  RBush,
  Selected,
  Highlighted,
  type Entity,
  Pen,
  CheckboardStyle,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { SmoothPolyline } from '../../../packages/ecs/src/drawcalls/SmoothPolyline';
import { settleECSFrames } from './ecs-frames';
// Benchmark-only native submission counters, including empty planned drawcalls and final passes.
const nativeWork = {
  drawcalls: 0,
  indices: 0,
  arrayVertices: 0,
  bufferUploads: 0,
  bufferBytes: 0,
  uniformUploads: 0,
  uniformBytes: 0,
  arrayBufferBinds: 0,
  elementBufferBinds: 0,
  vertexAttribPointers: 0,
};
const boundBuffers = new WeakMap<object, Map<number, object | null>>();
const uniformBuffers = new WeakSet<object>();
const resetNativeWork = () => {
  for (const key of Object.keys(nativeWork) as (keyof typeof nativeWork)[])
    nativeWork[key] = 0;
};
for (const prototype of [
  window.WebGLRenderingContext?.prototype,
  window.WebGL2RenderingContext?.prototype,
]) {
  if (!prototype) continue;
  const bind = prototype.bindBuffer;
  prototype.bindBuffer = function (target, buffer) {
    if (target === this.ARRAY_BUFFER) nativeWork.arrayBufferBinds++;
    if (target === this.ELEMENT_ARRAY_BUFFER) nativeWork.elementBufferBinds++;
    let bound = boundBuffers.get(this);
    if (!bound) boundBuffers.set(this, (bound = new Map()));
    bound.set(target, buffer);
    return bind.call(this, target, buffer);
  };
  const pointer = prototype.vertexAttribPointer;
  prototype.vertexAttribPointer = function (...args) {
    nativeWork.vertexAttribPointers++;
    return pointer.apply(this, args);
  };
  const allocate = prototype.bufferData;
  (prototype as any).bufferData = function (...args: any[]) {
    const buffer = boundBuffers.get(this)?.get(args[0]);
    if (buffer && args[0] === this.UNIFORM_BUFFER) uniformBuffers.add(buffer);
    return (allocate as any).apply(this, args);
  };
  const upload = prototype.bufferSubData;
  (prototype as any).bufferSubData = function (...args: any[]) {
    const data = args[2];
    const stride = data.BYTES_PER_ELEMENT ?? 1;
    const bytes =
      args[4] !== undefined
        ? args[4] * stride
        : data.byteLength - (args[3] ?? 0) * stride;
    nativeWork.bufferUploads++;
    nativeWork.bufferBytes += bytes;
    const buffer = boundBuffers.get(this)?.get(args[0]);
    if (buffer && uniformBuffers.has(buffer)) {
      nativeWork.uniformUploads++;
      nativeWork.uniformBytes += bytes;
    }
    return (upload as any).apply(this, args);
  };
  for (const name of [
    'drawElements',
    'drawElementsInstanced',
    'drawArrays',
    'drawArraysInstanced',
  ]) {
    const original = (prototype as any)[name];
    if (!original) continue;
    (prototype as any)[name] = function (...args: number[]) {
      nativeWork.drawcalls++;
      if (name.startsWith('drawElements'))
        nativeWork.indices +=
          args[1] * (name.endsWith('Instanced') ? args[4] : 1);
      else
        nativeWork.arrayVertices +=
          args[2] * (name.endsWith('Instanced') ? args[3] : 1);
      return original.apply(this, args);
    };
  }
}
let api: API, pipeline: MeshPipeline;
class ProbePolyline extends System {
  pipeline = this.attach(MeshPipeline);
  access = this.query((q) => q.usingAll.read);
  initialize() {
    pipeline = this.pipeline;
  }
}
class BootstrapPolyline extends System {
  access = this.query((q) => q.usingAll.write);
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    api.createCanvas({
      element: document.querySelector('canvas')!,
      width: 800,
      height: 600,
      devicePixelRatio,
    });
    api.createCamera({ zoom: 1 });
    api.setAppState({
      penbarSelected: Pen.SELECT,
      checkboardStyle: CheckboardStyle.NONE,
    });
  }
}
const app = new App({ maxEntities: 32768 }).addPlugins(
  ...DefaultPlugins,
  () => {
    system(PreStartUp)(BootstrapPolyline);
    system((s) => s.inAnyOrderWith(s.allSystems))(BootstrapPolyline);
    system((s) => s.inAnyOrderWith(s.allSystems))(ProbePolyline);
  },
);
const frames = () => settleECSFrames(api, 3);
const points = Array.from(
  { length: 512 },
  (_, i) => `${(i * 160) / 511},${25 + Math.sin((i / 511) * Math.PI * 4) * 20}`,
).join(' ');
const line = (id: string, x = 30, y = 30): SerializedNode =>
  ({
    id,
    type: 'polyline',
    x,
    y,
    width: 160,
    height: 50,
    points,
    strokeWidth: 3,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
    strokes: [{ type: 'solid', value: '#123456', opacity: 1 }],
  } as SerializedNode);
const draws = () =>
  [...pipeline.renderers.values()][0]?.batchManager
    .buildFlushSegments()
    .flatMap((s) => s.drawcalls) ?? [];
let builds = 0;
const create = SmoothPolyline.prototype.createGeometry;
SmoothPolyline.prototype.createGeometry = function () {
  builds++;
  return create.call(this);
};
let migrationCameras: { primary: Entity; secondary: Entity } | undefined;
const harness = {
  constructors: () => draws().map((d) => d.constructor.name),
  spatialMembership: () =>
    [...pipeline.renderers.keys()].map((camera) =>
      camera
        .read(RBush)
        .value.all()
        .map((n) => api.getNodeByEntity(n.entity)?.id)
        .filter(Boolean),
    ),
  interaction: () => ({
    selected: api.getEntity(api.getNodeById('line')).has(Selected),
    highlighted: api.getEntity(api.getNodeById('line')).has(Highlighted),
  }),
  async history(action: 'undo' | 'redo') {
    api[action]();
    await frames();
  },
  async movePathCamera(back: boolean) {
    await api.edit(
      (e) => {
        const entity = e.getEntity(e.getNodeById('line'));
        if (!migrationCameras) {
          const primary = entity.read(Children).parent.hold();
          migrationCameras = {
            primary,
            secondary: e.createCamera({ zoom: 1, x: 0, y: 0 }),
          };
        }
        entity.write(Children).parent = back
          ? migrationCameras.primary
          : migrationCameras.secondary;
        entity.write(Transform).rotation = entity.read(Transform).rotation;
      },
      { capture: 'NEVER' },
    );
    await frames();
    return [...pipeline.renderers.values()].map((r) =>
      r.batchManager
        .buildFlushSegments()
        .flatMap((s) => s.drawcalls)
        .flatMap((d) => d.shapes)
        .filter((s) => !!api.getNodeByEntity(s))
        .map((s) => api.getNodeByEntity(s).id),
    );
  },
  async mutatePath(d: string) {
    await api.edit((e) => {
      e.getEntity(e.getNodeById('line')).write(Path).d = d;
    });
    await frames();
  },
  resetWork: resetNativeWork,
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
          if (node.batchable !== undefined)
            e.getEntity(e.getNodeById(node.id)).write(Renderable).batchable =
              !!node.batchable;
      },
      { capture: 'NEVER' },
    );
    await frames();
  },
  async pathInstancing(enabled: boolean) {
    api.setPathInstancingEnabled(enabled);
    await frames();
  },
  async seedPaths(count = 600, variants = 1) {
    const nodes = Array.from({ length: count }, (_, i) => ({
      id: i === 0 ? 'line' : `n${i}`,
      type: 'path' as const,
      zIndex: i,
      x: 20 + (i % 40) * 24,
      y: 20 + Math.floor(i / 40) * 24,
      width: 20,
      height: 20,
      d: `M0 0 L${
        16 + ((i % variants) / variants) * 4
      } 0 L20 20 L10 14 L0 20 Z`,
      fills: [
        {
          type: 'solid' as const,
          value: i % 2 ? '#ff0033' : '#0066ff',
          opacity: 0.5 + (i % 4) * 0.1,
        },
      ],
    }));
    if (count > 1024) {
      // Respect the fixture world's per-frame component-change log capacity.
      await harness.document([]);
      for (let i = 0; i < nodes.length; i += 512) {
        const chunk = nodes.slice(i, i + 512);
        await api.edit(
          (e) => {
            e.updateNodes(chunk);
            for (const n of chunk)
              e.getEntity(e.getNodeById(n.id)).write(Renderable).batchable =
                true;
          },
          { capture: 'NEVER' },
        );
        await frames();
      }
      return;
    }
    await harness.document(nodes);
    await api.edit(
      (e) => {
        for (const n of e.getNodes())
          e.getEntity(n).write(Renderable).batchable = true;
      },
      { capture: 'NEVER' },
    );
    await frames();
  },
  async clearPaths() {
    const ids = api.getNodes().map((n) => n.id);
    for (let i = 0; i < ids.length; i += 512) {
      await api.edit((e) => e.deleteNodesById(ids.slice(i, i + 512)), {
        capture: 'NEVER',
      });
      await frames();
    }
  },
  async seed(count = 1, mixed = false) {
    await api.edit(
      (e) => {
        e.selectNodes([]);
        e.highlightNodes([]);
        const nodes = Array.from({ length: count }, (_, i) => {
          const x = 30 + (i % 20) * 190,
            y = 30 + Math.floor(i / 20) * 90;
          if (mixed && i % 3 === 1)
            return {
              id: `n${i}`,
              type: 'path',
              x,
              y,
              width: 160,
              height: 50,
              d: 'M0 25 C20 -20 80 70 160 25',
              strokeWidth: 3,
              strokeLinejoin: 'round',
              strokes: [{ type: 'solid', value: '#123456', opacity: 1 }],
            } as SerializedNode;
          if (mixed && i % 3 === 2)
            return {
              id: `n${i}`,
              type: 'rect',
              x,
              y,
              width: 160,
              height: 40,
              fills: [{ type: 'solid', value: '#abc', opacity: 1 }],
            } as SerializedNode;
          return line(i === 0 ? 'line' : `n${i}`, x, y);
        });
        e.replaceDocument(nodes, 'remote');
        for (const n of e.getNodes())
          e.getEntity(n).write(Renderable).batchable = true;
      },
      { capture: 'NEVER' },
    );
    await frames();
  },
  async enable(value: boolean) {
    api.setPolylineLODEnabled(value);
    await frames();
  },
  async zoom(value: number) {
    await api.edit(
      (e) => e.setAppState({ cameraZoom: value, cameraX: 0, cameraY: 0 }),
      { capture: 'NEVER' },
    );
    await frames();
  },
  async camera(x: number) {
    await api.edit((e) => e.setAppState({ cameraX: x }), { capture: 'NEVER' });
    await frames();
  },
  async patch(patch: Record<string, unknown>, id = 'line') {
    await api.edit((e) => e.updateNode(e.getNodeById(id), patch));
    await frames();
  },
  async mutatePoints() {
    await api.edit((e) => {
      const entity = e.getEntity(e.getNodeById('line'));
      const points = entity.write(Polyline).points;
      points[256][1] = 180;
      if (!entity.has(GeometryDirty)) entity.add(GeometryDirty);
    });
    await frames();
  },
  async interact(kind: 'select' | 'hover' | 'edit', value: boolean) {
    await api.edit((e) => {
      const n = e.getNodeById('line');
      if (kind === 'select') e.selectNodes(value ? [n] : []);
      if (kind === 'hover') e.highlightNodes(value ? [n] : []);
      if (kind === 'edit') {
        const entity = e.getEntity(n);
        if (value && !entity.has(Editable)) entity.add(Editable);
        if (entity.has(Editable)) entity.write(Editable).isEditing = value;
      }
    });
    await frames();
  },
  state() {
    const d = draws();
    return {
      builds,
      visible: new Set(d.flatMap((d) => d.shapes)).size,
      drawcalls: d.length,
      segments: d
        .filter((d) => d instanceof SmoothPolyline)
        .map((d) => (d as SmoothPolyline).instanceCount),
      vertices: d.reduce(
        (n, d) =>
          n +
          (d instanceof SmoothPolyline
            ? d.instanceCount * 9
            : (d as any).indexBufferData?.length ?? 0),
        0,
      ),
      native: { ...nativeWork },
      document: api.getNodes(),
      resources: window.lifecycleProbes?.resources(),
    };
  },
  async export(partial: boolean, id = 'line') {
    const canvas = api.getCanvas();
    const result = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('export timeout')),
        15000,
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
    return result;
  },
  async removeDuringZoom() {
    await api.edit((e) => {
      e.setAppState({ cameraZoom: 0.3 });
      e.deleteNodesById(['line']);
    });
    await frames();
    return draws().flatMap((d) => d.shapes).length;
  },
  async benchmark(count: number, enabled: boolean, samples = 30) {
    await harness.enable(enabled);
    await harness.zoom(0.2);
    await harness.seed(count, true);
    return measureCameraFrames(count, enabled, samples);
  },
  async benchmarkPaths(
    count: number,
    enabled: boolean,
    variants = 1,
    samples = 30,
  ) {
    await harness.pathInstancing(enabled);
    await harness.zoom(Math.min(0.75, 600 / (Math.ceil(count / 40) * 24 + 40)));
    await harness.seedPaths(count, variants);
    return measureCameraFrames(count, enabled, samples);
  },
  async destroy() {
    await app.exit();
  },
};
async function measureCameraFrames(
  count: number,
  enabled: boolean,
  samples: number,
) {
  const times: number[] = [];
  const submissions: (typeof nativeWork)[] = [];
  const original = app.world.execute.bind(app.world);
  let pending: Promise<void> | undefined;
  app.world.execute = (...args: Parameters<typeof original>) => {
    pending = (async () => {
      resetNativeWork();
      const t = performance.now();
      await original(...args);
      times.push(performance.now() - t);
      submissions.push({ ...nativeWork });
    })();
    return pending;
  };
  try {
    for (let i = 0; i < samples + 15; i++)
      await api.edit((e) => e.setAppState({ cameraX: (i % 2) * 0.1 }), {
        capture: 'NEVER',
      });
  } finally {
    app.world.execute = original;
    // edit() can resolve before execute() finishes; measure the final frame too.
    await pending;
  }
  const measured = times.slice(15).sort((a, b) => a - b);
  return {
    count,
    enabled,
    ...harness.state(),
    native: submissions[submissions.length - 1],
    cpuP50: measured[Math.floor(measured.length * 0.5)],
    cpuP95: measured[Math.floor(measured.length * 0.95)],
    samples: measured.length,
    dpr: devicePixelRatio,
    size: [800, 600],
  };
}
Object.assign(window, { polylineLOD: harness });
try {
  await app.run();
  while (!api.getCanvas().has(GPUResource)) await frames();
  await harness.seed();
  document.querySelector('output')!.textContent = 'Ready';
} catch (e) {
  document.querySelector('output')!.textContent = String(e);
  console.error(e);
}
export type PolylineLODHarness = typeof harness;
