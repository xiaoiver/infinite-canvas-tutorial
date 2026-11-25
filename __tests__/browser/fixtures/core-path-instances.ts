import { framePhaseProbe } from './frame-phase-probe';
import {
  validateReplayView,
  replaySurface,
  type ReplayView,
} from './camera-replay';
import {
  Canvas,
  Path,
  Rect,
  Group,
  Theme,
  CheckboardStyle,
  serializeNode,
} from '../../../packages/core/src';
import { WebGLDeviceContribution } from '@antv/g-device-api';
import { BatchManager } from '../../../packages/core/src/drawcalls/BatchManager';
import { Mesh } from '../../../packages/core/src/drawcalls/Mesh';
import { PathInstances } from '../../../packages/core/src/drawcalls/PathInstances';
import type { Shape } from '../../../packages/core/src/shapes';
import { StrokeBatch } from '../../../packages/core/src/drawcalls/StrokeBatch';
import { PathDrawcall } from '../../../packages/core/src/drawcalls/PathDrawcall';
import { strokeReuseProbe } from './stroke-reuse-probe';
import { SmoothPolyline } from '../../../packages/core/src/drawcalls/SmoothPolyline';

const strokeCPU = strokeReuseProbe(
  PathDrawcall.prototype,
  SmoothPolyline.prototype,
);
// Benchmark-only native submission counters, including empty planned drawcalls and final passes.
const nativeWork = {
  bufferCreates: 0,
  bufferDeletes: 0,
  bufferAllocations: 0,
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
  strokeCPU.reset();
  for (const key of Object.keys(nativeWork) as (keyof typeof nativeWork)[])
    nativeWork[key] = 0;
};
for (const prototype of [
  window.WebGLRenderingContext?.prototype,
  window.WebGL2RenderingContext?.prototype,
]) {
  if (!prototype) continue;
  const create = prototype.createBuffer;
  prototype.createBuffer = function () {
    nativeWork.bufferCreates++;
    return create.call(this);
  };
  const remove = prototype.deleteBuffer;
  prototype.deleteBuffer = function (buffer) {
    nativeWork.bufferDeletes++;
    return remove.call(this, buffer);
  };
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
    nativeWork.bufferAllocations++;
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

const query = new URLSearchParams(location.search);
if (query.has('webgl1')) {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    if (args[0] === 'webgl2') return null;
    return get.apply(this, args);
  } as typeof get;
}
let deviceBaseline: ReturnType<typeof window.lifecycleProbes.resources>;
const swap = WebGLDeviceContribution.prototype.createSwapChain;
WebGLDeviceContribution.prototype.createSwapChain = async function (...args) {
  const result = await swap.apply(this, args);
  deviceBaseline = window.lifecycleProbes.resources();
  return result;
};
const dpr = Number(query.get('dpr')) || 1;
const element = document.querySelector('canvas')!;
element.width = 800 * dpr;
element.height = 600 * dpr;
const canvas = await new Canvas({
  canvas: element,
  devicePixelRatio: dpr,
  checkboardStyle: CheckboardStyle.NONE,
  themeColors: { [Theme.LIGHT]: { background: '#ffffff' } },
}).initialized;
let planned = 0,
  instances = 0,
  strokePages = 0;
