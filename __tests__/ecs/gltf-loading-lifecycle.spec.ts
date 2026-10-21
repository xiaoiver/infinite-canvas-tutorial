import { load } from '@loaders.gl/core';
import { mat4 } from 'gl-matrix';
import {
  Camera3D,
  ComputeBounds,
  ComputeCamera,
  EnsureMesh3DNodes,
  LoadMesh3DGeometry,
  SyncMesh3DNodes,
  PostUpdate,
  Mesh3DNode,
  Mesh3D,
  Transform3D,
  Material3D,
  ExportFormat,
  system,
  type API,
  type Mesh3DNodeSerializedNode,
} from '../../packages/ecs/src';
import { clearGltfMeshCache } from '../../packages/ecs/src/utils/gltf/load-gltf-mesh';
import { getMesh3DNodeParts } from '../../packages/ecs/src/utils/mesh3d-node';
import { probePick3DAtViewport } from '../../packages/ecs/src/utils/pick3d-probe';
import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';
import { createDocumentWorld } from '../helpers/ecs-document';
import { deferred, gltfScenes } from '../helpers/gltf';

jest.mock('@loaders.gl/core', () => ({ load: jest.fn() }));
const fetchModel = load as jest.MockedFunction<typeof load>;
const url = 'https://models.example/model.gltf';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
const importedPrimaryColor = [
  expect.closeTo(0.4845292, 6),
  expect.closeTo(0.6651851, 6),
  expect.closeTo(0.7977377, 6),
  0.8,
];
const importedSecondaryColor = [
  expect.closeTo(0.9063318, 6),
  expect.closeTo(0.7977377, 6),
  expect.closeTo(0.6651851, 6),
  1,
];
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
  expect(companion().read(Material3D).baseColor).toEqual(importedPrimaryColor);
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  expect(companion().read(Material3D).alphaMode).toBe('opaque');
  expect(companion().read(Material3D).metallic).toBe(1);
  expect(companion().read(Material3D).roughness).toBe(1);
  const document = structuredClone(wire());
  await edit({ x: 20 });
  expect(companion().read(Material3D).baseColor).toEqual(importedPrimaryColor);
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  expect(wire().material3d).toEqual(document.material3d);
  expect(fetchModel).toHaveBeenCalledTimes(1);
});

