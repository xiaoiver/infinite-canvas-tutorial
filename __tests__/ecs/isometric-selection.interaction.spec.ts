import {
  CameraSync,
  ComputeBounds,
  ComputeCamera,
  Extrude3D,
  EnsureExtrudeMeshes,
  EnsureMesh3DNodes,
  Last,
  Mesh3DNode,
  Mesh3D,
  Camera3D,
  Pick3D,
  PostUpdate,
  Select,
  Selected,
  Selected3D,
  Transform3D,
  SyncExtrude3D,
  SyncMesh3DNodes,
  system,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';
import { buildPickSceneForViewport } from '../../packages/ecs/src/utils/pick3d-probe';
import { projectMesh3DViewportBounds } from '../../packages/ecs/src/utils/isometric-marquee';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;

beforeAll(async () => {
  world = await createSelectionWorld(1, [
    () => {
      system(PostUpdate)(EnsureExtrudeMeshes);
      system((s) => s.after(ComputeBounds).before(ComputeCamera))(
        EnsureExtrudeMeshes,
      );
      system(PostUpdate)(EnsureMesh3DNodes);
      system((s) => s.after(EnsureExtrudeMeshes).before(ComputeCamera))(
        EnsureMesh3DNodes,
      );
      system(PostUpdate)(SyncExtrude3D);
      system((s) => s.after(EnsureMesh3DNodes).before(ComputeCamera))(
        SyncExtrude3D,
      );
      system(PostUpdate)(SyncMesh3DNodes);
      system((s) => s.after(SyncExtrude3D).before(ComputeCamera))(
        SyncMesh3DNodes,
      );
      system((s) =>
        s.inAnyOrderWith(s.allSystems).after(CameraSync, Select).before(Last),
      )(Pick3D);
    },
  ]);
});

afterAll(async () => {
  await world?.dispose();
});

it('projects a viewport drag onto a canvas-owned edit plane and back', async () => {
  const [api] = world.apis;
  await world.reset(api, []);
  expect(api.viewport2WorldOnPlane({ x: 100, y: 100 })).toBeNull();
  expect(api.world3D2Viewport([100, 100, 0])).toBeNull();
  await world.edit(
    api,
    (editor) =>
      editor.setCamera3D({
        preset: 'isometric',
        center: [100, 100, 0],
        distance: 500,
        orthographicHeight: 200,
      }),
    'NEVER',
  );
  const start = api.viewport2WorldOnPlane({ x: 70, y: 90 }, 20);
  const end = api.viewport2WorldOnPlane({ x: 140, y: 145 }, 20);
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  expect(start![2]).toBe(20);
  expect(end![2]).toBe(20);
  const projected = api.world3D2Viewport(end!);
  expect(projected![0]).toBeCloseTo(140, 3);
  expect(projected![1]).toBeCloseTo(145, 3);
  expect(api.viewport2WorldOnPlane({ x: 0, y: 0 }, Infinity)).toBeNull();
  expect(api.world3D2Viewport([NaN, 0, 0])).toBeNull();
  await world.edit(
    api,
    (editor) =>
      editor.setCamera3D({ linked: true, projection: 'orthographic' }),
    'NEVER',
  );
  expect(api.viewport2WorldOnPlane({ x: 100, y: 100 })).toBeNull();
  expect(api.world3D2Viewport([100, 100, 0])).toBeNull();
});

it('gives a tilted 3D mesh press priority over an overlapping 2D selection', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    {
      id: 'flat',
      type: 'rect',
      x: 80,
      y: 80,
      width: 40,
      height: 40,
      zIndex: 1,
    },
    {
      id: 'cube',
      type: 'mesh3d',
      geometry: { type: 'cube' },
      x: 80,
      y: 80,
      width: 40,
      height: 40,
      scale3d: 40,
      zIndex: 0,
    },
  ]);
  await world.edit(
    api,
    (editor) => {
      editor.gotoLandmark(
        { x: 0, y: 0, zoom: 1, rotation: 0 },
        { duration: 0 },
      );
      editor.setCamera3D({
        preset: 'isometric',
        center: [100, 100, 0],
        distance: 500,
        orthographicHeight: 200,
      });
      editor.selectNodes([editor.getNodeById('flat')]);
    },
    'NEVER',
  );
  await world.frames(3);

  const cube = api.getEntity(api.getNodeById('cube')).read(Mesh3DNode)
    .meshEntity!;
  const before = structuredClone(api.getNodeById('flat'));
  await world.pointer(api, 'pointerdown', 100, 100);
  expect(cube.has(Selected3D)).toBe(true);
  await world.pointer(api, 'pointermove', 115, 110);
  await world.pointer(api, 'pointerup', 115, 110);
  expect(api.getNodeById('flat')).toEqual(before);
});

