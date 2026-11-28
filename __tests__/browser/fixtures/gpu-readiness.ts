import { WebGLDeviceContribution } from '@antv/g-device-api';
import {
  Canvas as CoreCanvas,
  Rect as CoreRect,
  CheckboardStyle as CoreGrid,
} from '../../../packages/core/src';
import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  CheckboardStyle,
  GPUResource,
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';

const backend = new URLSearchParams(location.search).get('backend');
const elements = ['failed', 'healthy'].map(
  (id) => document.querySelector<HTMLCanvasElement>('#' + id)!,
);
let deviceBaseline: ReturnType<typeof window.lifecycleProbes.resources> = [];
const outcomes: { status: string; error?: string }[] = [];
const core: CoreCanvas[] = [],
  apis: API[] = [];
let app: App | undefined;
// Establish Playwright's per-document listeners before the application baseline.
// No renderer resources or canvas listeners exist while this button is waiting.
const start = document.querySelector<HTMLButtonElement>('#start')!;
await new Promise<void>((resolve) => {
  start.addEventListener(
    'click',
    () => {
      start.disabled = true;
      resolve();
    },
    { once: true },
  );
  start.disabled = false;
});
window.lifecycleProbes.capturePageListeners();
if (backend === 'core') {
  const original = WebGLDeviceContribution.prototype.createSwapChain;
  WebGLDeviceContribution.prototype.createSwapChain = async function (...args) {
    const swap = await original.apply(this, args);
    deviceBaseline = window.lifecycleProbes.resources();
    return swap;
  };
  for (const element of elements)
    core.push(
      new CoreCanvas({
        canvas: element,
        devicePixelRatio: 1,
        checkboardStyle: CoreGrid.NONE,
      }),
    );
  if (new URLSearchParams(location.search).has('cancel')) {
    core[0].destroy();
    // The owner can disappear before anyone observes the public readiness wait.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
  const results = await Promise.allSettled(core.map((c) => c.initialized));
  WebGLDeviceContribution.prototype.createSwapChain = original;
  results.forEach((r) =>
    outcomes.push(
      r.status === 'fulfilled'
        ? { status: r.status }
        : { status: r.status, error: String(r.reason) },
    ),
  );
  for (const [i, c] of core.entries())
    if (results[i].status === 'fulfilled') {
      c.appendChild(
        new CoreRect({ x: 20, y: 20, width: 100, height: 80, fill: '#2563eb' }),
      );
      c.render();
    }
} else {
  class Bootstrap extends System {
    access = this.query((q) => q.usingAll.write);
    initialize() {
      for (const element of elements) {
        const api = new API(new DefaultStateManagement(), new Commands(this));
        api.createCanvas({
          renderer:
            new URLSearchParams(location.search).get('renderer') === 'webgpu'
              ? 'webgpu'
              : 'webgl',
          element,
          width: 200,
          height: 160,
          devicePixelRatio: 1,
        });
        api.createCamera({ x: 0, y: 0, zoom: 1 });
        api.setAppState({ checkboardStyle: CheckboardStyle.NONE });
        apis.push(api);
      }
    }
  }
  app = new App({ maxEntities: 16384 }).addPlugins(...DefaultPlugins, () => {
    system(PreStartUp)(Bootstrap);
    system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
  });
  await app.run();
  const results = await Promise.allSettled(apis.map((a) => a.initialized));
  results.forEach((r) =>
    outcomes.push(
      r.status === 'fulfilled'
        ? { status: r.status }
        : { status: r.status, error: String(r.reason) },
    ),
  );
  for (const [i, api] of apis.entries())
    if (results[i].status === 'fulfilled') {
      await api.edit(
        (editor) =>
          editor.updateNodes([
            {
              id: 'rect',
              zIndex: 0,
              type: 'rect',
              x: 20,
              y: 20,
              width: 100,
              height: 80,
              fills: [{ type: 'solid', value: '#2563eb' }],
            },
          ]),
        { capture: 'NEVER' },
      );
      await settleECSFrames(api, 2);
    }
}
const harness = {
  outcomes,
  attached: apis.map((a) => a.getCanvas().has(GPUResource)),
  async destroy() {
    core.forEach((c) => c.destroy());
    if (app) {
      await Promise.all(
        apis.map((a) =>
          a.edit((editor) => editor.destroy(), { capture: 'NEVER' }),
        ),
      );
      await app.exit();
    }
    return {
      resources: window.lifecycleProbes.resources(),
      deviceBaseline,
      leaks: window.lifecycleProbes.leaks(),
      listeners: window.lifecycleProbes.listeners(),
      baseline: window.lifecycleProbes.pageListeners(),
    };
  },
};
declare global {
  interface Window {
    gpuReadiness: typeof harness;
  }
}
window.gpuReadiness = harness;
document.querySelector('#status')!.textContent = 'Done';
