import {
  Canvas,
  Canvas3DScope,
  ComputeBounds,
  ComputeCamera,
  EnsureExtrudeMeshes,
  Extrude3D,
  ExportFormat,
  GlobalTransform,
  Material3D,
  Mesh3D,
  PostUpdate,
  SyncExtrude3D,
  Transform3D,
  system,
  type API,
  type PathSerializedNode,
} from '../../packages/ecs/src';
import { shouldSuppress2DShapeRender } from '../../packages/ecs/src/utils/extrude3d';
import {
  resolveExtrudeCompanionTransform,
  resolveExtrudeSourceTransform,
} from '../../packages/ecs/src/utils/extrude3d-transform';
import { entityIsDeclarative3DNode } from '../../packages/ecs/src/utils/mesh3d-node';
import { captureGizmoSource } from '../../packages/ecs/src/systems/pick3d/gizmo-source';
import { createDocumentWorld } from '../helpers/ecs-document';

const square = 'M10 20 L50 20 L50 60 L10 60 Z';
const path = (patch: Partial<PathSerializedNode> = {}): PathSerializedNode => ({
  id: 'vector',
  type: 'path',
  zIndex: 0,
  x: 60,
  y: 70,
  d: square,
  fills: [{ type: 'solid', value: '#ff0000' }],
  extrude3d: { depth: 20, z: 10 },
  ...patch,
});

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let second: API;
const source = (editor = api) =>
  editor.getEntity(editor.getNodeById('vector'))!;
const mesh = (editor = api) => source(editor).read(Extrude3D).meshEntity!;
beforeAll(async () => {
  world = await createDocumentWorld(2, false, [
    () => {
      system(PostUpdate)(EnsureExtrudeMeshes);
      system((s) => s.after(ComputeBounds).before(ComputeCamera))(
        EnsureExtrudeMeshes,
      );
      system(PostUpdate)(SyncExtrude3D);
      system((s) => s.after(EnsureExtrudeMeshes).before(ComputeCamera))(
        SyncExtrude3D,
      );
    },
  ]);
  [api, second] = world.apis;
});
afterAll(async () => world?.dispose());
beforeEach(async () => {
  await world.reset(api, []);
  await world.reset(second, []);
});

it('keeps local Path points and depth in the companion pose', async () => {
  await world.reset(api, [path()]);
  const companion = mesh();
  expect(companion.read(Canvas3DScope).canvas.read(Canvas).api).toBe(api);
  expect(companion.read(Transform3D).translation).toEqual([30, 40, 0]);
  expect(companion.read(Transform3D).scale).toEqual([1, 1, 20]);
  expect(companion.read(Material3D).baseColor).toEqual([1, 0, 0, 1]);
  const positions = companion.read(Mesh3D).positions;
  const xs = [...positions].filter((_, i) => i % 3 === 0);
  const ys = [...positions].filter((_, i) => i % 3 === 1);
  const zs = [...positions].filter((_, i) => i % 3 === 2);
  expect([Math.min(...xs), Math.max(...xs)]).toEqual([-20, 20]);
  expect([Math.min(...ys), Math.max(...ys)]).toEqual([-20, 20]);
  expect([Math.min(...zs), Math.max(...zs)]).toEqual([-0.5, 0.5]);
  expect(shouldSuppress2DShapeRender(source())).toBe(true);
  await world.frame();
  await world.frame();
  expect(companion.read(Mesh3D).positions).toBe(positions);

  await world.edit(
    api,
    (editor) =>
      editor.updateNode(editor.getNodeById('vector'), {
        x: 90,
        rotation: Math.PI / 2,
      }),
    'NEVER',
  );
  expect(mesh()).toBe(companion);
  expect(companion.read(Mesh3D).positions).toBe(positions);
  const sourceMatrix = source().read(GlobalTransform).matrix;
  expect(companion.read(Transform3D).translation[0]).toBeCloseTo(
    sourceMatrix.m00 * 20 + sourceMatrix.m10 * 20 + sourceMatrix.m20,
  );
  expect(companion.read(Transform3D).rotation[2]).toBeCloseTo(Math.PI / 2);
});