const flush = BatchManager.prototype.flush;
BatchManager.prototype.flush = function (...args) {
  const r = flush.apply(this, args);
  planned = this.stats().drawcallCount;
  return r;
};
const render = PathInstances.prototype.render;
PathInstances.prototype.render = function (...args) {
  instances++;
  return render.apply(this, args);
};
const strokeRender = StrokeBatch.prototype.render;
StrokeBatch.prototype.render = function (...args) {
  strokePages++;
  return strokeRender.apply(this, args);
};
const replayPhases = framePhaseProbe();
replayPhases.wrap(BatchManager.prototype, 'planOrdered', 'batch.plan');
let replayDisposed = false;
let shapes: Shape[] = [];
let group = new Group();
canvas.appendChild(group);
function frame() {
  resetNativeWork();
  window.vertexUploads?.reset();
  instances = 0;
  strokePages = 0;
  canvas.render();
}
const api = {
  state() {
    return {
      enabled: canvas.pathInstancing,
      visible: shapes.filter((s) => !s.culled && s.visible).length,
      spatial: shapes.map(
        (s) =>
          canvas.pluginContext.rBushRoot.all().filter((n) => n.shape === s)
            .length,
      ),
      planned,
      instances,
      strokePages,
      native: { ...nativeWork },
      strokeCPU: strokeCPU.snapshot(),
      resources: window.lifecycleProbes?.resources(),
      document: shapes.map((s) => serializeNode(s)),
      vertex: window.vertexUploads
        ? { ...window.vertexUploads, reset: undefined }
        : undefined,
    };
  },
  seed(count: number, variants = 1) {
    canvas.removeChild(group);
    group = new Group();
    canvas.appendChild(group);
    shapes = [];
    for (let i = 0; i < count; i++) {
      const p = new Path({
        d: `M0 0 L${i % variants ? 16 : 18} 0 L20 20 L10 14 L0 20 Z`,
        fill: i % 2 ? '#dc2626' : '#2563eb',
        stroke: 'none',
        strokeWidth: 0,
        opacity: 0.5 + (i % 4) * 0.1,
      });
      p.batchable = true;
      p.position.set((i % 40) * 24, Math.floor(i / 40) * 24);
      group.appendChild(p);
      shapes.push(p);
    }
    canvas.camera.zoom = 0.75;
    canvas.camera.x = 0;
    canvas.camera.y = 0;
    frame();
  },
  strokes(count = 300, overlap = false, barrier = false) {
    this.seed(0);
    for (let i = 0; i < count; i++) {
      const p = new Path({
        d: `M0 15 C${5 + (i % 4)} -10 22 40 30 15`,
        fill: 'none',
        stroke: '#2563eb',
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        opacity: 0.65,
        batchable: true,
      });
      p.position.set(
        overlap ? 100 + i * 3 : 20 + (i % 20) * 40,
        overlap ? 100 + i * 2 : 20 + Math.floor(i / 20) * 35,
      );
      group.appendChild(p);
      shapes.push(p);
      if (i === 0 && barrier)
        group.appendChild(
          new Rect({
            x: 105,
            y: 110,
            width: 35,
            height: 15,
            fill: '#facc15',
            opacity: 0.5,
          }),
        );
    }
    frame();
  },
  scene(barrier = false, holes = false) {
    this.seed(0);
    for (let i = 0; i < 3; i++) {
      const p = new Path({
        d: holes
          ? 'M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z'
          : 'M0 0 H100 V100 H0 Z',
        fill: ['#dc2626', '#2563eb', '#16a34a'][i],
        opacity: 0.65,
        fillOpacity: 0.7,
        fillRule: 'evenodd',
        strokeWidth: 0,
      });
      p.batchable = true;
      p.position.set(220 + i * 15, 110 + i * 9);
      p.rotation = 0.25;
      p.scale.set(-1.3, 0.8);
      group.appendChild(p);
      shapes.push(p);
      if (i === 0 && barrier) {
        const r = new Rect({
          x: 160,
          y: 100,
          width: 70,
          height: 50,
          fill: '#facc15',
          opacity: 0.7,
        });
        group.appendChild(r);
      }
    }
    frame();
  },
  sdfScene() {
    this.seed(0);
    for (let i = 0; i < 4; i++) {
      const r = new Rect({
        x: 100 + i * 15,
        y: 100 + i * 10,
        width: 100,
        height: 100,
        strokeWidth: 0,
        opacity: 0.65,
        fill: i % 2 ? '#dc2626' : '#2563eb',
        batchable: false,
      });
      group.appendChild(r);
      shapes.push(r);
      if (i === 1) {
        const p = new Path({
          d: 'M0 0 H100 V100 H0 Z',
          fill: '#16a34a',
          opacity: 0.6,
          strokeWidth: 0,
          batchable: true,
        });
        p.position.set(110, 120);
        group.appendChild(p);
        shapes.push(p);
      }
    }
    frame();
  },
  batchable(value: boolean) {
    shapes.forEach((s) => {
      s.batchable = value;
      s.renderDirtyFlag = true;
    });
    frame();
  },
  enable(value: boolean) {
    canvas.pathInstancing = value;
    frame();
  },
  camera(x: number, zoom = canvas.camera.zoom) {
    canvas.camera.x = x;
    canvas.camera.zoom = zoom;
    frame();
  },
  replayDocument: () => shapes.map((shape) => serializeNode(shape)),
  replayCamera(view: ReplayView) {
    validateReplayView(view);
    if (replayDisposed) throw new Error('Replay is disposed');
    const requestedAt = performance.now();
    replayPhases.begin();
    let phases;
    let startedAt: number, elapsed: number, completedAt: number;
    try {
      startedAt = performance.now();
      if (canvas.camera.x !== view.x) canvas.camera.x = view.x;
      if (canvas.camera.y !== view.y) canvas.camera.y = view.y;
      if (canvas.camera.zoom !== view.zoom) canvas.camera.zoom = view.zoom;
      frame();
      completedAt = performance.now();
      elapsed = completedAt - startedAt;
    } finally {
      phases = replayPhases.end();
    }
    const visibleIndices = shapes.flatMap((shape, index) =>
      !shape.culled && shape.visible ? [index] : [],
    );
    const sampledView = {
      x: canvas.camera.x,
      y: canvas.camera.y,
      zoom: canvas.camera.zoom,
    };
    const data = {
      surface: replaySurface(element),
      visibleIndices,
      visible: visibleIndices.length,
      strokePages,
      native: { ...nativeWork },
      cpu: strokeCPU.snapshot(),
      phases,
      resources: window.lifecycleProbes?.resources(),
    };
    const observedAt = performance.now();
    return {
      requested: { ...view },
      operationToFrameMs: completedAt - requestedAt,
      operationToResultMs: observedAt - requestedAt,
      frames: [
        {
          view: sampledView,
          startedAt,
          elapsed,
          completedAt,
          observedAt,
          observationMs: observedAt - completedAt,
          data,
        },
      ],
    };
  },
  translate(index: number, x: number) {
    shapes[index].position.x = x;
    shapes[index].renderDirtyFlag = true;
    frame();
  },
  mutate(index: number, change: Record<string, unknown>) {
    Object.assign(shapes[index], change);
    shapes[index].renderDirtyFlag = true;
    frame();
  },
  parent(x: number, scale: number) {
    group.position.x = x;
    group.scale.set(scale);
    frame();
  },
  remove(index: number) {
    group.removeChild(shapes[index]);
    shapes.splice(index, 1);
    canvas.camera.x += 0.001;
    frame();
  },
  clear() {
    canvas.removeChild(group);
    group = new Group();
    canvas.appendChild(group);
    shapes = [];
    frame();
  },
  pick(x: number, y: number) {
    const s = canvas.elementFromPoint(x, y);
    return shapes.indexOf(s);
  },
  export(grid = false) {
    resetNativeWork();
    instances = 0;
    return canvas.toDataURL({ grid });
  },
  async failExport() {
    const original = Mesh.prototype.render;
    Mesh.prototype.render = function (...args) {
      Mesh.prototype.render = original;
      throw new Error('injected capture failure');
    };
    try {
      await canvas.toDataURL({ grid: true });
      return 'unexpected success';
    } catch (e) {
      return (e as Error).message;
    } finally {
      Mesh.prototype.render = original;
    }
  },
  async benchmarkStrokes(count: number, enabled: boolean) {
    this.strokes(count);
    this.enable(enabled);
    const zoom = Math.min(0.75, 600 / (Math.ceil(count / 20) * 35 + 40));
    this.camera(0, zoom);
    for (let i = 0; i < 10; i++) {
      this.camera((i % 2) * 0.2);
      await new Promise(requestAnimationFrame);
    }
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      this.camera((i % 2) * 0.2);
      samples.push(performance.now() - start);
      await new Promise(requestAnimationFrame);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const { document: _document, spatial: _spatial, ...state } = this.state();
    return {
      ...state,
      count,
      samples,
      p50: sorted[15],
      p95: sorted[28],
      zoom,
      dpr,
    };
  },
  async benchmark(count: number, enabled: boolean, variants: number) {
    this.seed(count, variants);
    this.enable(enabled);
    for (let i = 0; i < 15; i++) {
      this.camera((i % 2) * 0.2);
      await new Promise(requestAnimationFrame);
    }
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      this.camera((i % 2) * 0.2);
      samples.push(performance.now() - start);
      await new Promise(requestAnimationFrame);
    }
    samples.sort((a, b) => a - b);
    const { document: _doc, ...state } = this.state();
    return {
      ...state,
      count,
      variants,
      samples: samples.length,
      p50: samples[15],
      p95: samples[28],
      dpr,
    };
  },
  destroy() {
    replayDisposed = true;
    replayPhases.dispose();
    canvas.destroy();
    return deviceBaseline;
  },
};
Object.assign(window, { corePathInstances: api });
declare global {
  interface Window {
    corePathInstances: typeof api;
  }
}
document.querySelector('#status')!.textContent = 'Ready';