it('keeps imported UV1 and restores texture coordinates after node overrides', async () => {
  const model = gltfScenes();
  const uv1 = new Float32Array([0, 0, 1, 0, 0, 1]);
  const json = model.json as unknown as {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
    meshes: { primitives: { attributes: { TEXCOORD_1?: number } }[] }[];
    materials: {
      emissiveFactor?: number[];
      extensions?: {
        KHR_materials_emissive_strength: { emissiveStrength: number };
        KHR_materials_unlit?: Record<string, never>;
      };
      emissiveTexture?: { index: number };
      pbrMetallicRoughness: {
        baseColorTexture: {
          texCoord?: number;
          extensions?: { KHR_texture_transform: Record<string, unknown> };
        };
      };
    }[];
  };
  json.bufferViews.push({
    buffer: model.buffers.length,
    byteLength: uv1.byteLength,
  });
  json.accessors.push({
    bufferView: json.bufferViews.length - 1,
    componentType: 5126,
    count: 3,
    type: 'VEC2',
  });
  model.buffers.push({ arrayBuffer: uv1.buffer });
  json.meshes[0].primitives[0].attributes.TEXCOORD_1 =
    json.accessors.length - 1;
  json.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = 1;
  json.materials[0].emissiveFactor = [0.2, 0.4, 0.6];
  json.materials[0].extensions = {
    KHR_materials_emissive_strength: { emissiveStrength: 3 },
    KHR_materials_unlit: {},
  };
  json.materials[0].emissiveTexture = { index: 0 };
  json.materials[0].pbrMetallicRoughness.baseColorTexture.extensions = {
    KHR_texture_transform: { offset: [0.25, 0.5], rotation: 0.5 },
  };
  fetchModel.mockResolvedValue(model);
  await world.reset(api, [node()]);
  await settle();
  expect(companion().read(Mesh3D).uvs1).toEqual(uv1);
  expect(companion().read(Material3D).mapTexCoord).toBe(1);
  expect(companion().read(Material3D).emissiveFactor).toEqual([0.2, 0.4, 0.6]);
  expect(companion().read(Material3D).emissiveStrength).toBe(3);
  expect(companion().read(Material3D).unlit).toBe(true);
  expect(companion().read(Material3D).emissiveMap).toBe(
    'https://models.example/albedo.png',
  );
  expect(companion().read(Material3D).mapTextureTransform).toEqual({
    offset: [0.25, 0.5],
    scale: [1, 1],
    rotation: 0.5,
  });
  await edit({ material3d: { map: 'custom.png' } });
  expect(companion().read(Material3D).mapTexCoord).toBe(0);
  expect(companion().read(Material3D).mapTextureTransform).toBeNull();
  await edit({ material3d: { mapTexCoord: 0 } });
  expect(companion().read(Material3D).mapTexCoord).toBe(0);
  await edit({ material3d: undefined });
  expect(companion().read(Material3D).mapTexCoord).toBe(1);
  expect(companion().read(Material3D).mapTextureTransform?.offset).toEqual([
    0.25, 0.5,
  ]);
  await edit({ material3d: { mapTextureTransform: null } });
  expect(companion().read(Material3D).mapTextureTransform).toBeNull();
  await edit({
    material3d: {
      emissiveFactor: [0, 0, 0],
      emissiveStrength: 0,
      unlit: false,
      emissiveMap: null,
    },
  });
  expect(companion().read(Material3D).emissiveFactor).toEqual([0, 0, 0]);
  expect(companion().read(Material3D).emissiveStrength).toBe(0);
  expect(companion().read(Material3D).unlit).toBe(false);
  expect(companion().read(Material3D).emissiveMap).toBeNull();
  await edit({ material3d: undefined });
  expect(companion().read(Material3D).emissiveFactor).toEqual([0.2, 0.4, 0.6]);
  expect(companion().read(Material3D).emissiveStrength).toBe(3);
  expect(companion().read(Material3D).unlit).toBe(true);
});

it('exports a loaded glTF texture through the asynchronous GLB API', async () => {
  const model = gltfScenes();
  (model.json as unknown as { images: { uri: string }[] }).images[0].uri = png;
  fetchModel.mockResolvedValue(model);
  await world.reset(api, [node()]);
  await settle();
  const glb = await api.exportGlb({ download: false });
  const jsonLength = new DataView(glb.buffer, glb.byteOffset).getUint32(
    12,
    true,
  );
  const exported = JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)),
  );
  expect(exported.images).toHaveLength(1);
  expect(exported.materials[0].pbrMetallicRoughness.baseColorTexture).toEqual({
    index: 0,
  });
});

it.each(['MASK', 'BLEND'] as const)(
  'inherits glTF %s alpha until a document override is authored',
  async (mode) => {
    const model = gltfScenes();
    const materials = (
      model.json as unknown as {
        materials: { alphaMode?: string; alphaCutoff?: number }[];
      }
    ).materials;
    materials[0].alphaMode = mode;
    materials[0].alphaCutoff = 0.35;
    fetchModel.mockResolvedValue(model);
    await world.reset(api, [node()]);
    await settle();
    expect(companion().read(Material3D).alphaMode).toBe(mode.toLowerCase());
    expect(companion().read(Material3D).alphaCutoff).toBeCloseTo(0.35);
    expect(wire().material3d).toBeUndefined();
    const glb = api.export({
      format: ExportFormat.GLB,
      download: false,
    }) as Uint8Array;
    const jsonLength = new DataView(glb.buffer, glb.byteOffset).getUint32(
      12,
      true,
    );
    const exported = JSON.parse(
      new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)),
    );
    expect(exported.materials[0].alphaMode).toBe(mode);
    if (mode === 'MASK')
      expect(exported.materials[0].alphaCutoff).toBeCloseTo(0.35);

    await edit({ material3d: { alphaMode: 'opaque' } });
    expect(companion().read(Material3D).alphaMode).toBe('opaque');
    expect(companion().read(Material3D).alphaCutoff).toBeCloseTo(0.35);

    await edit({ material3d: { alphaCutoff: 0.8 } });
    expect(companion().read(Material3D).alphaMode).toBe(mode.toLowerCase());
    expect(companion().read(Material3D).alphaCutoff).toBeCloseTo(0.8);

    await edit({ material3d: undefined });
    expect(companion().read(Material3D).alphaMode).toBe(mode.toLowerCase());
    expect(companion().read(Material3D).alphaCutoff).toBeCloseTo(0.35);
    await edit({ geometry: 'cube' });
    expect(companion().read(Material3D).alphaMode).toBe('opaque');
    expect(companion().read(Material3D).alphaCutoff).toBeCloseTo(0.5);
  },
);