it('updates side color without rebuilding the Path mesh and restores it on undo', async () => {
  await world.reset(api, [
    path({ extrude3d: { depth: 20, sideColor: '#00ff00' } }),
  ]);
  const companion = mesh();
  const positions = companion.read(Mesh3D).positions;
  expect(companion.read(Material3D).baseColor).toEqual([1, 0, 0, 1]);
  expect(companion.read(Material3D).sideColor).toEqual([0, 1, 0, 1]);

  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('vector'), {
      extrude3d: { depth: 20, sideColor: '#0000ff' },
    }),
  );
  expect(mesh()).toBe(companion);
  expect(mesh().read(Mesh3D).positions).toBe(positions);
  expect(mesh().read(Material3D).sideColor).toEqual([0, 0, 1, 1]);

  await world.history(api, 'undo');
  expect(mesh().read(Material3D).sideColor).toEqual([0, 1, 0, 1]);
});

it('keeps a world-size bevel while depth changes and restores geometry on undo', async () => {
  await world.reset(api, [path({ extrude3d: { depth: 20, bevelSize: 2 } })]);
  const companion = mesh();
  const capExtent = () => {
    const { positions, normals } = companion.read(Mesh3D);
    const xs = [...positions].filter(
      (_, i) => i % 3 === 0 && normals[i + 2] === 1,
    );
    return [Math.min(...xs), Math.max(...xs)];
  };
  expect(capExtent()).toEqual([-18, 18]);
  const beveled = companion.read(Mesh3D).positions;
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('vector'), {
      extrude3d: { depth: 30, bevelSize: 2 },
    }),
  );
  expect(mesh()).toBe(companion);
  expect(companion.read(Mesh3D).positions).not.toBe(beveled);
  expect(capExtent()).toEqual([-18, 18]);
  await world.history(api, 'undo');
  expect(capExtent()).toEqual([-18, 18]);
  expect(companion.read(Transform3D).scale[2]).toBe(20);
});

it('rebuilds the Path mesh when its bevel profile changes', async () => {
  await world.reset(api, [
    path({ extrude3d: { depth: 20, bevelSize: 2, bevelSegments: 4 } }),
  ]);
  const companion = mesh();
  const rounded = companion.read(Mesh3D).positions;
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('vector'), {
      extrude3d: { depth: 20, bevelSize: 2, bevelSegments: 1 },
    }),
  );
  expect(mesh()).toBe(companion);
  expect(companion.read(Mesh3D).positions.length).toBeLessThan(rounded.length);
});

it('rebuilds a beveled Path for a nonuniform source scale', async () => {
  await world.reset(api, [path({ extrude3d: { depth: 20, bevelSize: 2 } })]);
  const original = mesh().read(Mesh3D).positions;
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('vector'), { scaleX: 2 }),
  );
  const companion = mesh();
  expect(companion.read(Mesh3D).positions).not.toBe(original);
  const { positions, normals } = companion.read(Mesh3D);
  const frontX = [...positions].filter(
    (_, i) => i % 3 === 0 && normals[i + 2] === 1,
  );
  expect(Math.min(...frontX) * 2).toBeCloseTo(-38);
  expect(Math.max(...frontX) * 2).toBeCloseTo(38);
});

it('rebuilds only after Path geometry changes and restores it through history', async () => {
  await world.reset(api, [path()]);
  const companion = mesh();
  const original = companion.read(Mesh3D).positions;
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('vector'), {
      d: 'M10 20 L70 20 L70 60 L10 60 Z',
    }),
  );
  expect(mesh()).toBe(companion);
  expect(companion.read(Mesh3D).positions).not.toBe(original);
  await world.history(api, 'undo');
  expect(companion.read(Mesh3D).positions).toEqual(original);
});

it('uses the Path fill rule for a hole instead of filling its bounding box', async () => {
  await world.reset(api, [
    path({
      d: 'M0 0 L100 0 L100 100 L0 100 Z M25 25 L75 25 L75 75 L25 75 Z',
      fillRule: 'evenodd',
    }),
  ]);
  const { positions, normals, indices } = mesh().read(Mesh3D);
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    if (normals[a + 2] !== 1) continue;
    area +=
      ((positions[b] - positions[a]) * (positions[c + 1] - positions[a + 1]) -
        (positions[b + 1] - positions[a + 1]) * (positions[c] - positions[a])) /
      2;
  }
  expect(area).toBeCloseTo(7500);
});

