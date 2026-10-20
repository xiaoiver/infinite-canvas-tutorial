import { load } from '@loaders.gl/core';
import {
  Canvas3DScope,
  DefaultRenderer3DPlugin,
  Pen,
  Material3D,
  Mesh3D,
  Mesh3DNode,
  Selected3D,
  Transform3D,
  ToBeDeleted,
  type API,
  type Entity,
  type Mesh3DNodeSerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';
import { getMesh3DNodeParts } from '../../packages/ecs/src/utils/mesh3d-node';
import { gltfScenes } from '../helpers/gltf';

jest.mock('@loaders.gl/core', () => ({ load: jest.fn() }));
const fetchModel = load as jest.MockedFunction<typeof load>;

const node = (id = 'model'): Mesh3DNodeSerializedNode => ({
  id,
  name: 'Cube',
  type: 'mesh3d',
  zIndex: 0,
  x: 60,
  y: 60,
  width: 40,
  height: 40,
  scale3d: 20,
});
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let other: API;
const mesh = (editor = api, id = 'model') =>
  editor.getEntity(editor.getNodeById(id)).read(Mesh3DNode).meshEntity!;
beforeAll(async () => {
  world = await createDocumentWorld(2, false, [DefaultRenderer3DPlugin]);
  [api, other] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
  for (const editor of world.apis) expect(editor.getMesh3DLayers()).toEqual([]);
});
beforeEach(async () => {
  fetchModel.mockReset();
  for (const editor of world.apis) await world.reset(editor, [node()]);
  await world.frame();
  await world.frame();
});
afterEach(() => jest.restoreAllMocks());

it('skips idle scans and selection hover writes, while keeping held layer entities selectable', async () => {
  const scan = jest.spyOn(api, 'getNodeByEntity');
  const publish = jest.spyOn(api, 'setMesh3DLayers');
  const selection = jest.spyOn(api, 'setSelectedMesh3DLayerIds');
  const layers = api.getMesh3DLayers();
  for (let i = 0; i < 5; i++) await world.frame();
  expect(scan).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
  expect(selection).not.toHaveBeenCalled();
  expect(api.getMesh3DLayers()).toBe(layers);
  await world.edit(
    api,
    () => {
      expect(api.getMesh3DLayerIdByEntity(mesh().hold())).toBe('model');
      expect(api.selectMesh3DLayerByEntity(mesh().hold())).toBe(true);
    },
    'NEVER',
  );
  expect(mesh().has(Selected3D)).toBe(true);
  expect(api.getSelectedMesh3DLayerIds()).toEqual(['model']);
  await world.frame();
  publish.mockClear();
  selection.mockClear();
  await world.edit(
    api,
    () => {
      mesh().write(Selected3D).activeAxis = 'x';
    },
    'NEVER',
  );
  expect(publish).not.toHaveBeenCalled();
  expect(selection).not.toHaveBeenCalled();
  await world.edit(
    api,
    () => {
      api.clearSelectedMesh3DLayers();
    },
    'NEVER',
  );
  expect(mesh().has(Selected3D)).toBe(false);
  expect(api.getSelectedMesh3DLayerIds()).toEqual([]);
  expect(other.getSelectedMesh3DLayerIds()).toEqual([]);
});

it('refreshes renamed layers through undo/redo and geometry vertex counts', async () => {
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('model'), { name: 'Renamed' }),
  );
  expect(api.getMesh3DLayers()[0].name).toBe('Renamed');
  expect(other.getMesh3DLayers()[0].name).toBe('Cube');
  await world.history(api, 'undo');
  expect(api.getMesh3DLayers()[0].name).toBe('Cube');
  await world.history(api, 'redo');
  expect(api.getMesh3DLayers()[0].name).toBe('Renamed');
  await world.edit(
    api,
    () => {
      mesh().write(Mesh3D).positions = new Float32Array(9);
    },
    'NEVER',
  );
  expect(api.getMesh3DLayers()[0].vertexCount).toBe(3);
  const changed = api.getMesh3DLayers();
  await world.frame();
  expect(api.getMesh3DLayers()).toBe(changed);
});

it('does not scan layers for runtime pose/material changes', async () => {
  const scan = jest.spyOn(api, 'setMesh3DLayers');
  await world.edit(
    api,
    () => {
      mesh().write(Transform3D).translation[0] += 10;
      mesh().write(Material3D).baseColor[0] = 0.5;
    },
    'NEVER',
  );
  expect(scan).not.toHaveBeenCalled();
});