it('keeps each glTF primitive material and alpha mode on a selectable part', async () => {
  const model = gltfScenes();
  const json = model.json as unknown as {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
    meshes: {
      primitives: {
        attributes: { POSITION: number };
        material: number;
        indices?: number;
      }[];
    }[];
    materials: {
      alphaMode?: string;
      pbrMetallicRoughness: {
        baseColorFactor: number[];
        metallicFactor?: number;
        roughnessFactor?: number;
        metallicRoughnessTexture?: { index: number };
      };
    }[];
    images: { uri: string }[];
    textures: { source: number }[];
  };
  json.materials[0].alphaMode = 'MASK';
  json.materials[0].pbrMetallicRoughness.baseColorFactor[0] = 1;
  json.materials[0].pbrMetallicRoughness.metallicFactor = 0.8;
  json.materials[0].pbrMetallicRoughness.roughnessFactor = 0.2;
  json.materials[1].alphaMode = 'BLEND';
  json.materials[1].pbrMetallicRoughness.metallicFactor = 0.3;
  json.materials[1].pbrMetallicRoughness.roughnessFactor = 0.6;
  json.images.push({ uri: 'primary-pbr.png' }, { uri: 'part-pbr.png' });
  json.textures.push({ source: 1 }, { source: 2 });
  json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture = {
    index: 1,
  };
  json.materials[1].pbrMetallicRoughness.metallicRoughnessTexture = {
    index: 2,
  };
  const indices = new Uint8Array([0, 1, 2]);
  json.bufferViews.push({
    buffer: model.buffers.length,
    byteLength: indices.byteLength,
  });
  json.accessors.push({
    bufferView: json.bufferViews.length - 1,
    componentType: 5121,
    count: 3,
    type: 'SCALAR',
  });
  model.buffers.push({ arrayBuffer: indices.buffer });
  json.meshes[0].primitives[0].indices = json.accessors.length - 1;
  json.meshes[0].primitives.push({ attributes: { POSITION: 0 }, material: 1 });
  fetchModel.mockResolvedValue(model);
  await world.reset(api, [node()]);
  await settle();
  expect(companion().read(Material3D).baseColor).toEqual([
    1,
    ...importedPrimaryColor.slice(1),
  ]);
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  expect(companion().read(Material3D).alphaMode).toBe('mask');
  expect(companion().read(Material3D).metallic).toBeCloseTo(0.8);
  expect(companion().read(Material3D).roughness).toBeCloseTo(0.2);
  expect(companion().read(Material3D).metallicRoughnessMap).toBe(
    'https://models.example/primary-pbr.png',
  );
  const [part] = getMesh3DNodeParts(source());
  expect(part.read(Material3D).baseColor).toEqual(importedSecondaryColor);
  expect(part.read(Material3D).alphaMode).toBe('blend');
  expect(part.read(Material3D).metallic).toBeCloseTo(0.3);
  expect(part.read(Material3D).roughness).toBeCloseTo(0.6);
  expect(part.read(Material3D).metallicRoughnessMap).toBe(
    'https://models.example/part-pbr.png',
  );
  expect(part.read(Mesh3D).positions).toEqual(
    companion().read(Mesh3D).positions,
  );
  const vertices = part.read(Mesh3D).positions;
  const pose = part.read(Transform3D);
  const centroidX =
    pose.translation[0] +
    ((vertices[0] + vertices[3] + vertices[6]) / 3) * pose.scale[0];
  const centroidY =
    pose.translation[1] +
    ((vertices[1] + vertices[4] + vertices[7]) / 3) * pose.scale[1];
  const projection = mat4.ortho(mat4.create(), 0, 200, 200, 0, -100, 100);
  const hit = probePick3DAtViewport(
    centroidX,
    centroidY,
    200,
    200,
    new Camera3D({ linked: false }),
    { mode: 'standard', projMatrix: projection, viewMatrix: mat4.create() },
    [part],
    [],
  );
  expect(hit.kind).toBe('mesh');
  if (hit.kind === 'mesh') expect(hit.entity.isSame(companion())).toBe(true);
  await edit({ material3d: { alphaMode: 'opaque' } });
  expect(companion().read(Material3D).alphaMode).toBe('opaque');
  expect(part.read(Material3D).alphaMode).toBe('opaque');
  await edit({ material3d: undefined });
  expect(part.read(Material3D).alphaMode).toBe('blend');
  await edit({ material3d: { metallic: 0, roughness: 1 } });
  expect(companion().read(Material3D).metallic).toBe(0);
  expect(part.read(Material3D).metallic).toBe(0);
  expect(companion().read(Material3D).roughness).toBe(1);
  expect(part.read(Material3D).roughness).toBe(1);
  await edit({ material3d: undefined });
  expect(companion().read(Material3D).metallic).toBeCloseTo(0.8);
  expect(part.read(Material3D).roughness).toBeCloseTo(0.6);
  await edit({ material3d: { metallicRoughnessMap: null } });
  expect(companion().read(Material3D).metallicRoughnessMap).toBeNull();
  expect(part.read(Material3D).metallicRoughnessMap).toBeNull();
  await edit({ material3d: undefined });
  expect(companion().read(Material3D).metallicRoughnessMap).toBe(
    'https://models.example/primary-pbr.png',
  );
  expect(part.read(Material3D).metallicRoughnessMap).toBe(
    'https://models.example/part-pbr.png',
  );
  await edit({ material3d: { baseColor: '#ffffff', map: null } });
  expect(companion().read(Material3D).baseColor).toEqual([1, 1, 1, 1]);
  expect(part.read(Material3D).baseColor).toEqual([1, 1, 1, 1]);
  expect(companion().read(Material3D).map).toBeNull();
  await edit({ material3d: undefined });
  expect(companion().read(Material3D).map).toBe(
    'https://models.example/albedo.png',
  );
  const glb = api.export({ format: ExportFormat.GLB, download: false });
  const jsonLength = new DataView(glb.buffer, glb.byteOffset).getUint32(
    12,
    true,
  );
  const exported = JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)),
  );
  expect(exported.meshes).toHaveLength(2);
  expect(
    exported.materials.map(
      (material: { alphaMode?: string }) => material.alphaMode,
    ),
  ).toEqual(['MASK', 'BLEND']);
  expect(
    exported.materials.map(
      (material: {
        pbrMetallicRoughness: {
          metallicFactor: number;
          roughnessFactor: number;
        };
      }) => [
        Number(material.pbrMetallicRoughness.metallicFactor.toFixed(2)),
        Number(material.pbrMetallicRoughness.roughnessFactor.toFixed(2)),
      ],
    ),
  ).toEqual([
    [0.8, 0.2],
    [0.3, 0.6],
  ]);
  await edit({ geometry: 'cube' });
  expect(getMesh3DNodeParts(source())).toHaveLength(0);
  expect(companion().read(Mesh3D).positions.length).toBeGreaterThan(0);
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
  expect(companion().read(Material3D).baseColor).toEqual(importedPrimaryColor);
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
  expect(companion().read(Material3D).baseColor).toEqual(importedPrimaryColor);
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
  expect(companion().read(Material3D).baseColor).toEqual(
    importedSecondaryColor,
  );
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
