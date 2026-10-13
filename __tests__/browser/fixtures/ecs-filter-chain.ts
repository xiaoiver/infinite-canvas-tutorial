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
  ThemeMode,
  GPUResource,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { FilterPlugin } from '../../../packages/plugin-filter/src';
import { settleECSFrames } from './ecs-frames';
import type { Texture } from '@infinite-canvas-tutorial/device-api';

const canvas = document.querySelector<HTMLCanvasElement>('#actual')!;
let api: API;
class Bootstrap extends System {
  access = this.query((q) => q.usingAll.write);
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    api.createCanvas({
      element: canvas,
      width: 180,
      height: 160,
      devicePixelRatio: 1,
    });
    api.createCamera({ zoom: 1, x: 0, y: 0 });
    api.setAppState({
      checkboardStyle: CheckboardStyle.NONE,
      theme: {
        mode: ThemeMode.LIGHT,
        colors: { light: { background: 'transparent' } },
      },
    });
  }
}
const app = new App().addPlugins(...DefaultPlugins, FilterPlugin, () => {
  system(PreStartUp)(Bootstrap);
  system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
});
await app.run();
await settleECSFrames(api);
const device = api.getCanvas().read(GPUResource).device;
const textures = new Map<
  Texture,
  { destroyed: boolean; width: number; height: number }
>();
const resourceErrors: string[] = [];
const createTexture = device.createTexture.bind(device);
device.createTexture = (descriptor) => {
  const texture = createTexture(descriptor);
  const state = {
    destroyed: false,
    width: descriptor.width,
    height: descriptor.height,
  };
  textures.set(texture, state);
  const destroy = texture.destroy.bind(texture);
  texture.destroy = () => {
    if (state.destroyed) resourceErrors.push('Texture destroyed twice');
    state.destroyed = true;
    destroy();
  };
  return texture;
};
const createBindings = device.createBindings.bind(device);
device.createBindings = (descriptor) => {
  for (const binding of descriptor.samplerBindings ?? [])
    if (textures.get(binding.texture)?.destroyed)
      resourceErrors.push('Binding references destroyed texture');
  return createBindings(descriptor);
};
const snapshot = () => ({
  image: canvas.toDataURL(),
  resourceErrors: [...resourceErrors],
  liveTextures: [...textures.values()]
    .filter((t) => !t.destroyed)
    .map(({ width, height }) => [width, height]),
});
const harness = {
  async view(zoom: number) {
    await api.edit(() =>
      api.setAppState({ cameraZoom: zoom, cameraX: 0, cameraY: 0 }),
    );
    await settleECSFrames(api);
    return snapshot();
  },
  async render(node: SerializedNode, globalFilter = '') {
    await api.edit(() => {
      api.setAppState({ filter: globalFilter });
      api.deleteNodesById(api.getNodes().map((node) => node.id));
      api.updateNodes([node]);
    });
    await settleECSFrames(api);
    return snapshot();
  },
  async update(patch: Partial<SerializedNode>) {
    await api.edit(() => api.updateNode(api.getNodeById('shape'), patch));
    await settleECSFrames(api);
    return snapshot();
  },
  async clear() {
    await api.edit(() => api.deleteNodesById(['shape']));
    await settleECSFrames(api);
    return snapshot();
  },
  async settle() {
    await settleECSFrames(api);
    return snapshot();
  },
};
window.filterChainTest = harness;
declare global {
  interface Window {
    filterChainTest: typeof harness;
  }
}
document.querySelector('#status')!.textContent = 'Ready';
