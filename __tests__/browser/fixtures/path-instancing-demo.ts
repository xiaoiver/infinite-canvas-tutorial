import { WebGLDeviceContribution } from '@antv/g-device-api';
import { WebGLDeviceContribution as ECSWebGLDeviceContribution } from '@infinite-canvas-tutorial/device-api';
import { createApp } from 'vue';
import PathInstancing from '../../../packages/site/docs/components/PathInstancing.vue';
import { ensureExampleWorld } from '../../../packages/site/docs/lib/ensure-example-world';
import type { API } from '../../../packages/ecs/src';

// The external Core device retains startup fallback resources on destruction.
// Snapshot that documented baseline; all later allocations must be released.
const startup: Record<number, Record<string, number>> = {};
const restores: (() => boolean)[] = [];
let releaseCore: () => void = () => {};
const deferredCore = new URLSearchParams(location.search).has('defer-core')
  ? new Promise<void>((resolve) => {
      releaseCore = resolve;
    })
  : Promise.resolve();
const createSwapChain = WebGLDeviceContribution.prototype.createSwapChain;
WebGLDeviceContribution.prototype.createSwapChain = async function (...args) {
  const swapChain = await createSwapChain.apply(this, args);
  const snapshot = window.lifecycleProbes.resources();
  startup[snapshot.length - 1] = snapshot[snapshot.length - 1].live;
  const device = swapChain.getDevice();
  const canvas = swapChain.getCanvas() as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const begin = device.beginFrame,
    end = device.endFrame,
    draw = gl!.drawElements;
  restores.push(
    () =>
      device.beginFrame === begin &&
      device.endFrame === end &&
      gl!.drawElements === draw,
  );
  await deferredCore;
  return swapChain;
};
// ECS keeps one shared export device for the lifetime of the example world.
const createECSSwapChain = ECSWebGLDeviceContribution.prototype.createSwapChain;
ECSWebGLDeviceContribution.prototype.createSwapChain = async function (
  ...args
) {
  const swapChain = await createECSSwapChain.apply(this, args);
  if (!(swapChain.getCanvas() as HTMLCanvasElement).isConnected) {
    const snapshot = window.lifecycleProbes.resources();
    startup[snapshot.length - 1] = snapshot[snapshot.length - 1].live;
  }
  return swapChain;
};
let api: API | undefined;
let app: ReturnType<typeof createApp> | undefined;
function mount() {
  api = undefined;
  const locale =
    new URLSearchParams(location.search).get('locale') === 'zh' ? 'zh' : 'en';
  app = createApp(PathInstancing, { locale });
  app.mount('#demo');
  document.querySelector('ic-spectrum-canvas')!.addEventListener(
    'ic-ready',
    (event) => {
      api = (event as CustomEvent<API>).detail;
    },
    { once: true },
  );
}
await ensureExampleWorld([], { appOptions: { maxEntities: 16_384 } });
mount();
const probe = {
  releaseCore: () => releaseCore(),
  startup: () => startup,
  restored: () => restores.every((check) => check()),
  nodes: () => api!.getNodes(),
  mount,
  unmount() {
    app?.unmount();
    app = undefined;
  },
};
declare global {
  interface Window {
    pathInstancingDemo: typeof probe;
  }
}
window.pathInstancingDemo = probe;