it('marquee-selects projected meshes live without selecting the ground or flat source bounds', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    { id: 'flat', type: 'rect', x: 0, y: 0, width: 200, height: 200 },
    {
      id: 'ground',
      type: 'mesh3d',
      geometry: { type: 'plane' },
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      z: -50,
      scale3d: [200, 200, 1],
    },
    {
      id: 'cube-a',
      type: 'mesh3d',
      geometry: { type: 'cube' },
      x: 55,
      y: 75,
      width: 30,
      height: 30,
      scale3d: 30,
    },
    {
      id: 'cube-b',
      type: 'mesh3d',
      geometry: { type: 'cube' },
      x: 125,
      y: 75,
      width: 30,
      height: 30,
      scale3d: 30,
    },
  ]);
  await world.edit(
    api,
    (editor) => {
      editor.setCamera3D({
        preset: 'isometric',
        center: [100, 100, 0],
        distance: 500,
        orthographicHeight: 200,
      });
    },
    'NEVER',
  );
  await world.frames(3);

  const bounds = (id: string) => {
    const entity = api.getEntity(api.getNodeById(id)).read(Mesh3DNode)
      .meshEntity!;
    const scene = buildPickSceneForViewport(
      api.getCanvas().read(Camera3D),
      200,
      200,
      200,
      200,
    )!;
    return projectMesh3DViewportBounds(
      entity.read(Mesh3D).positions,
      entity.read(Transform3D),
      scene,
      200,
      200,
    )!;
  };
  const first = bounds('cube-a');
  const second = bounds('cube-b');
  const startX = Math.floor(Math.min(first.minX, second.minX) - 3);
  const startY = Math.floor(Math.min(first.minY, second.minY) - 3);
  const firstEndX = Math.ceil(first.maxX + 3);
  const firstEndY = Math.ceil(first.maxY + 3);
  const bothEndX = Math.ceil(Math.max(first.maxX, second.maxX) + 3);
  const bothEndY = Math.ceil(Math.max(first.maxY, second.maxY) + 3);
  expect(startX).toBeGreaterThanOrEqual(0);
  expect(startY).toBeGreaterThanOrEqual(0);
  expect(bothEndX).toBeLessThanOrEqual(200);
  expect(bothEndY).toBeLessThanOrEqual(200);

  await world.pointer(api, 'pointerdown', startX, startY, { shiftKey: true });
  await world.pointer(api, 'pointermove', firstEndX, firstEndY, {
    shiftKey: true,
  });
  expect(api.getSelectedMesh3DLayerIds()).toEqual(['cube-a']);
  expect(api.getAppState().layersSelected).toEqual(['cube-a']);
  expect(
    api
      .getEntity(api.getNodeById('ground'))
      .read(Mesh3DNode)
      .meshEntity!.has(Selected3D),
  ).toBe(false);
  await world.pointer(api, 'pointermove', bothEndX, bothEndY, {
    shiftKey: true,
  });
  expect(api.getSelectedMesh3DLayerIds().sort()).toEqual(['cube-a', 'cube-b']);
  expect(api.getAppState().layersSelected).not.toContain('flat');
  await world.pointer(api, 'pointerup', bothEndX, bothEndY, { shiftKey: true });
  expect(api.getSelectedMesh3DLayerIds().sort()).toEqual(['cube-a', 'cube-b']);
});

it('marquee-selects an extruded Path without selecting its flat source', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    {
      id: 'extruded-path',
      type: 'path',
      zIndex: 0,
      x: 60,
      y: 60,
      d: 'M60 60 L100 60 L100 100 L60 100 Z',
      extrude3d: { depth: 20, z: 10 },
      fills: [{ type: 'solid', value: '#ee9950' }],
    },
  ]);
  await world.edit(
    api,
    (editor) => {
      editor.setCamera3D({
        preset: 'dimetric-2-1',
        center: [100, 100, 0],
        distance: 500,
        orthographicHeight: 200,
      });
    },
    'NEVER',
  );
  await world.frames(3);
  const source = api.getEntity(api.getNodeById('extruded-path'));
  const mesh = source.read(Extrude3D).meshEntity!;
  const scene = buildPickSceneForViewport(
    api.getCanvas().read(Camera3D),
    200,
    200,
    200,
    200,
  )!;
  const bounds = projectMesh3DViewportBounds(
    mesh.read(Mesh3D).positions,
    mesh.read(Transform3D),
    scene,
    200,
    200,
  )!;
  const startX = Math.floor(bounds.minX - 3);
  const startY = Math.floor(bounds.minY - 3);
  const endX = Math.ceil(bounds.maxX + 3);
  const endY = Math.ceil(bounds.maxY + 3);
  await world.pointer(api, 'pointerdown', startX, startY, { shiftKey: true });
  await world.pointer(api, 'pointermove', endX, endY, { shiftKey: true });
  expect(api.getSelectedMesh3DLayerIds()).toEqual(['extruded-path']);
  expect(mesh.has(Selected3D)).toBe(true);
  expect(source.has(Selected)).toBe(false);
  await world.pointer(api, 'pointerup', endX, endY, { shiftKey: true });
});

