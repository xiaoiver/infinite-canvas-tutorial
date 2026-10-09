import {
  Light3D,
  Material3D,
  Mesh3D,
  Mesh3DNode,
  Transform3D,
  ComputeBounds,
  ComputeCamera,
  EnsureMesh3DNodes,
  SyncMesh3DNodes,
  PostUpdate,
  system,
  type API,
  type SerializedNode,
  type Mesh3DNodeSerializedNode,
  type Light3DNodeSerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

const mesh = (
  patch: Partial<Mesh3DNodeSerializedNode> = {},
): Mesh3DNodeSerializedNode => ({
  id: 'node',
  type: 'mesh3d',
  zIndex: 0,
  x: 10,
  y: 20,
  width: 40,
  height: 60,
  ...patch,
});
const light = (
  patch: Partial<Light3DNodeSerializedNode> = {},
): Light3DNodeSerializedNode => ({
  id: 'node',
  type: 'light3d',
  lightType: 'point',
  zIndex: 0,
  x: 10,
  y: 20,
  ...patch,
});
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let reloaded: API;
beforeAll(async () => {
  world = await createDocumentWorld(2, false, [
    () => {
      // Real companion creation/synchronization, without the GPU/gizmo systems.
      system(PostUpdate)(EnsureMesh3DNodes);
      system((s) => s.after(ComputeBounds).before(ComputeCamera))(
        EnsureMesh3DNodes,
      );
      system(PostUpdate)(SyncMesh3DNodes);
      system((s) => s.after(EnsureMesh3DNodes).before(ComputeCamera))(
        SyncMesh3DNodes,
      );
    },
  ]);
  [api, reloaded] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
const settle = async () => {
  await world.frame();
  await world.frame();
};
const entity = (editor = api) => editor.getEntity(editor.getNodeById('node'));
const pick = <T>(value: T, keys: readonly (keyof T)[]) =>
  Object.fromEntries(keys.map((key) => [key, structuredClone(value[key])]));
const materialKeys = [
  'baseColor',
  'ambient',
  'diffuse',
  'specular',
  'shininess',
  'metallic',
  'roughness',
  'map',
  'specularMap',
  'bumpMap',
  'bumpScale',
] as const;
const state = (editor = api) => {
  const e = entity(editor);
  if (e.has(Light3D))
    return pick(e.read(Light3D), [
      'type',
      'color',
      'intensity',
      'position',
      'direction',
      'range',
      'innerConeAngle',
      'outerConeAngle',
    ]);
  const source = e.read(Mesh3DNode);
  const companion = source.meshEntity!;
  expect(companion).toBeDefined();
  return {
    source: pick(source, [
      'geometry',
      'z',
      'rotation3d',
      'scale3d',
      'camera3d',
      ...materialKeys,
    ]),
    material: pick(companion.read(Material3D), materialKeys),
    transform: pick(companion.read(Transform3D), [
      'translation',
      'rotation',
      'scale',
    ]),
    geometry: pick(companion.read(Mesh3D), [
      'positions',
      'normals',
      'indices',
      'uvs',
    ]),
  };
};
const load = async (node: SerializedNode) => {
  await world.reset(api, [node]);
  await settle();
  api.clearHistory();
};
const update = async (patch: Partial<SerializedNode>) => {
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('node'), patch),
  );
  await settle();
};
async function expectReload() {
  await world.reset(reloaded, structuredClone(api.getNodes()));
  await settle();
  expect(state()).toEqual(state(reloaded));
}
async function expectHistory(
  before: ReturnType<typeof state>,
  after: ReturnType<typeof state>,
) {
  await world.history(api, 'undo');
  await settle();
  expect(state()).toEqual(before);
  await world.history(api, 'redo');
  await settle();
  expect(state()).toEqual(after);
}

it.each([
  ['geometry', { type: 'sphere', segments: [8, 4] }],
  ['z', 35],
  ['rotation3d', [0.2, 0.4, 0.6]],
  ['scale3d', [20, 30, 40]],
  ['camera3d', { linked: false, projection: 'orthographic', clearColor: true }],
] as const)(
  'restores mesh %s through edit, clear, undo, redo and reload',
  async (key, value) => {
    await load(mesh());
    const before = state();
    const companion = entity().read(Mesh3DNode).meshEntity;
    await update({ [key]: value });
    const after = state();
    expect(after).not.toEqual(before);
    expect(entity().read(Mesh3DNode).meshEntity).toBe(companion);
    await expectReload();
    await expectHistory(before, after);
    await update({ [key]: undefined });
    expect(state()).toEqual(before);
    await expectReload();
    await expectHistory(after, before);
  },
);

it.each([
  ['baseColor', '#ff0000'],
  ['ambient', 0],
  ['diffuse', 0],
  ['specular', 0],
  ['shininess', 0],
  ['metallic', 0.8],
  ['roughness', 0.2],
  ['bumpScale', 0],
  ['map', 'data:image/png;base64,base'],
  ['specularMap', 'data:image/png;base64,specular'],
  ['bumpMap', 'data:image/png;base64,bump'],
] as const)(
  'replaces and clears material %s without retaining removed values',
  async (key, value) => {
    await load(mesh());
    const before = state();
    await update({ material3d: { [key]: value } });
    const after = state();
    expect(after).not.toEqual(before);
    await expectReload();
    await expectHistory(before, after);
    // A new wire object replaces the material object, it does not merge old keys.
    await update({ material3d: {} });
    expect(state()).toEqual(before);
    await expectReload();
    await expectHistory(after, before);
  },
);

it('resets the entire mesh material when the wire attribute is removed', async () => {
  await load(mesh());
  const before = state();
  await update({
    material3d: {
      baseColor: 'blue',
      roughness: 0.1,
      metallic: 1,
      ambient: 0,
      map: 'data:image/png;base64,texture',
    },
  });
  const after = state();
  await update({ material3d: undefined });
  expect(state()).toEqual(before);
  await expectReload();
  await expectHistory(after, before);
});

it.each([
  ['color', '#ff0000'],
  ['intensity', 0],
  ['direction', [0, 1, 0]],
  ['z', 30],
  ['range', 100],
  ['innerConeAngle', 0],
  ['outerConeAngle', 0.2],
] as const)(
  'restores light %s defaults through history and reload',
  async (key, value) => {
    await load(light());
    const before = state();
    await update({ [key]: value });
    const after = state();
    expect(after).not.toEqual(before);
    await expectReload();
    await expectHistory(before, after);
    await update({ [key]: undefined });
    expect(state()).toEqual(before);
    await expectReload();
    await expectHistory(after, before);
  },
);

it.each(['ambient', 'directional', 'spot'] as const)(
  'switches light type to %s without losing other settings',
  async (lightType) => {
    await load(light({ color: '#00ff00', intensity: 0, range: 20 }));
    const before = state();
    await update({ lightType });
    const after = state();
    expect(entity().read(Light3D).type).toBe(lightType);
    expect(entity().read(Light3D).intensity).toBe(0);
    await expectReload();
    await expectHistory(before, after);
  },
);

it('updates companion placement after canvas-space movement and resize', async () => {
  await load(mesh({ z: 15 }));
  const before = state();
  await update({ x: 30, y: 40, width: 80, height: 100 });
  const after = state();
  expect(
    entity().read(Mesh3DNode).meshEntity!.read(Transform3D).translation,
  ).toEqual([70, 90, 15]);
  await expectReload();
  await expectHistory(before, after);
});
