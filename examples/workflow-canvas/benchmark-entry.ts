import { installECSCameraPhases } from '../../__tests__/browser/fixtures/ecs-camera-phases';
import {
  inputReplay,
  float32ReplayTarget,
} from '../../__tests__/browser/fixtures/input-replay';
import {
  completedCameraReplay,
  replaySurface,
  type ReplayView,
} from '../../__tests__/browser/fixtures/camera-replay';
/** Diagnostic entry only; the shipped index.html continues to import main.ts. */
import * as ECS from '@infinite-canvas-tutorial/ecs';
import { Store } from '../../packages/ecs/src/history/Store';
import { Snapshot } from '../../packages/ecs/src/history/Snapshot';
import { SmoothPolyline } from '../../packages/ecs/src/drawcalls/SmoothPolyline';
import { PathDrawcall } from '../../packages/ecs/src/drawcalls/PathDrawcall';
import { StrokeBatch } from '../../packages/ecs/src/drawcalls/StrokeBatch';
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
const detailedWheelPhases =
  new URLSearchParams(location.search).get('cameraPhases') === '1';
let wheelPhases: ReturnType<typeof framePhaseProbe> | undefined;
let capturedWheelPhases: FramePhases | undefined;
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
let capturedReplayPhases: FramePhases | undefined;
const replay = completedCameraReplay({
  view: () => {
    const c = runtime.api!.getCamera().read(ECS.ComputedCamera);
    return { x: c.x, y: c.y, zoom: c.zoom };
  },
  before: () => {
    native.reset();
    phases?.begin();
  },
  after: () => {
    capturedReplayPhases = phases?.end();
  },
  snapshot: () => ({
    surface: replaySurface(canvas),
    native: native.snapshot(),
    phases: capturedReplayPhases,
    state: state(),
    visibleIds: runtime
      .api!.getNodes()
      .filter(
        (n) =>
          (n.id.startsWith('node-') || n.id.startsWith('edge-')) &&
          !runtime.api!.getEntity(n).has(ECS.Culled),
      )
      .map((n) => n.id)
      .sort(),
  }),
});
type WheelSample = {
  isTrusted: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  clientX: number;
  clientY: number;
};
const wheelSnapshot = () => ({
  phaseDetail: wheelPhases ? 'camera' : undefined,
  phases: capturedWheelPhases,
  uiView: window.workflowDemo.snapshot().view,
  surface: replaySurface(canvas),
  native: native.snapshot(),
  state: state(false),
  visibleIds: runtime
    .api!.getNodes()
    .filter(
      (n) =>
        (n.id.startsWith('node-') || n.id.startsWith('edge-')) &&
        !runtime.api!.getEntity(n).has(ECS.Culled),
    )
    .map((n) => n.id)
    .sort(),
});
const wheelReplay = completedCameraReplay({
  view: () => {
    const c = runtime.api!.getCamera().read(ECS.ComputedCamera);
    return { x: c.x, y: c.y, zoom: c.zoom };
  },
  before: () => {
    native.reset();
    wheelPhases?.begin();
  },
  after: () => {
    capturedWheelPhases = wheelPhases?.end();
  },
  snapshot: wheelSnapshot,
});
const wheelInput = inputReplay<ReturnType<typeof wheelSnapshot>, WheelSample>(
  wheelReplay,
  () => float32ReplayTarget(window.workflowDemo.snapshot().view),
);
function observeWheel(event: WheelEvent) {
  wheelInput.observe({
    isTrusted: event.isTrusted,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaMode: event.deltaMode,
    clientX: event.clientX,
    clientY: event.clientY,
  });
}
// Registered before main.ts: observation does not cancel or replace its handler.
canvas.addEventListener('wheel', observeWheel, {
  capture: true,
  passive: true,
});
const originalRun = ECS.App.prototype.run;
ECS.App.prototype.run = async function () {
  const result = await originalRun.call(this);
  runtime.app = this;
  runtime.api!.onDestroy(() => {
    replay.dispose();
    wheelInput.dispose();
  });
  const execute = this.world.execute.bind(this.world);
  this.world.execute = (...args: Parameters<typeof execute>) => {
    if (!active)
      return wheelReplay.busy
        ? wheelReplay.run(() => execute(...args))
        : replay.run(() => execute(...args));
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
  if (detailedWheelPhases)
    throw new Error('Detailed wheel phases require a dedicated capture');
  if (active || inFlight || replay.busy || wheelInput.busy)
    throw new Error('Stop measurement before changing instrumentation');
  phases?.dispose();
  phases = undefined;
  Drawcall.prototype.submit = originalSubmit;
  if (!enabled) return;
  const collector = framePhaseProbe();
  for (const [ctor, key, label] of [
    [ECS.ApplyEdits, 'execute', 'edit.apply'],
    [ECS.API, 'updateNodes', 'edit.nodes'],
    [ECS.API, 'record', 'edit.record'],
    [Store, 'commit', 'history.commit'],
    [Snapshot, 'maybeClone', 'history.snapshot'],
    [Snapshot, 'maybeCreateElementsSnapshot', 'history.elements'],
    [ECS.ComputeCamera, 'execute', 'camera.derive'],
    [ECS.ComputeBounds, 'execute', 'bounds.derive'],
    [ECS.ViewportCulling, 'execute', 'visibility.cull'],
    [ECS.ComputeZIndex, 'execute', 'order.reconcile'],
    [ECS.Sort, 'execute', 'order.rank'],
    [ECS.MeshPipeline, 'renderCamera', 'render.camera'],
    [ECS.BatchManager, 'plan', 'batch.plan'],
    [ECS.BatchManager, 'flushDrawcalls', 'batch.submit'],
    [PathDrawcall, 'prepareGeometry', 'path.precision'],
    [StrokeBatch, 'prepareGeometry', 'stroke.prepare'],
    [SmoothPolyline, 'createGeometry', 'stroke.geometry'],
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
function state(checkErrors = true) {
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
  const theme = runtime.api?.getCanvas().read(ECS.Theme);
  const themeState = (mode: ECS.ThemeMode, colors: ECS.Theme['colors']) => ({
    mode,
    background: colors[mode]?.background,
    grid: colors[mode]?.grid,
  });
  return {
    theme: theme ? themeState(theme.mode, theme.colors) : undefined,
    requestedTheme: camera
      ? themeState(camera.themeMode, camera.theme.colors)
      : undefined,
    count: nodes.length,
    documentVersions: {
      present: nodes.filter((node) => node.version !== undefined).length,
      invalid: nodes.filter(
        (node) => node.version !== undefined && !Number.isFinite(node.version),
      ).length,
    },
    visible,
    view: { x: camera?.cameraX, y: camera?.cameraY, zoom: camera?.cameraZoom },
    canvas: {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      dpr: canvas.width / canvas.clientWidth,
    },
    allocatedBufferBytes: native.allocatedBufferBytes(),
    webglError: checkErrors ? native.webglError() : undefined,
    resources: window.lifecycleProbes.resources(),
  };
}
function begin() {
  if (active || inFlight || replay.busy || wheelInput.busy)
    throw new Error('Finish the previous capture first');
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
  armWheel(mode: 'ordinary' | 'phases' = 'ordinary') {
    if (
      (mode !== 'ordinary' && mode !== 'phases') ||
      detailedWheelPhases !== (mode === 'phases')
    )
      throw new Error(
        'Wheel phase mode must match the explicit diagnostic page',
      );
    if (
      active ||
      inFlight ||
      replay.busy ||
      phases ||
      disposed ||
      !window.workflowDemo.snapshot().ready
    )
      throw new Error(
        'Finish other capture and use ordinary mode before wheel input',
      );
    if (detailedWheelPhases && !wheelPhases) {
      if (!runtime.api!.getCanvas().has(ECS.GPUResource))
        throw new Error('Wait for GPU readiness before phase capture');
      wheelPhases = framePhaseProbe();
      installECSCameraPhases(wheelPhases, canvas);
    }
    wheelInput.arm();
  },
  wheelResult: () => wheelInput.take(),
  checkInputErrors() {
    if (wheelInput.busy || wheelReplay.busy)
      throw new Error('Finish wheel capture before GPU validation');
    const startedAt = performance.now();
    const errors: number[] = [];
    for (let i = 0; i < 32; i++) {
      const error = native.webglError();
      if (error === undefined) throw new Error('Missing WebGL context');
      if (error === 0)
        return { errors, elapsed: performance.now() - startedAt };
      errors.push(error);
    }
    throw new Error('WebGL error queue did not clear');
  },
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
  replayDocument: () => runtime.api!.getNodes(),
  replayCamera(view: ReplayView) {
    if (active || inFlight || wheelInput.busy || disposed)
      throw new Error('Stop other captures before camera replay');
    return replay.step(view, () =>
      runtime.api!.edit(
        (e) =>
          e.setAppState({
            cameraX: view.x,
            cameraY: view.y,
            cameraZoom: view.zoom,
          }),
        { capture: 'NEVER' },
      ),
    );
  },
  async recordUnchanged(count = 30, warmup = 5) {
    if (
      disposed ||
      count < 2 ||
      warmup < 0 ||
      !Number.isInteger(count) ||
      !Number.isInteger(warmup)
    )
      throw new Error('Invalid snapshot capture');
    const before = state();
    begin();
    const original = Snapshot.prototype.maybeClone;
    const captures: {
      elapsedMs: number;
      reused: boolean;
      elementsReused: boolean;
    }[] = [];
    Snapshot.prototype.maybeClone = function (
      ...args: Parameters<typeof original>
    ) {
      const start = performance.now();
      const next = original.apply(this, args);
      captures.push({
        elapsedMs: performance.now() - start,
        reused: next === this,
        elementsReused: next.elements === this.elements,
      });
      return next;
    };
    let frames: Sample[];
    try {
      for (let i = 0; i < count + warmup; i++)
        await runtime.api!.edit(() => {}, { capture: 'NEVER' });
      frames = await end();
    } finally {
      Snapshot.prototype.maybeClone = original;
      await end();
    }
    return {
      before,
      after: state(),
      captures: captures.slice(warmup),
      captureCount: captures.length,
      frames: frames.slice(warmup),
      observerRestored: Snapshot.prototype.maybeClone === original,
    };
  },
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
    replay.dispose();
    wheelInput.dispose();
    canvas.removeEventListener('wheel', observeWheel, true);
    await end();
    try {
      // Exercise the real example's teardown, including its UI timers/listeners.
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      await runtime.app?.exit();
    } finally {
      phases?.dispose();
      phases = undefined;
      wheelPhases?.dispose();
      wheelPhases = undefined;
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
