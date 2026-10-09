import { load } from '@loaders.gl/core';
import {
  ComputeBounds,
  ComputeCamera,
  EnsureMesh3DNodes,
  LoadMesh3DGeometry,
  SyncMesh3DNodes,
  PostUpdate,
  Mesh3DNode,
  Mesh3D,
  Material3D,
  system,
  type API,
  type Mesh3DNodeSerializedNode,
} from '../../packages/ecs/src';
import { clearGltfMeshCache } from '../../packages/ecs/src/utils/gltf/load-gltf-mesh';
import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';
import { createDocumentWorld } from '../helpers/ecs-document';
import { deferred, gltfScenes } from '../helpers/gltf';

jest.mock('@loaders.gl/core', () => ({ load: jest.fn() }));
const fetchModel = load as jest.MockedFunction<typeof load>;
const url = 'https://models.example/model.gltf';
const node = (
  patch: Partial<Mesh3DNodeSerializedNode> = {},
): Mesh3DNodeSerializedNode => ({
  id: 'model',
  type: 'mesh3d',
  zIndex: 0,
  x: 0,
  y: 0,
  width: 40,
  height: 40,
  geometry: { type: 'gltf', url },
  ...patch,
});
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let second: API;
beforeAll(async () => {
  world = await createDocumentWorld(2, false, [
    () => {
      system(PostUpdate)(EnsureMesh3DNodes);
      system((s) => s.after(ComputeBounds).before(ComputeCamera))(
        EnsureMesh3DNodes,
      );
      system(PostUpdate)(LoadMesh3DGeometry);
      system((s) => s.after(EnsureMesh3DNodes).before(ComputeCamera))(
        LoadMesh3DGeometry,
      );
      system(PostUpdate)(SyncMesh3DNodes);
      system((s) => s.after(LoadMesh3DGeometry).before(ComputeCamera))(
        SyncMesh3DNodes,
      );
    },
  ]);
  [api, second] = world.apis;
});
afterAll(async () => world?.dispose());
beforeEach(async () => {
  await world.reset(api, []);
  await world.reset(second, []);
  await world.frame();
  clearGltfMeshCache();
  fetchModel.mockReset();
});
afterEach(() => jest.restoreAllMocks());
const settle = async () => {
  // Advance actual ECS stages; async loads are controlled by the test, never timers.
  await world.frame();
  await world.frame();
  await world.frame();
};
const wire = (editor = api) =>
  editor.getNodeById('model') as Mesh3DNodeSerializedNode;
const source = (editor = api) => editor.getEntity(editor.getNodeById('model'));
const companion = (editor = api) => source(editor).read(Mesh3DNode).meshEntity!;
const geometry = (editor = api) =>
  Array.from(companion(editor).read(Mesh3D).positions);
const edit = async (patch: Partial<Mesh3DNodeSerializedNode>) => {
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('model'), patch),
  );
  await settle();
};

it('deduplicates pending frames, applies on an ECS frame and retains imported material during sync', async () => {
  const request = deferred<GltfContainer>();
  fetchModel.mockReturnValueOnce(request.promise);
  await world.reset(api, [node()]);
  await settle();
  expect(fetchModel).toHaveBeenCalledTimes(1);
  expect(geometry()).toEqual([]);
  request.resolve(gltfScenes());
  await request.promise;
  expect(geometry()).toEqual([]);
  await settle();
  expect(geometry()).toHaveLength(9);
  expect(companion().read(Material3D).baseColor).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  const document = structuredClone(wire());
  await edit({ x: 20 });
  expect(companion().read(Material3D).baseColor).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  expect(wire().material3d).toEqual(document.material3d);
  expect(fetchModel).toHaveBeenCalledTimes(1);
});

it('preserves custom material and restores glTF defaults when overrides are cleared', async () => {
  fetchModel.mockResolvedValue(gltfScenes());
  await world.reset(api, [
    node({ material3d: { baseColor: '#ff0000', map: 'custom.png' } }),
  ]);
  await settle();
  expect(companion().read(Material3D).baseColor).toEqual([1, 0, 0, 1]);
  expect(companion().read(Material3D).map).toBe('custom.png');
  await edit({ material3d: undefined });
  expect(companion().read(Material3D).baseColor).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
});

it('keeps identical node IDs in two canvases independent while sharing network work', async () => {
  const request = deferred<GltfContainer>();
  fetchModel.mockReturnValueOnce(request.promise);
  await world.reset(api, [node()]);
  await world.reset(second, [node({ material3d: { baseColor: '#0000ff' } })]);
  await settle();
  expect(fetchModel).toHaveBeenCalledTimes(1);
  request.resolve(gltfScenes());
  await settle();
  expect(geometry()).toHaveLength(9);
  expect(geometry(second)).toEqual(geometry());
  expect(companion(second)).not.toBe(companion());
  expect(companion(second).read(Material3D).baseColor).toEqual([0, 0, 1, 1]);
});