it('round-trips editable Path anchors through the extrusion face and updates its mesh', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    {
      id: 'editable-path',
      type: 'path',
      x: 60,
      y: 60,
      rotation: Math.PI / 6,
      scaleX: 1.2,
      scaleY: 0.8,
      d: 'M60 60 L100 60 L100 100 L60 100 Z',
      extrude3d: { depth: 20, z: 25 },
      fills: [{ type: 'solid', value: '#ee9950' }],
    },
  ]);
  const node = api.getNodeById('editable-path');
  await world.edit(
    api,
    (editor) =>
      editor.setCamera3D({
        preset: 'isometric',
        center: [100, 100, 0],
        distance: 500,
        orthographicHeight: 200,
      }),
    'NEVER',
  );
  await world.frames(3);
  const source = api.getEntity(node);
  const mesh = source.read(Extrude3D).meshEntity!;
  const before = mesh.read(Mesh3D).positions.slice();
  const viewport = api.pathLocal2Viewport3D(node, [60, 60])!;
  const local = api.viewport2PathLocal3D(node, {
    x: viewport[0],
    y: viewport[1],
  })!;
  expect(local[0]).toBeCloseTo(60, 3);
  expect(local[1]).toBeCloseTo(60, 3);
  const moved = api.viewport2PathLocal3D(node, {
    x: viewport[0] + 10,
    y: viewport[1] + 4,
  })!;
  await world.edit(
    api,
    (editor) =>
      editor.updateNode(node, {
        d: `M${moved[0]} ${moved[1]} L100 60 L100 100 L60 100 Z`,
      }),
    'NEVER',
  );
  await world.frames(3);
  expect(Array.from(mesh.read(Mesh3D).positions)).not.toEqual(
    Array.from(before),
  );
  const projected = api.pathLocal2Viewport3D(
    api.getNodeById('editable-path'),
    moved,
  )!;
  expect(projected[0]).toBeCloseTo(viewport[0] + 10, 3);
  expect(projected[1]).toBeCloseTo(viewport[1] + 4, 3);
  expect(api.viewport2PathLocal3D(node, { x: 0, y: 0 })).not.toBeNull();
  expect(
    api.pathLocal2Viewport3D({ id: 'missing', type: 'path' }, [0, 0]),
  ).toBeNull();
  expect(
    api.viewport2PathLocal3D(
      { id: 'missing', type: 'path' },
      {
        x: 0,
        y: 0,
      },
    ),
  ).toBeNull();
  await world.edit(
    api,
    (editor) =>
      editor.updateNode(node, {
        extrude3d: { depth: 20, z: 25, rotation: [0.35, -0.25, 0.2] },
      }),
    'NEVER',
  );
  await world.frames(3);
  const tilted = api.pathLocal2Viewport3D(node, moved)!;
  expect(tilted).not.toBeNull();
  const tiltedLocal = api.viewport2PathLocal3D(node, {
    x: tilted[0],
    y: tilted[1],
  })!;
  expect(tiltedLocal[0]).toBeCloseTo(moved[0], 3);
  expect(tiltedLocal[1]).toBeCloseTo(moved[1], 3);
  const tiltedDrag = api.viewport2PathLocal3D(node, {
    x: tilted[0] + 8,
    y: tilted[1] - 5,
  })!;
  const tiltedProjected = api.pathLocal2Viewport3D(node, tiltedDrag)!;
  expect(tiltedProjected[0]).toBeCloseTo(tilted[0] + 8, 3);
  expect(tiltedProjected[1]).toBeCloseTo(tilted[1] - 5, 3);
  await world.edit(
    api,
    (editor) =>
      editor.updateNode(node, {
        extrude3d: { depth: 20, z: 25 },
        scaleX: 0,
      }),
    'NEVER',
  );
  expect(api.viewport2PathLocal3D(node, { x: 0, y: 0 })).toBeNull();
});
