import {
  Canvas as CoreCanvas,
  Rect,
  Circle,
  Path,
  Polyline,
  Text,
  CheckboardStyle as CoreGrid,
  Theme,
  type Shape,
} from '../../../packages/core/src';
import { WebGLDeviceContribution } from '@antv/g-device-api';
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
  Screenshot,
  ExportFormat,
  Renderable,
  Culled,
  ComputedLOD,
  Pen,
  CheckboardStyle,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';
import { mixedFrameProbe } from './mixed-frame-probe';

const element = document.querySelector('canvas')!;
const backend =
  new URLSearchParams(location.search).get('backend') === 'core'
    ? 'core'
    : 'ecs';
const width = 960,
  height = 640;
element.width = width;
element.height = height;
let core: CoreCanvas | undefined, app: App | undefined, api: API | undefined;
let shapes: Shape[] = [],
  nodes: SerializedNode[] = [];
let configured = false;
let baseZoom = 1;
let textLimit = 200;
let editIndices: number[] = [];
const probe = mixedFrameProbe(element);
let baseline = [] as ReturnType<typeof window.lifecycleProbes.resources>;
if (backend === 'core') {
  const original = WebGLDeviceContribution.prototype.createSwapChain;
  WebGLDeviceContribution.prototype.createSwapChain = async function (...args) {
    const swap = await original.apply(this, args);
    baseline = window.lifecycleProbes.resources();
    return swap;
  };
  core = await new CoreCanvas({
    canvas: element,
    devicePixelRatio: 1,
    checkboardStyle: CoreGrid.NONE,
    themeColors: { [Theme.LIGHT]: { background: '#ffffff' } },
  }).initialized;
  WebGLDeviceContribution.prototype.createSwapChain = original;
} else {
  class BootstrapMixed extends System {
    access = this.query((q) => q.usingAll.write);
    initialize() {
      api = new API(new DefaultStateManagement(), new Commands(this));
      api.createCanvas({ element, width, height, devicePixelRatio: 1 });
      api.createCamera({ zoom: 1 });
      api.setAppState({
        penbarSelected: Pen.SELECT,
        checkboardStyle: CheckboardStyle.NONE,
      });
    }
  }
  app = new App({ maxEntities: 65536 }).addPlugins(...DefaultPlugins, () => {
    system(PreStartUp)(BootstrapMixed);
    system((s) => s.inAnyOrderWith(s.allSystems))(BootstrapMixed);
  });
  await app.run();
  while (!api!.getCanvas().has(GPUResource)) await settleECSFrames(api!, 2);
}
if (!probe.ready()) throw new Error('The mixed benchmark requires WebGL2.');

