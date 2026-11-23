/** Diagnostic entry only; the shipped index.html continues to import main.ts. */
import * as ECS from '@infinite-canvas-tutorial/ecs';
import { Drawcall } from '../../packages/ecs/src/drawcalls/Drawcall';
import {
  framePhaseProbe,
  type FramePhases,
} from '../../__tests__/browser/fixtures/frame-phase-probe';
import { mixedFrameProbe } from '../../__tests__/browser/fixtures/mixed-frame-probe';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const originalGetContext = canvas.getContext;
const native = mixedFrameProbe(canvas);
const runtime: { api?: ECS.API; app?: ECS.App } = {};
let active = false;
let previous = 0;
let phases: ReturnType<typeof framePhaseProbe> | undefined;
type Sample = {
  startedAt: number;
  view: { x: number; y: number; zoom: number };
  elapsed: number;
  completedAt: number;
  interval?: number;
  native: ReturnType<typeof native.snapshot>;
  phases?: FramePhases;
};
let samples: Sample[] = [];
let inFlight: Promise<void> | undefined;
let wanted:
  | { count: number; resolve: () => void; reject: (error: unknown) => void }
  | undefined;
let disposed = false;
const originalSubmit = Drawcall.prototype.submit;
const originalCanvas = ECS.API.prototype.createCanvas;
ECS.API.prototype.createCanvas = function (
  ...args: Parameters<typeof originalCanvas>
) {
  runtime.api = this;
  const control = new URLSearchParams(location.search).get('strokeBatching');
  if (control !== null)
    args[0] = { ...args[0], pathInstancing: control !== '0' };
  const imageControl = new URLSearchParams(location.search).get(
    'imageBatching',
  );
  if (imageControl !== null)
    args[0] = { ...args[0], imageBatching: imageControl !== '0' };
  return originalCanvas.apply(this, args);
};
const originalRun = ECS.App.prototype.run;
ECS.App.prototype.run = async function () {
  const result = await originalRun.call(this);
  runtime.app = this;
  const execute = this.world.execute.bind(this.world);
  this.world.execute = (...args: Parameters<typeof execute>) => {
    if (!active) return execute(...args);
    const pending = (async () => {
      const profile = phases;
      native.reset();
      profile?.begin();
      const start = performance.now();
      try {
        await execute(...args);
      } catch (error) {
        wanted?.reject(error);
        throw error;
      } finally {
        const completedAt = performance.now();
        const view = runtime.api!.getAppState();
        samples.push({
          startedAt: start,
          view: { x: view.cameraX, y: view.cameraY, zoom: view.cameraZoom },
          elapsed: completedAt - start,
          completedAt,
          interval: previous ? completedAt - previous : undefined,
          native: native.snapshot(),
          phases: profile?.end(),
        });
        previous = completedAt;
        if (wanted && samples.length >= wanted.count) wanted.resolve();
      }
    })();
    inFlight = pending;
    return pending;
  };
  return result;
};
function profile(enabled: boolean) {
  if (active || inFlight)
    throw new Error('Stop measurement before changing instrumentation');
  phases?.dispose();
  phases = undefined;
  Drawcall.prototype.submit = originalSubmit;
  if (!enabled) return;
  const collector = framePhaseProbe();
  for (const [ctor, key, label] of [
    [ECS.ApplyEdits, 'execute', 'edit.apply'],
    [ECS.ComputeCamera, 'execute', 'camera.derive'],
    [ECS.ComputeBounds, 'execute', 'bounds.derive'],
    [ECS.ViewportCulling, 'execute', 'visibility.cull'],
    [ECS.ComputeZIndex, 'execute', 'order.reconcile'],
    [ECS.Sort, 'execute', 'order.rank'],
    [ECS.MeshPipeline, 'renderCamera', 'render.camera'],
    [ECS.BatchManager, 'plan', 'batch.plan'],
    [ECS.BatchManager, 'flushDrawcalls', 'batch.submit'],
  ] as const)
    collector.wrap(ctor.prototype, key, label);
  Drawcall.prototype.submit = function (
    ...args: Parameters<typeof originalSubmit>
  ) {
    return collector.run(`drawcall.${this.constructor.name}`, () =>
      originalSubmit.apply(this, args),
    );
  };
  phases = collector;
}
function state() {
  const nodes = runtime.api?.getNodes() ?? [];
  const visible = { cards: 0, edges: 0, other: 0 };
  for (const n of nodes) {
    const e = runtime.api!.getEntity(n);
    if (!e || e.has(ECS.Culled)) continue;
    if (n.id.startsWith('node-')) visible.cards++;
    else if (n.id.startsWith('edge-')) visible.edges++;
    else visible.other++;
  }
  const camera = runtime.api?.getAppState();
  return {
    count: nodes.length,
    visible,
    view: { x: camera?.cameraX, y: camera?.cameraY, zoom: camera?.cameraZoom },
    canvas: {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      dpr: canvas.width / canvas.clientWidth,
    },
    allocatedBufferBytes: native.allocatedBufferBytes(),
    webglError: native.webglError(),
    resources: window.lifecycleProbes.resources(),
  };
}
function begin() {
  if (active || inFlight) throw new Error('Finish the previous capture first');
  samples = [];
  previous = 0;
  active = true;
}
async function end() {
  active = false;
  try {
    await inFlight;
    return [...samples];
  } finally {
    inFlight = undefined;
    wanted = undefined;
  }
}
const harness = {
  dragTarget() {
    const candidates = runtime
      .api!.getNodes()
      .filter(
        (n) =>
          n.id.startsWith('node-') &&
          !runtime.api!.getEntity(n).has(ECS.Culled),
      )
      .map((n) => {
        const rect = n as ECS.RectSerializedNode;
        const point = runtime.api!.canvas2Viewport({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        });
        return { id: n.id, x: rect.x, y: rect.y, point };
      })
      .filter(
        (n) =>
          n.point.x > 100 &&
          n.point.x < canvas.clientWidth - 100 &&
          n.point.y > 260 &&
          n.point.y < canvas.clientHeight - 100,
      );
    candidates.sort(
      (a, b) =>
        Math.hypot(
          a.point.x - canvas.clientWidth / 2,
          a.point.y - canvas.clientHeight / 2,
        ) -
        Math.hypot(
          b.point.x - canvas.clientWidth / 2,
          b.point.y - canvas.clientHeight / 2,
        ),
    );
    if (!candidates.length)
      throw new Error('No unobscured visible drag target');
    return candidates[0];
  },
  nodePosition(id: string) {
    const n = runtime.api!.getNodeById(id) as ECS.RectSerializedNode;
    return { x: n.x, y: n.y };
  },

  state,
  profile,
  begin,
  end,
  async collect(count = 30, warmup = 5) {
    if (count < 2 || warmup < 0) throw new Error('Invalid sample count');
    begin();
    await new Promise<void>((resolve, reject) => {
      wanted = { count: count + warmup, resolve, reject };
    });
    return (await end()).slice(warmup);
  },
  async dispose() {
    if (disposed) return;
    disposed = true;
    await end();
    try {
      // Exercise the real example's teardown, including its UI timers/listeners.
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      await runtime.app?.exit();
    } finally {
      phases?.dispose();
      phases = undefined;
      native.dispose();
      Drawcall.prototype.submit = originalSubmit;
      ECS.App.prototype.run = originalRun;
      ECS.API.prototype.createCanvas = originalCanvas;
    }
    return {
      run: ECS.App.prototype.run === originalRun,
      createCanvas: ECS.API.prototype.createCanvas === originalCanvas,
      submit: Drawcall.prototype.submit === originalSubmit,
      context: canvas.getContext === originalGetContext,
    };
  },
};
window.workflowBenchmark = harness;
declare global {
  interface Window {
    workflowBenchmark: typeof harness;
  }
}
await import('./main');