it.each(['resolve', 'reject'])(
  'ignores an old model that %ss after a different model is loaded',
  async (outcome) => {
    const old = deferred<GltfContainer>();
    fetchModel.mockReturnValueOnce(old.promise).mockResolvedValue(gltfScenes());
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await world.reset(api, [node()]);
    await settle();
    await edit({
      geometry: {
        type: 'gltf',
        url: 'https://models.example/new.gltf',
        mesh: 0,
      },
    });
    const loaded = geometry();
    expect(loaded).toHaveLength(9);
    if (outcome === 'resolve')
      old.resolve({
        ...gltfScenes(),
        json: { accessors: [], bufferViews: [] },
      });
    else old.reject(new Error('old model unavailable'));
    await settle();
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('model'), { scale3d: 75 }),
    );
    expect(geometry()).toEqual(loaded);
    expect(fetchModel).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledTimes(outcome === 'reject' ? 1 : 0);
  },
);

it('does not apply an in-flight result after switching to a primitive', async () => {
  const request = deferred<GltfContainer>();
  fetchModel.mockReturnValueOnce(request.promise);
  await world.reset(api, [node()]);
  await settle();
  await edit({ geometry: 'cube' });
  const cube = geometry();
  request.resolve(gltfScenes());
  await settle();
  expect(geometry()).toEqual(cube);
  expect(companion().read(Material3D).map).toBeNull();
  expect(companion().read(Material3D).baseColor).toEqual([1, 1, 1, 1]);
});

it.each(['resolve', 'reject'])(
  'discards a late %s after deletion without affecting a recreated node with the same ID',
  async (outcome) => {
    const request = deferred<GltfContainer>();
    fetchModel.mockReturnValueOnce(request.promise);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await world.reset(api, [node()]);
    await settle();
    await world.reset(api, []);
    await settle();
    await world.reset(api, [node({ geometry: 'cube' })]);
    await settle();
    const cube = geometry();
    if (outcome === 'resolve') request.resolve(gltfScenes());
    else request.reject(new Error('deleted model unavailable'));
    await settle();
    expect(geometry()).toEqual(cube);
    expect(companion().read(Material3D).map).toBeNull();
    expect(warning).toHaveBeenCalledTimes(outcome === 'reject' ? 1 : 0);
  },
);

it('recovers on a subsequent frame after a transient download error', async () => {
  let now = 10000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const error = new Error('offline');
  fetchModel.mockRejectedValueOnce(error).mockResolvedValue(gltfScenes());
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await world.reset(api, [node()]);
  await settle();
  expect(geometry()).toEqual([]);
  expect(fetchModel).toHaveBeenCalledTimes(1);
  now += 1000;
  await settle();
  expect(geometry()).toHaveLength(9);
  expect(fetchModel).toHaveBeenCalledTimes(2);
  expect(warning).toHaveBeenCalledWith(
    '[requestGltfMeshLoad] failed to load glTF',
    url,
    error,
  );
});

it('keeps downloaded defaults across undo/redo and document reload without serializing them', async () => {
  fetchModel.mockResolvedValue(gltfScenes());
  await world.reset(api, [node()]);
  await settle();
  api.clearHistory();
  await edit({ material3d: { baseColor: '#00ff00', map: 'override.png' } });
  await world.history(api, 'undo');
  await settle();
  expect(companion().read(Material3D).baseColor).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  expect(wire().material3d).toBeUndefined();
  await world.history(api, 'redo');
  await settle();
  expect(companion().read(Material3D).baseColor).toEqual([0, 1, 0, 1]);
  expect(companion().read(Material3D).map).toBe('override.png');
  await world.reset(second, structuredClone(api.getNodes()));
  await settle();
  expect(companion(second).read(Material3D).baseColor).toEqual([0, 1, 0, 1]);
  expect(companion(second).read(Material3D).map).toBe('override.png');
  expect(fetchModel).toHaveBeenCalledTimes(1);
});

it('drops imported material when a loaded model is replaced by a primitive or another model', async () => {
  fetchModel.mockResolvedValue(gltfScenes());
  await world.reset(api, [node()]);
  await settle();
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  await edit({ geometry: 'cube' });
  expect(companion().read(Material3D).baseColor).toEqual([1, 1, 1, 1]);
  expect(companion().read(Material3D).map).toBeNull();
  const other = gltfScenes();
  Object.assign(other.json, { scenes: [{ nodes: [1] }] });
  fetchModel.mockResolvedValueOnce(other);
  await edit({
    geometry: { type: 'gltf', url: 'https://models.example/other.gltf' },
  });
  expect(companion().read(Material3D).baseColor).toEqual([0.8, 0.6, 0.4, 1]);
  expect(companion().read(Material3D).map).toBeNull();
});

it('backs off repeated failures instead of starting one download per frame', async () => {
  let now = 10000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  fetchModel.mockRejectedValue(new Error('server unavailable'));
  await world.reset(api, [node()]);
  await settle();
  let attempts = 1;
  expect(fetchModel).toHaveBeenCalledTimes(attempts);
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    now += delay - 1;
    await settle();
    expect(fetchModel).toHaveBeenCalledTimes(attempts);
    now++;
    await settle();
    expect(fetchModel).toHaveBeenCalledTimes(++attempts);
  }
  expect(warning).toHaveBeenCalledTimes(attempts);
  // A replacement model is not delayed by the previous URL's backoff.
  fetchModel.mockResolvedValueOnce(gltfScenes());
  await edit({
    geometry: { type: 'gltf', url: 'https://models.example/available.gltf' },
  });
  expect(geometry()).toHaveLength(9);
  expect(fetchModel).toHaveBeenCalledTimes(attempts + 1);
});
