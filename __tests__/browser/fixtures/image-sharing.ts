import * as ECS from '@infinite-canvas-tutorial/ecs';
import {
  Canvas as CoreCanvas,
  Rect,
  Theme,
  CheckboardStyle,
} from '../../../packages/core/src';
import {
  Format as CoreFormat,
  TextureUsage as CoreUsage,
  WebGLDeviceContribution,
} from '@antv/g-device-api';
import { Format, TextureUsage } from '../../../packages/device-api/src';
import { ImageTexturePool as CorePool } from '../../../packages/core/src/utils/image-texture-pool';
import { ImageTexturePool as ECSPool } from '../../../packages/ecs/src/utils/image-texture-pool';
import { mixedFrameProbe } from './mixed-frame-probe';
import { settleECSFrames } from './ecs-frames';
import { setFillLayerDecodedBitmapForUrl } from '../../../packages/ecs/src/utils/fill-layer-image-url-raster';

const backend = new URLSearchParams(location.search).get('backend') ?? 'core';
const privateImages = new URLSearchParams(location.search).has('private');
const restore: (() => void)[] = [];
const originalAcquires = [
  CorePool.prototype.acquire,
  ECSPool.prototype.acquire,
];
for (const Pool of [CorePool, ECSPool]) {
  const original = Pool.prototype.acquire;
  Pool.prototype.acquire = function (
    device,
    source,
    key,
    create,
    share = true,
  ) {
    return original.call(
      this,
      device,
      source,
      key,
      create,
      share && !privateImages,
    );
  };
  restore.push(() => {
    Pool.prototype.acquire = original;
  });
}
const canvas = document.querySelector<HTMLCanvasElement>('#actual')!;
const originalContext = canvas.getContext;
const probe = mixedFrameProbe(canvas);
const sources: HTMLCanvasElement[] = [],
  bitmaps: ImageBitmap[] = [],
  urls: string[] = [];
for (const colors of [
  ['#d62950', '#fff'],
  ['#239a5e', '#67b8e8'],
]) {
  const source = document.createElement('canvas');
  source.width = 64;
  source.height = 48;
  const ctx = source.getContext('2d')!;
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, 64, 48);
  ctx.fillStyle = colors[1];
  ctx.fillRect(0, 0, 23, 31);
  ctx.clearRect(43, 29, 21, 19);
  sources.push(source);
  // Match the workflow's decoded PNG snapshots, rather than transferring a
  // canvas-backed GPU image between Canvas 2D and WebGL contexts.
  const blob = await new Promise<Blob>((resolve, reject) =>
    source.toBlob(
      (value) => value ? resolve(value) : reject(new Error('PNG encode failed')),
      'image/png',
    ),
  );
  bitmaps.push(await createImageBitmap(blob));
  urls.push(URL.createObjectURL(blob));
}
// The paired fixture uses known immutable snapshots; the real workflow benchmark
// separately covers URL decoding and cold entry without injecting image data.
if (backend === 'ecs')
  urls.forEach((url, i) => setFillLayerDecodedBitmapForUrl(url, bitmaps[i]));
let core: CoreCanvas | undefined,
  app: ECS.App | undefined,
  api: ECS.API | undefined;
const shapes = new Map<string, Rect>();
let ids: string[] = [];
let external: any,
  externalDestroyed = 0;
