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
  GlobalRenderOrder,
  Culled,
  ComputedLOD,
  Pen,
  CheckboardStyle,
  type SerializedNode,
  type TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';
import { mixedFrameProbe } from './mixed-frame-probe';
import { framePhaseProbe, type FramePhases } from './frame-phase-probe';
import { Sort } from '../../../packages/ecs/src/systems/Sort';
import { MeshPipeline } from '../../../packages/ecs/src/systems/MeshPipeline';

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
let phases: ReturnType<typeof framePhaseProbe> | undefined;
let baseline = [] as ReturnType<typeof window.lifecycleProbes.resources>;
// Fixture-only order propagation counters. Core counts assignments; ECS observes
// the renderer's GlobalRenderOrder change query after Sort has executed.
let orderSignals = 0,
  sortInputs = 0;
let restoreOrderProbe = () => {};
if (backend === 'ecs') {
  const sort = Sort.prototype.execute,
    mesh = MeshPipeline.prototype.execute;
  Sort.prototype.execute = function () {
    sortInputs += (
      this as unknown as {
        fractionalIndexes: { addedChangedOrRemoved: unknown[] };
      }
    ).fractionalIndexes.addedChangedOrRemoved.length;
    return sort.call(this);
  };
  MeshPipeline.prototype.execute = function () {
    orderSignals += (
      this as unknown as { batchOrders: { addedOrChanged: unknown[] } }
    ).batchOrders.addedOrChanged.length;
    return mesh.call(this);
  };
  restoreOrderProbe = () => {
    Sort.prototype.execute = sort;
    MeshPipeline.prototype.execute = mesh;
  };
}
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
  if (node.type === 'text') {
    const text = new Text({
      ...paint,
      x,
      y,
      content: node.content,
      fontFamily: 'sans-serif',
      fontSize: 12,
      textBaseline: 'top',
    });
    text.batchable = true;
    return text;
  }
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
    orderSignals,
    sortInputs,
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
    for (const shape of shapes) {
      let order = shape.globalRenderOrder;
      Object.defineProperty(shape, 'globalRenderOrder', {
        enumerable: true,
        configurable: true,
        get: () => order,
        set: (next: number) => {
          orderSignals++;
          order = next;
        },
      });
    }
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
  const phaseSamples: FramePhases[] = [];
  const times: number[] = [],
    submissions: ReturnType<typeof probe.snapshot>[] = [];
  if (core) {
    for (let i = 0; i < samples + warmup; i++) {
      probe.reset();
      phases?.begin();
      const start = performance.now();
      try {
        if (phases) {
          phases.run('core.mutate', () => coreAction(operation, i));
          phases.run('core.render', () => core!.render());
        } else {
          coreAction(operation, i);
          core.render();
        }
        times.push(performance.now() - start);
      } finally {
        if (phases) phaseSamples.push(phases.end());
      }
      submissions.push(probe.snapshot());
      await new Promise(requestAnimationFrame);
    }
  } else {
    const original = app!.world.execute.bind(app!.world);
    let pending: Promise<void> | undefined;
    app!.world.execute = (...args: Parameters<typeof original>) => {
      pending = (async () => {
        probe.reset();
        phases?.begin();
        const start = performance.now();
        try {
          await original(...args);
          times.push(performance.now() - start);
        } finally {
          if (phases) phaseSamples.push(phases.end());
        }
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
    phaseSamples: phaseSamples.slice(warmup),
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
  phases?.dispose();
  phases = undefined;
  probe.dispose();
  try {
    if (core) core.destroy();
    else await app!.exit();
  } finally {
    restoreOrderProbe();
  }
  return baseline;
}
// Shared by glyph-atlas correctness tests; the baseline benchmark does not call these.
async function editText(content?: string | string[]) {
  if (content !== undefined) {
    let textIndex = 0;
    nodes = nodes.map((node) =>
      node.type === 'text'
        ? {
            ...node,
            content: Array.isArray(content)
              ? content[textIndex++ % content.length]
              : content,
          }
        : node,
    );
  }
  if (core) {
    core.camera.zoom = 1;
    if (content !== undefined)
      for (let i = 0; i < shapes.length; i++)
        if (shapes[i] instanceof Text)
          (shapes[i] as Text).content = (
            nodes[i] as TextSerializedNode
          ).content;
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
async function editOneText(index: number, content: string) {
  const node = nodes.filter((n) => n.type === 'text')[index];
  if (!node) throw new Error('No text at index');
  const updated = { ...node, content };
  const i = nodes.indexOf(node);
  nodes[i] = updated;
  if (core) {
    (shapes[i] as Text).content = content;
    core.render();
  } else {
    await api!.edit((e) => e.updateNodes([updated]), { capture: 'NEVER' });
    await settleECSFrames(api!, 2);
  }
  return state();
}
async function removeTexts(count: number) {
  const remove = new Set<SerializedNode>(
    nodes.filter((n) => n.type === 'text').slice(0, count),
  );
  if (core) {
    shapes = shapes.filter((shape, i) => {
      if (!remove.has(nodes[i])) return true;
      core!.removeChild(shape);
      return false;
    });
    nodes = nodes.filter((n) => !remove.has(n));
    core.render();
  } else {
    await api!.edit((e) => e.deleteNodesById([...remove].map((n) => n.id)), {
      capture: 'NEVER',
    });
    nodes = nodes.filter((n) => !remove.has(n));
    await settleECSFrames(api!, 2);
  }
  return state();
}
async function paintText(index: number, color: string, opacity = 1) {
  const node = nodes.filter((n) => n.type === 'text')[index];
  if (!node) throw new Error('No text at index');
  const i = nodes.indexOf(node),
    updated = {
      ...node,
      opacity,
      fills: [{ type: 'solid' as const, value: color }],
    };
  nodes[i] = updated;
  if (core) {
    shapes[i].fill = color;
    shapes[i].opacity = opacity;
    core.render();
  } else {
    await api!.edit((e) => e.updateNodes([updated]), { capture: 'NEVER' });
    await settleECSFrames(api!, 3);
  }
  return state();
}
async function textPresence(mode: 'hidden' | 'culled' | 'visible') {
  const textNodes = nodes.filter((n) => n.type === 'text');
  if (core) {
    shapes.forEach((s, i) => {
      if (!(s instanceof Text)) return;
      s.visible = mode !== 'hidden';
      s.x = mode === 'culled' ? 100000 : nodes[i].x;
    });
    core.render();
  } else {
    await api!.edit(
      (e) =>
        e.updateNodes(
          textNodes.map((n) => ({
            ...n,
            visibility: mode === 'hidden' ? 'hidden' : 'visible',
            x: mode === 'culled' ? 100000 : n.x,
          })),
        ),
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 3);
  }
  return state();
}
function textPicking() {
  if (core) {
    const list = core
      .elementsFromBBox(0, 0, 960, 640)
      .filter((s) => s instanceof Text);
    return {
      document: shapes
        .filter((s) => s instanceof Text)
        .map((s) => (s as Text).content),
      hits: list.map((s) => shapes.indexOf(s)),
    };
  }
  return {
    document: api!
      .getNodes()
      .filter((n) => n.type === 'text')
      .map((n) => (n as TextSerializedNode).content),
    hits: api!
      .elementsFromBBox(0, 0, 960, 640)
      .filter((e) => textNodesIds().has(api!.getNodeByEntity(e)?.id))
      .map((e) => api!.getNodeByEntity(e).id),
  };
}
function textNodesIds() {
  return new Set(nodes.filter((n) => n.type === 'text').map((n) => n.id));
}
async function textScenario(kind: 'overlap' | 'transform') {
  let j = 0;
  nodes = nodes.map((node) =>
    node.type !== 'text'
      ? node
      : {
          ...node,
          x: 120 + (j++ % 5) * 3,
          y: 120 + Math.floor(j / 5) * 4,
          opacity: 0.6,
          rotation: kind === 'transform' ? 30 : 0,
        },
  );
  if (core) {
    nodes.forEach((node, i) => {
      if (node.type !== 'text') return;
      const text = shapes[i] as Text;
      text.x = node.x;
      text.y = node.y;
      text.opacity = node.opacity!;
      text.rotation = (node.rotation! * Math.PI) / 180;
    });
    core.render();
  } else {
    await api!.edit(
      (e) => e.updateNodes(nodes.filter((n) => n.type === 'text')),
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 3);
  }
  return state();
}
async function reorderText() {
  const node = nodes.find((n) => n.type === 'text')!;
  const i = nodes.indexOf(node);
  if (core) {
    shapes[i].zIndex = nodes.length + 1;
    core.render();
  } else {
    await api!.edit((e) => e.bringToFront(e.getNodeById(node.id)), {
      capture: 'NEVER',
    });
    await settleECSFrames(api!, 3);
  }
  return state();
}
function textOrder() {
  return nodes
    .filter((n) => n.type === 'text')
    .map((n) => {
      const order = core
        ? shapes[nodes.indexOf(n)].globalRenderOrder
        : api!.getEntity(api!.getNodeById(n.id)).read(GlobalRenderOrder).value;
      return { id: n.id, order };
    })
    .sort((a, b) => a.order - b.order)
    .map((n) => n.id);
}
async function textBatching(enabled: boolean) {
  if (core) {
    core.textBatching = enabled;
    core.render();
  } else {
    api!.setTextBatchingEnabled(enabled);
    await settleECSFrames(api!, 3);
  }
  return state();
}
async function solidDepthScene() {
  // With ten interleaved nodes, an ellipse immediately precedes the second text.
  // Removing the first text changes numeric ranks without dirtying that ellipse.
  nodes = nodes.map((node, i) =>
    i === 6
      ? { ...node, x: 120, y: 120 }
      : i === 7
      ? {
          ...node,
          x: 120,
          y: 120,
          content: 'MMMM',
          fontSize: 24,
          fills: [{ type: 'solid' as const, value: '#ef4444' }],
        }
      : node,
  );
  if (core) {
    const circle = shapes[6] as Circle,
      text = shapes[7] as Text;
    circle.cx = 130;
    circle.cy = 130;
    text.x = 120;
    text.y = 120;
    text.content = 'MMMM';
    text.fontSize = 24;
    text.fill = '#ef4444';
    core.camera.zoom = 1;
    core.render();
  } else {
    await api!.edit(
      (e) => {
        e.setAppState({ cameraZoom: 1 });
        e.updateNodes([nodes[6], nodes[7]]);
      },
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 3);
  }
  return state();
}
// Pixel parity between independent full SDF draws and instance rows.
async function solidStyles() {
  let ordinal = 0;
  nodes = nodes.map((node) => {
    if (node.type !== 'rect' && node.type !== 'ellipse') return node;
    const i = ordinal++;
    return {
      ...node,
      opacity: 0.55 + (i % 3) * 0.2,
      fills: [
        {
          type: 'solid' as const,
          value: ['#ef444480', '#2563eb', '#10b981'][i % 3],
        },
      ],
      strokes: [{ type: 'solid' as const, value: '#7c3aed' }],
      strokeWidth: 2,
      strokeAlignment: (['center', 'inner', 'outer'] as const)[i % 3],
      cornerRadius: 4,
      sizeAttenuation: i % 2 === 0,
      strokeAttenuation: i % 2 !== 0,
      ...(node.type === 'rect'
        ? {
            innerShadowColor: i % 7 === 0 ? '#11182780' : 'transparent',
            innerShadowOffsetX: 1,
            innerShadowOffsetY: 2,
            innerShadowBlurRadius: i % 7 === 0 ? 2 : 0,
          }
        : {}),
    };
  });
  if (core) {
    core.camera.zoom = 1;
    nodes.forEach((node, i) => {
      if (node.type !== 'rect' && node.type !== 'ellipse') return;
      const shape = shapes[i];
      shape.fill = node.fills[0].value;
      shape.stroke = node.strokes[0].value;
      shape.strokeWidth = node.strokeWidth;
      shape.strokeAlignment = node.strokeAlignment;
      shape.opacity = node.opacity;
      shape.sizeAttenuation = node.sizeAttenuation;
      shape.strokeAttenuation = node.strokeAttenuation;
      if (node.type === 'rect') {
        shape.innerShadowColor = node.innerShadowColor;
        shape.innerShadowOffsetX = node.innerShadowOffsetX;
        shape.innerShadowOffsetY = node.innerShadowOffsetY;
        shape.innerShadowBlurRadius = node.innerShadowBlurRadius;
      }
      if (shape instanceof Rect) shape.cornerRadius = 4;
    });
    core.render();
  } else {
    await api!.edit(
      (e) => {
        e.setAppState({ cameraZoom: 1 });
        e.updateNodes(
          nodes.filter((n) => n.type === 'rect' || n.type === 'ellipse'),
        );
      },
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 3);
  }
  return state();
}
async function solidBatching(enabled: boolean) {
  if (core) {
    nodes.forEach((node, i) => {
      if (node.type === 'rect' || node.type === 'ellipse') {
        shapes[i].batchable = enabled;
        shapes[i].renderDirtyFlag = true;
      }
    });
    core.render();
  } else {
    await api!.edit(
      (e) => {
        for (const node of nodes)
          if (node.type === 'rect' || node.type === 'ellipse')
            e.getEntity(node).write(Renderable).batchable = enabled;
      },
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 3);
  }
  return state();
}
// Installed only on explicit diagnostic request, after the renderer import graph
// has initialized. Normal benchmark runs have no method wrappers or timing scopes.
async function profile(enabled: boolean) {
  phases?.dispose();
  phases = undefined;
  if (!enabled) return;
  const collector = framePhaseProbe();
  const names: string[] = [],
    skippedAsyncSystems: string[] = [];
  try {
    if (core) {
      const { BatchManager } = await import(
        '../../../packages/core/src/drawcalls/BatchManager'
      );
      collector.wrap(BatchManager.prototype, 'planOrdered', 'batch.plan');
      collector.wrap(BatchManager.prototype, 'flush', 'batch.submit');
      names.push('core.mutate', 'core.render', 'batch.plan', 'batch.submit');
    } else {
      const systems = await import('../../../packages/ecs/src/systems');
      const labels = new Map<object, string>([
        [systems.ApplyEdits, 'edit.apply'],
        [systems.ComputePoints, 'derive.points'],
        [systems.ComputeTextMetrics, 'derive.text'],
        [systems.SyncSimpleTransforms, 'derive.transforms'],
        [systems.PropagateTransforms, 'derive.transforms'],
        [systems.ComputeBounds, 'derive.bounds'],
        [systems.ComputeCamera, 'derive.camera'],
        [systems.ComputeVisibility, 'visibility.derive'],
        [systems.ViewportCulling, 'visibility.cull'],
        [systems.ComputeLOD, 'visibility.lod'],
        [systems.ComputeZIndex, 'order.reconcile'],
        [systems.Sort, 'order.rank'],
        [systems.MeshPipeline, 'render.pipeline'],
      ]);
      const seen = new Set<object>();
      for (const ctor of Object.values(systems)) {
        if (
          typeof ctor !== 'function' ||
          !(ctor.prototype instanceof System) ||
          seen.has(ctor.prototype)
        )
          continue;
        seen.add(ctor.prototype);
        const execute = (ctor.prototype as { execute?: () => unknown }).execute;
        if (typeof execute !== 'function') continue;
        if (execute.constructor.name === 'AsyncFunction') {
          skippedAsyncSystems.push(ctor.name);
          continue;
        }
        const label = labels.get(ctor) ?? `system.${ctor.name}`;
        collector.wrap(ctor.prototype, 'execute', label);
        names.push(label);
      }
      collector.wrap(
        systems.MeshPipeline.prototype,
        'renderCamera',
        'render.camera',
      );
      collector.wrap(systems.BatchManager.prototype, 'plan', 'batch.plan');
      collector.wrap(
        systems.BatchManager.prototype,
        'scheduleFlush',
        'batch.schedule',
      );
      collector.wrap(
        systems.BatchManager.prototype,
        'flushDrawcalls',
        'batch.submit',
      );
      names.push(
        'render.camera',
        'batch.plan',
        'batch.schedule',
        'batch.submit',
      );
    }
    phases = collector;
    return { phases: names, skippedAsyncSystems };
  } catch (error) {
    collector.dispose();
    throw error;
  }
}
const harness = {
  solidDepthScene,
  solidStyles,
  solidBatching,
  profile,
  reorderText,
  textOrder,
  paintText,
  textPresence,
  textPicking,
  textScenario,
  textBatching,
  configure,
  measure,
  state,
  destroy,
  editText,
  raster,
  editOneText,
  removeTexts,
};
declare global {
  interface Window {
    mixedRenderer: typeof harness;
  }
}
window.mixedRenderer = harness;
document.querySelector('output')!.textContent = 'Ready';