it('keeps open, stroked and unsupported fills visible in 2D', async () => {
  await world.reset(api, [path({ d: 'M0 0 L20 0 L20 20' })]);
  expect(source().has(Extrude3D)).toBe(true);
  expect(source().read(Extrude3D).meshEntity).toBeUndefined();
  expect(shouldSuppress2DShapeRender(source())).toBe(false);
  expect(entityIsDeclarative3DNode(source())).toBe(false);

  await world.edit(
    api,
    (editor) => editor.updateNode(editor.getNodeById('vector'), { d: square }),
    'NEVER',
  );
  expect(mesh()).toBeDefined();
  expect(entityIsDeclarative3DNode(source())).toBe(true);
  await world.edit(
    api,
    (editor) =>
      editor.updateNode(editor.getNodeById('vector'), {
        fills: [{ type: 'gradient', value: 'linear-gradient(red, blue)' }],
      }),
    'NEVER',
  );
  await world.frame();
  expect(source().read(Extrude3D).meshEntity).toBeUndefined();
  expect(shouldSuppress2DShapeRender(source())).toBe(false);
  expect(entityIsDeclarative3DNode(source())).toBe(false);

  await world.edit(
    api,
    (editor) =>
      editor.updateNode(editor.getNodeById('vector'), {
        fills: [{ type: 'solid', value: '#ff0000' }],
        strokes: [{ type: 'solid', value: '#000000' }],
      }),
    'NEVER',
  );
  expect(source().read(Extrude3D).meshEntity).toBeUndefined();
  expect(shouldSuppress2DShapeRender(source())).toBe(false);
});

it('round-trips Path gizmo movement and depth through the document wire', async () => {
  await world.reset(api, [path()]);
  const companion = mesh();
  const gesture = captureGizmoSource(companion, api)!;
  const pose = {
    translation: [90, 100, 15] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 30] as [number, number, number],
  };
  const patch = gesture.patch(pose, api.getNodeById('vector'))!;
  expect(patch.x).toBe(70);
  expect(patch.y).toBe(80);
  expect(patch.extrude3d).toEqual({ depth: 30, z: 30, rotation: [0, 0, 0] });
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('vector'), patch),
  );
  expect(mesh()).toBe(companion);
  expect(companion.read(Transform3D).translation).toEqual([90, 100, 15]);
  expect(companion.read(Transform3D).scale[2]).toBe(30);
  const positions = companion.read(Mesh3D).positions;
  await world.history(api, 'undo');
  expect(companion.read(Transform3D).translation).toEqual([30, 40, 0]);
  expect(companion.read(Mesh3D).positions).toBe(positions);
});

it('round-trips Path origins in the legacy Y-up 3D space', async () => {
  await world.reset(api, [path()]);
  const pose = resolveExtrudeCompanionTransform(source(), false)!;
  expect(pose.translation).toEqual([30, -40, 0]);
  pose.translation = [90, -100, 15];
  expect(resolveExtrudeSourceTransform(source(), pose, false)).toMatchObject({
    x: 70,
    y: 80,
    extrude: { depth: 20, z: 25 },
  });
});

it('maps local points through rotation and flip like the 2D source', async () => {
  await world.reset(api, [path({ rotation: 0.4, scaleX: -1, scaleY: 2 })]);
  const companion = mesh();
  const pose = companion.read(Transform3D);
  const matrix = source().read(GlobalTransform).matrix;
  const [x, y] = [20, 10];
  const angle = pose.rotation[2];
  const actualX =
    pose.translation[0] +
    Math.cos(angle) * pose.scale[0] * x -
    Math.sin(angle) * pose.scale[1] * y;
  const actualY =
    pose.translation[1] +
    Math.sin(angle) * pose.scale[0] * x +
    Math.cos(angle) * pose.scale[1] * y;
  expect(actualX).toBeCloseTo(
    matrix.m00 * (x + 20) + matrix.m10 * (y + 20) + matrix.m20,
    4,
  );
  expect(actualY).toBeCloseTo(
    matrix.m01 * (x + 20) + matrix.m11 * (y + 20) + matrix.m21,
    4,
  );
  const flipped = companion.read(Mesh3D);
  const flippedPositions = flipped.positions;
  const flippedIndices = flipped.indices;
  const flippedNormals = flipped.normals;
  await world.edit(
    api,
    (editor) => editor.updateNode(editor.getNodeById('vector'), { scaleX: 1 }),
    'NEVER',
  );
  const ordinary = companion.read(Mesh3D);
  expect(ordinary.positions).toBe(flippedPositions);
  expect(ordinary.indices).not.toBe(flippedIndices);
  expect(ordinary.normals[2]).toBe(-flippedNormals[2]);
  await world.edit(
    api,
    (editor) => editor.updateNode(editor.getNodeById('vector'), { scaleX: -1 }),
    'NEVER',
  );
  expect(companion.read(Mesh3D).indices).toBe(flippedIndices);
});