let disposed = false;
let baseline: ReturnType<typeof window.lifecycleProbes.resources> = [];
if (backend === 'core') {
  const create = WebGLDeviceContribution.prototype.createSwapChain;
  WebGLDeviceContribution.prototype.createSwapChain = async function (...args) {
    const swap = await create.apply(this, args);
    baseline = window.lifecycleProbes.resources();
    return swap;
  };
  try {
    core = await new CoreCanvas({
      canvas,
      devicePixelRatio: 1,
      checkboardStyle: CheckboardStyle.NONE,
      themeColors: { [Theme.LIGHT]: { background: '#ffffff' } },
    }).initialized;
  } finally {
    WebGLDeviceContribution.prototype.createSwapChain = create;
  }
} else {
  class Bootstrap extends ECS.System {
    access = this.query((q) => q.usingAll.write);
    initialize() {
      api = new ECS.API(
        new ECS.DefaultStateManagement(),
        new ECS.Commands(this),
      );
      api.createCanvas({
        element: canvas,
        width: 1000,
        height: 720,
        devicePixelRatio: 1,
      });
      api.createCamera({ zoom: 1 });
      api.setAppState({
        checkboardStyle: ECS.CheckboardStyle.NONE,
        theme: {
          mode: ECS.ThemeMode.LIGHT,
          colors: { light: { background: '#ffffff' } },
        },
      });
    }
  }
  app = new ECS.App({ maxEntities: 16384 }).addPlugins(
    ...ECS.DefaultPlugins,
    () => {
      ECS.system(ECS.PreStartUp)(Bootstrap);
      ECS.system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
    },
  );
  await app.run();
  await new Promise<void>((resolve, reject) => {
    const end = performance.now() + 15000;
    const poll = () => {
      if (api!.getCanvas().has(ECS.GPUResource)) resolve();
      else if (performance.now() > end)
        reject(new Error('GPU startup timeout'));
      else api!.runAtNextTick(poll);
    };
    api!.runAtNextTick(poll);
  });
}
async function settle() {
  if (core) core.render();
  else await settleECSFrames(api!, 3);
}
function state() {
  return {
    backend,
    count: ids.length,
    visible: core
      ? [...shapes.values()].filter((s) => !s.culled).length
      : api!
          .getNodes()
          .filter(
            (n) => ids.includes(n.id) && !api!.getEntity(n).has(ECS.Culled),
          ).length,
    resources: window.lifecycleProbes.resources(),
    allocatedBufferBytes: probe.allocatedBufferBytes(),
    webglError: probe.webglError(),
  };
}
async function configure(count = 12, batchable = false) {
  if (core) {
    for (const s of shapes.values()) core.removeChild(s);
    shapes.clear();
  } else if (ids.length)
    await api!.edit((e) => e.deleteNodesById(ids), { capture: 'NEVER' });
  ids = Array.from({ length: count }, (_, i) => `image-${i}`);
  for (let start = 0; start < count; start += 128) {
    const nodes = ids.slice(start, start + 128).map((id, j) => {
      const i = start + j;
      return {
        id,
        type: 'rect' as const,
        x: 8 + (i % 38) * 26,
        y: 8 + Math.floor(i / 38) * 26,
        width: 24,
        height: 22,
        zIndex: i,
        fills: [{ type: 'image' as const, value: urls[i % 2] }],
      };
    });
    if (core)
      for (const [j, n] of nodes.entries()) {
        const s = new Rect({
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          fill: bitmaps[(start + j) % 2],
          stroke: 'none',
          batchable,
        });
        shapes.set(n.id, s);
        core.appendChild(s);
      }
    else
      await api!.edit(
        (e) => {
          e.updateNodes(nodes);
          if (batchable)
            for (const node of nodes)
              e.getEntity(node).write(ECS.Renderable).batchable = true;
        },
        { capture: 'NEVER' },
      );
  }
  await settle();
  return state();
}
export type ImagePatch = {
  image?: number | 'mutable' | 'external';
  width?: number;
  opacity?: number;
  objectFit?: 'fill' | 'contain' | 'cover';
  filter?: string;
};
async function edit(index: number, patch: ImagePatch) {
  const id = ids[index];
  if (!id) throw new Error('missing image');
  if (core) {
    const s = shapes.get(id)!;
    if (patch.image === 'external') s.fill = { texture: external };
    else if (patch.image === 'mutable') s.fill = sources[0];
    else if (typeof patch.image === 'number') s.fill = bitmaps[patch.image];
    if (patch.width !== undefined) s.width = patch.width;
    if (patch.opacity !== undefined) s.opacity = patch.opacity;
  } else
    await api!.edit((e) => {
      const node = e.getNodeById(id);
      const update: Record<string, unknown> = {};
      if (typeof patch.image === 'number')
        update.fills = [{ type: 'image', value: urls[patch.image] }];
      if (patch.image === 'external') update.fills = [];
      if (patch.width !== undefined) update.width = patch.width;
      if (patch.opacity !== undefined) update.opacity = patch.opacity;
      if (patch.filter !== undefined) update.filter = patch.filter;
      if (patch.objectFit)
        update.fills = [
          {
            ...(node as ECS.RectSerializedNode).fills[0],
            objectFit: patch.objectFit,
          },
        ];
      e.updateNode(node, update);
      if (patch.image === 'external')
        e.getEntity(node).add(ECS.FillTexture, { value: external });
    });
  await settle();
  return state();
}
async function remove(index: number) {
  const id = ids[index];
  if (core) {
    core.removeChild(shapes.get(id)!);
    shapes.delete(id);
  } else await api!.edit((e) => e.deleteNodesById([id]));
  ids = ids.filter((x) => x !== id);
  await settle();
  return state();
}
async function view(x: number, zoom = 1) {
  if (core) {
    core.camera.x = x;
    core.camera.zoom = zoom;
  } else
    await api!.edit((e) => e.setAppState({ cameraX: x, cameraZoom: zoom }), {
      capture: 'NEVER',
    });
  await settle();
  return state();
}
async function raster(partial = false) {
  if (core) return core.toDataURL({ grid: false });
  const owner = api!.getCanvas();
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('export timeout')), 15000);
    const poll = () => {
      if (owner.has(ECS.Screenshot)) {
        clearTimeout(timer);
        resolve(owner.read(ECS.Screenshot).dataURL);
      } else api!.runAtNextTick(poll);
    };
    api!.runAtNextTick(() => {
      if (owner.has(ECS.Screenshot)) owner.remove(ECS.Screenshot);
      api!.export({
        format: ECS.ExportFormat.PNG,
        download: false,
        nodes: partial ? [api!.getNodeById(ids[1])] : [],
      });
      poll();
    });
  });
}
async function measure(samples = 30, warmup = 15) {
  const times: number[] = [];
  const native: ReturnType<typeof probe.snapshot>[] = [];
  if (core) {
    for (let i = 0; i < samples + warmup; i++) {
      await new Promise(requestAnimationFrame);
      probe.reset();
      const start = performance.now();
      core.camera.x = i % 2 ? 0.25 : 0;
      core.render();
      times.push(performance.now() - start);
      native.push(probe.snapshot());
    }
  } else {
    const execute = app!.world.execute;
    let pending: Promise<void> | undefined;
    app!.world.execute = (...args: Parameters<typeof execute>) => {
      pending = (async () => {
        probe.reset();
        const start = performance.now();
        await execute.apply(app!.world, args);
        times.push(performance.now() - start);
        native.push(probe.snapshot());
      })();
      return pending;
    };
    try {
      for (let i = 0; i < samples + warmup; i++)
        await api!.edit((e) => e.setAppState({ cameraX: i % 2 ? 0.25 : 0 }), {
          capture: 'NEVER',
        });
    } finally {
      app!.world.execute = execute;
      await pending;
    }
  }
  return {
    samples: times.slice(warmup),
    native: native.slice(warmup),
    state: state(),
  };
}
async function makeExternal() {
  const device =
    core?.getDevice() ?? api!.getCanvas().read(ECS.GPUResource).device;
  external = device.createTexture({
    format: core ? CoreFormat.U8_RGBA_NORM : Format.U8_RGBA_NORM,
    width: 64,
    height: 48,
    usage: core ? CoreUsage.SAMPLED : TextureUsage.SAMPLED,
  } as any);
  external.setImageData([bitmaps[1]]);
  const destroy = external.destroy.bind(external);
  external.destroy = () => {
    externalDestroyed++;
    destroy();
  };
}
async function dispose() {
  if (disposed) return;
  disposed = true;
  if (core) core.destroy();
  else await app!.exit();
  const borrowedDestroyed = externalDestroyed;
  if (external) external.destroy();
  probe.dispose();
  restore.forEach((f) => f());
  bitmaps.forEach((b) => b.close());
  urls.forEach((u) => URL.revokeObjectURL(u));
  return {
    borrowedDestroyed,
    baseline,
    remaining: window.lifecycleProbes.resources(),
    restored:
      CorePool.prototype.acquire === originalAcquires[0] &&
      ECSPool.prototype.acquire === originalAcquires[1] &&
      canvas.getContext === originalContext,
  };
}
const harness = {
  configure,
  edit,
  remove,
  view,
  state,
  raster,
  // Read live pixels separately from renderer export. Core does not preserve
  // its drawing buffer: request an unchanged camera projection and capture in
  // the same task as render, without marking material/instance rows dirty.
  async screen() {
    if (core) {
      core.camera.projection(core.camera.width, core.camera.height);
      core.render();
      return canvas.toDataURL();
    }
    await settle();
    return canvas.toDataURL();
  },
  measure,
  makeExternal,
  dispose,
  pick: (x: number, y: number) =>
    core
      ? core
          .elementsFromPoint(x, y)
          .map((s) => [...shapes].find(([, v]) => v === s)?.[0])
          .filter(Boolean)
      : api!
          .elementsFromPoint({ x, y })
          .map((entity) => api!.getNodeByEntity(entity)?.id),
  async history(action: 'undo' | 'redo') {
    if (api) {
      api[action]();
      await settle();
    }
    return state();
  },
  async mutate() {
    const ctx = sources[0].getContext('2d')!;
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 64, 48);
    if (core) {
      for (const s of shapes.values())
        if (s.fill === sources[0])
          s.materialDirtyFlag = s.renderDirtyFlag = true;
    }
    await settle();
  },
  document: () =>
    core
      ? [...shapes].map(([id, s]) => ({
          id,
          x: s.x,
          y: s.y,
          width: s.width,
          opacity: s.opacity,
        }))
      : api!
          .getNodes()
          .filter((n) => ids.includes(n.id))
          .map((n) => ({
            id: n.id,
            x: n.x,
            y: n.y,
            width: n.width,
            opacity: (n as ECS.RectSerializedNode).opacity ?? 1,
          })),
};
window.imageSharing = harness;
document.querySelector('#status')!.textContent = 'Ready';
declare global {
  interface Window {
    imageSharing: typeof harness;
  }
}
