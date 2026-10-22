import {
  CameraSync,
  ComputeBounds,
  ComputeCamera,
  EnsureExtrudeMeshes,
  EnsureMesh3DNodes,
  Last,
  Mesh3DNode,
  Pick3D,
  PostUpdate,
  Select,
  Selected3D,
  SyncExtrude3D,
  SyncMesh3DNodes,
  system,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

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