it('lists a model with multiple material parts only once', async () => {
  const model = gltfScenes();
  const json = model.json as unknown as {
    meshes: {
      primitives: { attributes: { POSITION: number }; material: number }[];
    }[];
  };
  json.meshes[0].primitives.push({ attributes: { POSITION: 0 }, material: 1 });
  fetchModel.mockResolvedValue(model);
  await world.reset(api, [
    {
      ...node(),
      geometry: { type: 'gltf', url: 'https://models.example/model.gltf' },
    },
  ]);
  for (let i = 0; i < 4; i++) await world.frame();
  const source = api.getEntity(api.getNodeById('model'));
  const [extra] = getMesh3DNodeParts(source);
  expect(extra).toBeDefined();
  expect(api.getMesh3DLayers().map((layer) => layer.id)).toEqual(['model']);
  expect(api.getMesh3DLayers()[0].vertexCount).toBe(6);
  expect(api.getMesh3DLayerIdByEntity(mesh())).toBe('model');
  expect(api.getMesh3DLayerIdByEntity(extra)).toBeUndefined();
});

it('refreshes scope transfers without sharing selection between canvases', async () => {
  let runtime: Entity;
  await world.edit(
    api,
    (editor) => {
      const commands = editor.spawn3D(
        new Mesh3D({ positions: new Float32Array(9) }),
        new Transform3D(),
        new Material3D(),
        new Selected3D(),
      );
      editor.getCommands().execute();
      runtime = commands.id().hold();
    },
    'NEVER',
  );
  const id = `mesh3d:${runtime!.__id}`;
  expect(api.getMesh3DLayers().map((layer) => layer.id)).toContain(id);
  expect(api.getSelectedMesh3DLayerIds()).toEqual([id]);
  await world.edit(
    api,
    () => {
      runtime.write(Canvas3DScope).canvas = other.getCanvas();
    },
    'NEVER',
  );
  expect(api.getMesh3DLayers().map((layer) => layer.id)).not.toContain(id);
  expect(api.getSelectedMesh3DLayerIds()).toEqual([]);
  expect(other.getSelectedMesh3DLayerIds()).toEqual([id]);
  await world.edit(
    other,
    () => {
      runtime.delete();
    },
    'NEVER',
  );
  expect(other.getSelectedMesh3DLayerIds()).toEqual([]);
});

it('removes incomplete/pending-deletion meshes and refreshes while the hand tool is active', async () => {
  let runtime: Entity;
  await world.edit(
    api,
    (editor) => {
      const commands = editor.spawn3D(
        new Mesh3D({ positions: new Float32Array(9) }),
        new Transform3D(),
        new Material3D(),
      );
      editor.getCommands().execute();
      runtime = commands.id().hold();
    },
    'NEVER',
  );
  const id = `mesh3d:${runtime!.__id}`;
  const material = new Material3D();
  await world.edit(
    api,
    () => {
      runtime.remove(Material3D);
    },
    'NEVER',
  );
  expect(api.getMesh3DLayers()).toHaveLength(1);
  await world.edit(
    api,
    () => {
      runtime.add(Material3D, material);
    },
    'NEVER',
  );
  expect(api.getMesh3DLayers()).toHaveLength(2);
  await world.edit(
    api,
    () => {
      api.setAppState({ penbarSelected: Pen.HAND });
    },
    'NEVER',
  );
  try {
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('model'), { name: 'Hand tool' }),
    );
    expect(api.getMesh3DLayers()[0].name).toBe('Hand tool');
  } finally {
    await world.edit(
      api,
      () => {
        api.setAppState({ penbarSelected: Pen.SELECT });
      },
      'NEVER',
    );
  }
  await world.edit(
    api,
    () => {
      runtime.add(ToBeDeleted);
    },
    'NEVER',
  );
  expect(api.getMesh3DLayers()).toHaveLength(1);
  expect(api.selectMesh3DLayer(id)).toBe(false);
});

it('removes deleted source registrations and selects a new companion using the same document id', async () => {
  const previous = mesh().hold();
  await world.edit(api, (editor) => editor.selectMesh3DLayer('model'), 'NEVER');
  await world.reset(api, []);
  await world.frame();
  expect(api.getMesh3DLayers()).toEqual([]);
  expect(api.getSelectedMesh3DLayerIds()).toEqual([]);
  expect(api.getMesh3DLayerIdByEntity(previous)).toBeUndefined();
  await world.reset(api, [node()]);
  await world.frame();
  await world.edit(api, (editor) => editor.selectMesh3DLayer('model'), 'NEVER');
  expect(mesh().has(Selected3D)).toBe(true);
  expect(other.getSelectedMesh3DLayerIds()).toEqual([]);
});