export type MixedOperation = 'pan' | 'zoom' | 'edit';
export type MixedLayout = 'grouped' | 'interleaved';
const points: [number, number][] = Array.from({ length: 128 }, (_, i) => [
  (i * 20) / 127,
  10 + Math.sin((i / 127) * Math.PI * 4) * 5,
]);
function scene(count: number, layout: MixedLayout): SerializedNode[] {
  const columns = Math.ceil(Math.sqrt((count * width) / height));
  baseZoom = Math.min(
    0.25,
    (width - 32) / (columns * 32),
    (height - 32) / (Math.ceil(count / columns) * 32),
  );
  const textCount = Math.min(count / 5, textLimit);
  const otherCount = Math.floor((count - textCount) / 4);
  const remainder = count - textCount - otherCount * 4;
  const counts = [
    otherCount + Number(remainder > 0),
    otherCount + Number(remainder > 1),
    textCount,
    otherCount + Number(remainder > 2),
    otherCount,
  ];
  const starts = counts.map((_, kind) =>
    counts.slice(0, kind).reduce((sum, n) => sum + n, 0),
  );
  const canonical: SerializedNode[] = Array.from({ length: count }, (_, i) => {
    let kind = 0;
    while (i >= starts[kind] + counts[kind]) kind++;
    const ordinal = i - starts[kind];
    const common = {
      id: `mixed-${i}`,
      x: 16 + (i % columns) * 32,
      y: 16 + Math.floor(i / columns) * 32,
      width: 20,
      height: 20,
      zIndex: i,
      fills: [{ type: 'solid' as const, value: '#2563eb' }],
      strokeWidth: 0,
    };
    if (kind === 0) return { ...common, type: 'rect' };
    if (kind === 1) return { ...common, type: 'ellipse' };
    if (kind === 2)
      return {
        ...common,
        type: 'text',
        width: 28,
        height: 16,
        content: `N${ordinal % 100}`,
        fontFamily: 'sans-serif',
        fontSize: 12,
      };
    if (kind === 3)
      return {
        ...common,
        type: 'polyline',
        points: points.map((p) => p.join(',')).join(' '),
        fills: [],
        strokes: [{ type: 'solid', value: '#2563eb' }],
        strokeWidth: 1,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      };
    // Half the Paths share exactly one key; the other half are unique.
    const variation =
      ordinal < counts[4] / 2 ? 0 : ((ordinal + 1) / counts[4]) * 0.1;
    return {
      ...common,
      type: 'path',
      d: `M0 0 C${10 + variation} -2 22 4 20 12 L10 20 L0 12 Z`,
    };
  });
  if (layout === 'grouped') return canonical;
  // Change painter order while preserving IDs, geometry, coordinates and paints.
  const interleaved: SerializedNode[] = [];
  for (let ordinal = 0; ordinal < Math.max(...counts); ordinal++)
    for (let kind = 0; kind < counts.length; kind++)
      if (ordinal < counts[kind])
        interleaved.push({
          ...canonical[starts[kind] + ordinal],
          zIndex: interleaved.length,
        });
  return interleaved;
}
function coreShape(node: SerializedNode): Shape {
  const { x, y } = node;
  const paint = {
    fill: '#2563eb',
    stroke: 'none',
    strokeWidth: 0,
    batchable: true,
  };
  if (node.type === 'rect')
    return new Rect({ ...paint, x, y, width: 20, height: 20 });
  if (node.type === 'ellipse')
    return new Circle({ ...paint, cx: x + 10, cy: y + 10, r: 10 });
  if (node.type === 'text')
    return new Text({
      ...paint,
      x,
      y,
      content: node.content,
      fontFamily: 'sans-serif',
      fontSize: 12,
      textBaseline: 'top',
    });
  if (node.type === 'polyline') {
    const shape = new Polyline({
      ...paint,
      fill: 'none',
      stroke: '#2563eb',
      strokeWidth: 1,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
      points,
    });
    shape.position.set(x, y);
    return shape;
  }
  if (node.type === 'path') {
    const shape = new Path({ ...paint, d: node.d });
    shape.position.set(x, y);
    return shape;
  }
  throw new Error('Unexpected mixed shape');
}
function state() {
  let visible = 0,
    textProxy = 0;
  if (core) visible = shapes.filter((s) => s.visible && !s.culled).length;
  else
    for (const node of nodes) {
      const entity = api!.getEntity(node);
      if (!entity || entity.has(Culled)) continue;
      visible++;
      if (entity.has(ComputedLOD)) {
        const level = entity.read(ComputedLOD).level;
        if (level === 'text-proxy') textProxy++;
      }
    }
  return {
    visible,
    webglError: probe.webglError(),
    allocatedBufferBytes: probe.allocatedBufferBytes(),
    primitiveCounts: nodes.reduce((counts, node) => {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>),
    textProxy,
    native: probe.snapshot(),
    resources: window.lifecycleProbes.resources(),
  };
}
async function configure(
  count: number,
  layout: MixedLayout,
  enabled: boolean,
  textCap = 200,
) {
  if (!Number.isInteger(count) || count < 5 || count > 10000 || count % 5)
    throw new Error('Count must be a multiple of five, at most 10,000.');
  if (!Number.isInteger(textCap) || textCap < 1)
    throw new Error('Text cap must be a positive integer.');
  textLimit = textCap;
  if (configured)
    throw new Error('Use a fresh page for each benchmark configuration.');
  configured = true;
  nodes = scene(count, layout);
  const groups = new Map<string, number[]>();
  nodes.forEach((node, i) => {
    const group = groups.get(node.type) ?? [];
    group.push(i);
    groups.set(node.type, group);
  });
  const editedCount = Math.max(1, Math.round(count / 100));
  const quotas = [...groups.values()].map((indices) => ({
    indices,
    count: Math.floor((indices.length * editedCount) / count),
    remainder: ((indices.length * editedCount) / count) % 1,
  }));
  let missing =
    editedCount - quotas.reduce((sum, group) => sum + group.count, 0);
  for (const group of [...quotas].sort((a, b) => b.remainder - a.remainder))
    if (missing > 0) {
      group.count++;
      missing--;
    }
  editIndices = quotas.flatMap((group) =>
    Array.from(
      { length: group.count },
      (_, i) =>
        group.indices[
          Math.floor(((i + 0.5) * group.indices.length) / group.count)
        ],
    ),
  );
  if (core) {
    for (const shape of shapes) core.removeChild(shape);
    shapes = nodes.map(coreShape);
    for (const shape of shapes) core.appendChild(shape);
    core.pathInstancing = enabled;
    core.camera.zoom = baseZoom;
    core.camera.x = 0;
    core.camera.y = 0;
    core.render();
  } else {
    api!.setPathInstancingEnabled(enabled);
    api!.setTextLODEnabled(enabled);
    api!.setPolylineLODEnabled(enabled);
    await api!.edit(
      (e) => e.setAppState({ cameraZoom: baseZoom, cameraX: 0, cameraY: 0 }),
      { capture: 'NEVER' },
    );
    // Keep initialization within Becsy's per-frame shape-change log capacity.
    // The complete scene is present before settling, warmup and measurement.
    for (let start = 0; start < nodes.length; start += 1000) {
      const batch = nodes.slice(start, start + 1000);
      await api!.edit(
        (e) => {
          e.updateNodes(structuredClone(batch));
          for (const node of batch)
            e.getEntity(node).write(Renderable).batchable = true;
        },
        { capture: 'NEVER' },
      );
    }
    const document = api!.getNodes();
    if (
      document.length !== nodes.length ||
      document.some((node, i) => node.id !== nodes[i].id)
    )
      throw new Error(
        'Staged scene creation changed document membership or order.',
      );
    await settleECSFrames(api!, 5);
  }
  // Sample an actual completed frame after asynchronous setup has settled.
  const prepared = await measure('pan', 2, 1);
  if (prepared.webglError !== 0)
    throw new Error(`WebGL setup error: ${prepared.webglError}`);
  return state();
}
function coreAction(operation: MixedOperation, index: number) {
  const sign = index % 2;
  if (operation === 'pan') core!.camera.x = (sign * 0.25) / baseZoom;
  if (operation === 'zoom') core!.camera.zoom = baseZoom * (1 + sign * 0.01);
  if (operation === 'edit')
    for (const i of editIndices) {
      const color = sign ? '#1d4ed8' : '#b91c1c';
      if (nodes[i].type === 'polyline') shapes[i].stroke = color;
      else shapes[i].fill = color;
    }
}
function ecsAction(e: API, operation: MixedOperation, index: number) {
  const sign = index % 2;
  if (operation === 'pan') e.setAppState({ cameraX: (sign * 0.25) / baseZoom });
  if (operation === 'zoom')
    e.setAppState({ cameraZoom: baseZoom * (1 + sign * 0.01) });
  if (operation === 'edit')
    e.updateNodes(
      editIndices.map((i) => {
        const n = nodes[i];
        const paints = [
          { type: 'solid' as const, value: sign ? '#1d4ed8' : '#b91c1c' },
        ];
        return n.type === 'polyline'
          ? { ...n, strokes: paints }
          : { ...n, fills: paints };
      }),
    );
}
async function measure(operation: MixedOperation, samples = 30, warmup = 15) {
  if (!['pan', 'zoom', 'edit'].includes(operation) || samples < 2 || warmup < 1)
    throw new Error('Invalid benchmark parameters');
  const times: number[] = [],
    submissions: ReturnType<typeof probe.snapshot>[] = [];
  if (core) {
    for (let i = 0; i < samples + warmup; i++) {
      probe.reset();
      const start = performance.now();
      coreAction(operation, i);
      core.render();
      times.push(performance.now() - start);
      submissions.push(probe.snapshot());
      await new Promise(requestAnimationFrame);
    }
  } else {
    const original = app!.world.execute.bind(app!.world);
    let pending: Promise<void> | undefined;
    app!.world.execute = (...args: Parameters<typeof original>) => {
      pending = (async () => {
        probe.reset();
        const start = performance.now();
        await original(...args);
        times.push(performance.now() - start);
        submissions.push(probe.snapshot());
      })();
      return pending;
    };
    try {
      for (let i = 0; i < samples + warmup; i++)
        await api!.edit((e) => ecsAction(e, operation, i), {
          capture: 'NEVER',
        });
    } finally {
      app!.world.execute = original;
      await pending;
    }
  }
  const measured = times.slice(warmup).sort((a, b) => a - b);
  const nativeFrames = submissions.slice(warmup);
  return {
    backend,
    operation,
    count: nodes.length,
    editedCount: operation === 'edit' ? editIndices.length : 0,
    samples: measured.length,
    warmup,
    cpuSamplesMs: times.slice(warmup),
    cpuP50: measured[Math.floor(measured.length * 0.5)],
    cpuP95: measured[Math.floor(measured.length * 0.95)],
    nonemptyFrames: nativeFrames.filter((f) => f.drawcalls > 0).length,
    size: [width, height],
    dpr: 1,
    browserDpr: devicePixelRatio,
    textCap: textLimit,
    zoom: baseZoom,
    featureSupport: {
      pathInstancing: true,
      textLOD: backend === 'ecs',
      polylineLOD: backend === 'ecs',
    },
    ...state(),
    nativeFrames,
  };
}
async function destroy() {
  probe.dispose();
  if (core) core.destroy();
  else await app!.exit();
  return baseline;
}
// Shared by glyph-atlas correctness tests; the baseline benchmark does not call these.
async function editText(content?: string) {
  if (content !== undefined)
    nodes = nodes.map((node) =>
      node.type === 'text' ? { ...node, content } : node,
    );
  if (core) {
    core.camera.zoom = 1;
    if (content !== undefined)
      for (const shape of shapes)
        if (shape instanceof Text) shape.content = content;
    core.render();
  } else {
    await api!.edit(
      (e) => {
        e.setAppState({ cameraZoom: 1 });
        if (content !== undefined)
          e.updateNodes(nodes.filter((n) => n.type === 'text'));
      },
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 2);
  }
  return state();
}
async function raster() {
  if (core) return core.toDataURL({ grid: false });
  const canvas = api!.getCanvas();
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Glyph raster export timeout')),
      10000,
    );
    const poll = () => {
      if (canvas.has(Screenshot)) {
        clearTimeout(timer);
        resolve(canvas.read(Screenshot).dataURL);
      } else api!.runAtNextTick(poll);
    };
    api!.runAtNextTick(() => {
      if (canvas.has(Screenshot)) canvas.remove(Screenshot);
      api!.export({ format: ExportFormat.PNG, download: false });
      poll();
    });
  });
}
const harness = { configure, measure, state, destroy, editText, raster };
declare global {
  interface Window {
    mixedRenderer: typeof harness;
  }
}
window.mixedRenderer = harness;
document.querySelector('output')!.textContent = 'Ready';
