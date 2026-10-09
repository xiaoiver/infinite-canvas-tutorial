import { load } from '@loaders.gl/core';
import {
  clearGltfMeshCache,
  loadGltfMeshFromSpec,
  loadGltfMeshFromUrl,
} from '../../packages/ecs/src/utils/gltf/load-gltf-mesh';
import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';
import { deferred, gltfScenes } from '../helpers/gltf';

jest.mock('@loaders.gl/core', () => ({ load: jest.fn() }));
const fetchModel = load as jest.MockedFunction<typeof load>;
const url = 'https://models.example/scene/model.gltf';
beforeEach(() => {
  clearGltfMeshCache();
  fetchModel.mockReset();
  fetchModel.mockResolvedValue(gltfScenes());
});
afterEach(() => clearGltfMeshCache());

it('shares in-flight work and caches the real baked geometry and relative texture', async () => {
  const request = deferred<GltfContainer>();
  fetchModel.mockReturnValueOnce(request.promise);
  const a = loadGltfMeshFromUrl(url);
  const b = loadGltfMeshFromSpec({ type: 'gltf', url });
  expect(fetchModel).toHaveBeenCalledTimes(1);
  request.resolve(gltfScenes());
  const mesh = await a;
  expect(await b).toBe(mesh);
  expect(await loadGltfMeshFromUrl(url)).toBe(mesh);
  expect(fetchModel).toHaveBeenCalledTimes(1);
  expect(Array.from(mesh.positions)).toEqual([
    -0.5, -0.25, 0, 0.5, -0.25, 0, -0.5, 0.25, 0,
  ]);
  expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
  expect(mesh.baseColor).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(mesh.map).toBe('https://models.example/scene/albedo.png');
});

it('keeps scene selections separate while reusing the implicit first scene', async () => {
  const first = await loadGltfMeshFromUrl(url);
  const second = await loadGltfMeshFromUrl(url, { scene: 1 });
  expect(second.baseColor).toEqual([0.8, 0.6, 0.4, 1]);
  expect(second.positions).not.toEqual(first.positions);
  expect(await loadGltfMeshFromUrl(url, { scene: 0 })).toBe(first);
  expect(await loadGltfMeshFromUrl(url, { scene: 1 })).toBe(second);
  expect(fetchModel).toHaveBeenCalledTimes(2);
});

it('keeps explicit mesh selection separate from the whole scene', async () => {
  const all = await loadGltfMeshFromUrl(url);
  const missing = await loadGltfMeshFromSpec({ type: 'gltf', url, mesh: 1 });
  expect(missing.positions).toHaveLength(0);
  expect(all.positions).toHaveLength(9);
  expect(await loadGltfMeshFromUrl(url, { mesh: 1 })).toBe(missing);
  expect(fetchModel).toHaveBeenCalledTimes(2);
});

it.each(['fetch', 'bake'])(
  'allows retry after a %s failure for all waiting callers',
  async (phase) => {
    const error = new Error('temporarily unavailable');
    if (phase === 'fetch') fetchModel.mockRejectedValueOnce(error);
    else fetchModel.mockResolvedValueOnce({ ...gltfScenes(), buffers: [] });
    const results = await Promise.allSettled([
      loadGltfMeshFromUrl(url),
      loadGltfMeshFromUrl(url),
    ]);
    expect(results[0].status).toBe('rejected');
    expect(results[1]).toEqual(results[0]);
    expect(fetchModel).toHaveBeenCalledTimes(1);
    await expect(loadGltfMeshFromUrl(url)).resolves.toHaveProperty(
      'positions',
      expect.any(Float32Array),
    );
    expect(fetchModel).toHaveBeenCalledTimes(2);
  },
);

it('invalidates all variants of one URL without evicting other URLs', async () => {
  const otherUrl = `${url}?v=2`;
  const variants = [undefined, { scene: 1 }, { mesh: 0 }];
  const old = await Promise.all(
    variants.map((options) => loadGltfMeshFromUrl(url, options)),
  );
  const other = await loadGltfMeshFromUrl(otherUrl);
  clearGltfMeshCache(url);
  for (const [i, options] of variants.entries()) {
    expect(await loadGltfMeshFromUrl(url, options)).not.toBe(old[i]);
  }
  expect(await loadGltfMeshFromUrl(otherUrl)).toBe(other);
  expect(fetchModel).toHaveBeenCalledTimes(7);
  clearGltfMeshCache();
  expect(await loadGltfMeshFromUrl(otherUrl)).not.toBe(other);
});

it.each(['resolve', 'reject'])(
  'an invalidated request that later %ss cannot replace or evict a newer request',
  async (outcome) => {
    const old = deferred<GltfContainer>();
    const fresh = deferred<GltfContainer>();
    fetchModel
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    const before = Promise.allSettled([loadGltfMeshFromUrl(url)]);
    clearGltfMeshCache(url);
    const after = loadGltfMeshFromUrl(url);
    if (outcome === 'resolve') old.resolve(gltfScenes());
    else old.reject(new Error('old request failed'));
    await before;
    const shared = loadGltfMeshFromUrl(url);
    expect(fetchModel).toHaveBeenCalledTimes(2);
    fresh.resolve(gltfScenes());
    expect(await shared).toBe(await after);
    expect(await loadGltfMeshFromUrl(url)).toBe(await after);
  },
);