it('extrudes a Path through a sheared parent and keeps its world footprint', async () => {
  await world.reset(api, [
    { id: 'parent', type: 'g', zIndex: 0, x: 20, y: 30, scaleX: 2 },
    path({
      parentId: 'parent',
      rotation: Math.PI / 4,
      d: 'M10 20 L50 20 L10 60 Z',
    }),
  ]);
  const companion = mesh();
  const original = companion.read(Mesh3D).positions;
  const sourceMatrix = source().read(GlobalTransform).matrix;
  expect(
    Math.abs(
      sourceMatrix.m00 * sourceMatrix.m10 + sourceMatrix.m01 * sourceMatrix.m11,
    ),
  ).toBeGreaterThan(0.1);
  const transform = companion.read(Transform3D);
  const pose = {
    translation: [...transform.translation] as [number, number, number],
    rotation: [...transform.rotation] as [number, number, number],
    scale: [...transform.scale] as [number, number, number],
  };
  expect(pose.scale).toEqual([1, 1, 20]);
  const points = new Set<string>();
  const { positions, normals } = companion.read(Mesh3D);
  for (let i = 0; i < positions.length; i += 3) {
    if (normals[i + 2] !== 1) continue;
    const x = positions[i];
    const y = positions[i + 1];
    const angle = pose.rotation[2];
    points.add(
      `${Math.round(
        (Math.cos(angle) * x - Math.sin(angle) * y + pose.translation[0]) *
          1000,
      )},${Math.round(
        (Math.sin(angle) * x + Math.cos(angle) * y + pose.translation[1]) *
          1000,
      )}`,
    );
  }
  for (const [x, y] of [
    [0, 0],
    [40, 0],
    [0, 40],
  ]) {
    const worldX =
      sourceMatrix.m00 * x + sourceMatrix.m10 * y + sourceMatrix.m20;
    const worldY =
      sourceMatrix.m01 * x + sourceMatrix.m11 * y + sourceMatrix.m21;
    expect(
      points.has(`${Math.round(worldX * 1000)},${Math.round(worldY * 1000)}`),
    ).toBe(true);
  }
  const legacyPose = resolveExtrudeCompanionTransform(source(), false)!;
  expect(legacyPose.translation[0]).toBeCloseTo(pose.translation[0]);
  expect(legacyPose.translation[1]).toBeCloseTo(-pose.translation[1]);
  expect(legacyPose.scale).toEqual(pose.scale);
  const glb = api.export({
    format: ExportFormat.GLB,
    nodes: [api.getNodeById('vector')!],
    download: false,
  }) as Uint8Array;
  expect(new DataView(glb.buffer, glb.byteOffset).getUint32(0, true)).toBe(
    0x46546c67,
  );
  const gesture = captureGizmoSource(companion, api)!;
  const nextPose = {
    translation: [
      pose.translation[0] + 20,
      pose.translation[1] - 10,
      pose.translation[2],
    ] as [number, number, number],
    rotation: [...pose.rotation] as [number, number, number],
    scale: [...pose.scale] as [number, number, number],
  };
  const patch = gesture.patch(nextPose, api.getNodeById('vector'))!;
  await world.edit(
    api,
    (editor) => editor.updateNode(editor.getNodeById('vector'), patch),
    'NEVER',
  );
  expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(
    nextPose.translation[0],
  );
  expect(mesh().read(Transform3D).translation[1]).toBeCloseTo(
    nextPose.translation[1],
  );
  expect(mesh().read(Mesh3D).positions).toBe(original);
  await world.edit(
    api,
    (editor) => editor.updateNode(editor.getNodeById('vector'), { x: 120 }),
    'NEVER',
  );
  expect(mesh().read(Mesh3D).positions).toBe(original);
  await world.edit(
    api,
    (editor) => editor.updateNode(editor.getNodeById('parent'), { scaleX: 3 }),
    'NEVER',
  );
  expect(mesh().read(Mesh3D).positions).not.toBe(original);
});

it('isolates companions across canvases', async () => {
  await world.reset(api, [path()]);
  await world.reset(second, [path({ d: 'M0 0 L20 0 L20 20 L0 20 Z' })]);
  expect(mesh()).not.toBe(mesh(second));
  expect(mesh(second).read(Canvas3DScope).canvas.read(Canvas).api).toBe(second);
  await world.reset(api, []);
  expect(mesh(second).alive).toBe(true);
});
