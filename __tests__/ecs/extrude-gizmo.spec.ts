import {
  Camera3D,
  Canvas,
  Canvas3DScope,
  CameraSync,
  ComputeBounds,
  ComputeCamera,
  EnsureExtrudeMeshes,
  Extrude3D,
  Pick3D,
  Select,
  PostUpdate,
  Last,
  Selected3D,
  Selected,
  SyncExtrude3D,
  System,
  Transform,
  Transform3D,
  system,
  type Entity,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';
import { has3DMeshGizmoSelectedForCanvas } from '../../packages/ecs/src/utils/pick3d-bridge';

const node = (patch: Partial<RectSerializedNode> = {}): RectSerializedNode => ({
  id: 'box',
  type: 'rect',
  zIndex: 0,
  x: 60,
  y: 60,
  width: 40,
  height: 40,
  extrude3d: { depth: 20, z: 10 },
  fills: [{ type: 'solid', value: '#ff0000' }],
  ...patch,
});
let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let cameras: Entity[] = [];
const api = () => world.apis[0];
const source = () => api().getEntity(api().getNodeById('box'));
const mesh = () => source().read(Extrude3D).meshEntity!;
const wire = () => api().getNodeById('box') as RectSerializedNode;
beforeAll(async () => {
  class ObserveCameras extends System {
    cameras = this.query((q) => q.current.with(Camera3D));
    execute() {
      cameras = this.cameras.current.map((e) => e.hold());
    }
  }
  world = await createSelectionWorld(2, [
    () => {
      system(PostUpdate)(EnsureExtrudeMeshes);
      system((s) => s.after(ComputeBounds).before(ComputeCamera))(
        EnsureExtrudeMeshes,
      );
      system(PostUpdate)(SyncExtrude3D);
      system((s) => s.after(EnsureExtrudeMeshes).before(ComputeCamera))(
        SyncExtrude3D,
      );
      system((s) =>
        s.inAnyOrderWith(s.allSystems).after(CameraSync, Select).before(Last),
      )(Pick3D);
      system((s) => s.after(Pick3D).before(Last))(ObserveCameras);
    },
  ]);
});
afterAll(async () => {
  await world?.dispose();
});
async function reset(value = node()) {
  await world.reset(api(), [value]);
  await world.edit(
    api(),
    (editor) => {
      editor.selectNodes([editor.getNodeById('box')]);
      for (const camera of cameras)
        camera.write(Camera3D).projection = 'perspective';
    },
    'NEVER',
  );
  await world.frames();
  api().clearHistory();
}
beforeEach(async () => {
  for (const editor of world.apis) {
    await world.pointer(editor, 'pointercancel', 190, 190);
    await world.reset(editor, []);
    await world.edit(
      editor,
      (e) =>
        e.gotoLandmark({ x: 0, y: 0, zoom: 1, rotation: 0 }, { duration: 0 }),
      'NEVER',
    );
  }
  await reset();
});

it('clears and restores the companion selection through the document API', async () => {
  expect(mesh().has(Selected3D)).toBe(true);
  await world.edit(api(), (editor) => editor.deselectNodes([wire()]), 'NEVER');
  await world.frames();
  expect(source().has(Selected)).toBe(false);
  expect(mesh().has(Selected3D)).toBe(false);
  await world.edit(api(), (editor) => editor.selectNodes([wire()]), 'NEVER');
  await world.frames();
  expect(mesh().has(Selected3D)).toBe(true);
  await world.edit(api(), (editor) => editor.selectNodes([]), 'NEVER');
  await world.frames();
  expect(mesh().has(Selected3D)).toBe(false);
  await world.edit(api(), (editor) => editor.selectNodes([wire()]), 'NEVER');
  await world.edit(api(), (editor) =>
    editor.updateNode(wire(), { extrude3d: false }),
  );
  await world.frames(4);
  expect(source().has(Selected)).toBe(true);
  expect(has3DMeshGizmoSelectedForCanvas(api().getCanvas())).toBe(false);
});

it('keeps XY preview stable, publishes once, and restores the pose after history and reload', async () => {
  let edits = 0;
  const unsubscribe = api().subscribe((_snapshot, changes) => {
    if (changes.nodesChanged) edits++;
  });
  try {
    await world.pointer(api(), 'pointerdown', 125, 80);
    expect(mesh().read(Selected3D).activeAxis).toBe('x');
    await world.pointer(api(), 'pointermove', 145, 80);
    await world.frames(4);
    expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(100);
    expect(source().read(Transform).translation.x).toBeCloseTo(80);
    expect(wire().x).toBe(60);
    expect(edits).toBe(0);
    await world.pointer(api(), 'pointerup', 145, 80);
    expect(wire().x).toBeCloseTo(80);
    expect(edits).toBe(1);
    const saved = structuredClone(api().getNodes());
    await world.history(api(), 'undo');
    await world.frames();
    expect(wire().x).toBe(60);
    expect(api().getHistoryState().canUndo).toBe(false);
    await world.history(api(), 'redo');
    await world.frames();
    expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(100);
    await world.reset(world.apis[1], saved);
    await world.frames();
    const reloaded = world.apis[1]
      .getEntity(world.apis[1].getNodeById('box'))
      .read(Extrude3D).meshEntity!;
    expect(reloaded.read(Transform3D).translation).toEqual(
      mesh().read(Transform3D).translation,
    );
  } finally {
    unsubscribe();
  }
});

it.each(['Escape', 'pointercancel', 'pointerleave'] as const)(
  'restores source and companion on %s, ignoring a later release',
  async (reason) => {
    const before = structuredClone(api().getNodes());
    await world.pointer(api(), 'pointerdown', 80, 125, {
      pointerType: 'touch',
    });
    await world.pointer(api(), 'pointermove', 80, 145, {
      pointerType: 'touch',
    });
    expect(mesh().read(Transform3D).translation[1]).toBeCloseTo(100);
    if (reason === 'Escape') await world.key(api(), 'Escape');
    else await world.pointer(api(), reason, 80, 145, { pointerType: 'touch' });
    await world.pointer(api(), 'pointerup', 80, 155, { pointerType: 'touch' });
    expect(api().getNodes()).toEqual(before);
    expect(source().read(Transform).translation.y).toBe(60);
    expect(mesh().read(Transform3D).translation).toEqual([80, 80, 0]);
    expect(api().getHistoryState().canUndo).toBe(false);
  },
);

it('moves in Z without changing depth and preserves that separation through undo and reload', async () => {
  const [dx, dy] = [0.5, 0.55].map((v) => v / Math.hypot(0.5, 0.55));
  const distance = 150 * Math.tan(Math.PI / 8) * 0.6;
  const x = 80 + dx * distance,
    y = 80 + dy * distance;
  await world.pointer(api(), 'pointerdown', x, y, { pointerType: 'pen' });
  expect(mesh().read(Selected3D).activeAxis).toBe('z');
  await world.pointer(api(), 'pointermove', x + dx * 20, y + dy * 20, {
    pointerType: 'pen',
  });
  await world.frames(3);
  expect(source().read(Extrude3D).depth).toBe(20);
  expect(source().read(Extrude3D).z).toBeCloseTo(30);
  await world.pointer(api(), 'pointerup', x + dx * 20, y + dy * 20, {
    pointerType: 'pen',
  });
  const extrusion = wire().extrude3d as { depth: number; z: number };
  expect(extrusion.depth).toBe(20);
  expect(extrusion.z).toBeCloseTo(30, 3);
  expect(wire().x).toBeCloseTo(60);
  expect(wire().y).toBeCloseTo(60);
  await world.history(api(), 'undo');
  await world.frames();
  expect(mesh().read(Transform3D).translation[2]).toBeCloseTo(0);
  await world.history(api(), 'redo');
  await world.frames();
  expect(mesh().read(Transform3D).translation[2]).toBeCloseTo(20);
});

it('persists local ring rotation without changing the source footprint, and can cancel another rotation', async () => {
  const radius = 150 * Math.tan(Math.PI / 8) * 0.825;
  await world.pointer(
    api(),
    'pointerdown',
    80 + radius / Math.SQRT2,
    80 + radius / Math.SQRT2,
  );
  expect(mesh().read(Selected3D).activePartKind).toBe('rotate');
  await world.pointer(api(), 'pointerup', 80, 80 + radius);
  expect(source().read(Transform).rotation).toBe(0);
  expect(source().read(Extrude3D).rotation[2]).toBeCloseTo(Math.PI / 4);
  await world.frames(4);
  expect(mesh().read(Transform3D).rotation[2]).toBeCloseTo(Math.PI / 4);
  expect(mesh().read(Transform3D).scale).toEqual([40, 40, 20]);
  await world.history(api(), 'undo');
  await world.frames();
  expect(mesh().read(Transform3D).rotation[2]).toBeCloseTo(0);
  expect(source().read(Extrude3D).rotation[2]).toBeCloseTo(0);
  await world.history(api(), 'redo');
  await world.frames();
  expect(mesh().read(Transform3D).rotation[2]).toBeCloseTo(Math.PI / 4);
  const before = structuredClone(api().getNodes());
  await world.pointer(
    api(),
    'pointerdown',
    80 + radius / Math.SQRT2,
    80 + radius / Math.SQRT2,
  );
  await world.pointer(api(), 'pointermove', 80 - radius, 80);
  await world.key(api(), 'Escape');
  expect(api().getNodes()).toEqual(before);
  expect(mesh().read(Transform3D).rotation[2]).toBeCloseTo(Math.PI / 4);
});

it('preserves a legacy numeric depth on XY edits and makes a click a no-op', async () => {
  await reset(node({ extrude3d: 20 }));
  const before = structuredClone(api().getNodes());
  await world.click(api(), 125, 80);
  expect(api().getNodes()).toEqual(before);
  expect(api().getHistoryState().canUndo).toBe(false);
  await world.pointer(api(), 'pointerdown', 125, 80);
  await world.pointer(api(), 'pointerup', 145, 80);
  expect(wire().extrude3d).toBe(20);
  expect(wire().x).toBeCloseTo(80);
  expect(mesh().read(Transform3D).translation[2]).toBeCloseTo(-10);
});

it.each(['delete', 'disable', 'replace companion'] as const)(
  'does not resurrect stale extrusion state after %s',
  async (reason) => {
    await world.pointer(api(), 'pointerdown', 125, 80);
    await world.pointer(api(), 'pointermove', 145, 80);
    if (reason === 'delete') await world.reset(api(), []);
    else if (reason === 'disable')
      await world.edit(api(), (editor) =>
        editor.updateNode(editor.getNodeById('box'), { extrude3d: false }),
      );
    else
      await world.edit(
        api(),
        () => {
          source().write(Extrude3D).meshEntity = undefined;
        },
        'NEVER',
      );
    const before = structuredClone(api().getNodes());
    await world.pointer(api(), 'pointerup', 155, 80);
    expect(api().getNodes()).toEqual(before);
    if (reason === 'disable') {
      expect(source().has(Extrude3D)).toBe(false);
      expect(source().read(Transform).translation.x).toBe(wire().x);
    }
  },
);

it('converts canvas motion into the local coordinates of a rotated and flipped parent', async () => {
  await world.reset(api(), [
    {
      id: 'parent',
      type: 'g',
      zIndex: 0,
      x: 130,
      y: 130,
      rotation: Math.PI / 2,
      scaleX: -1,
      scaleY: 2,
    },
    node({
      x: 5,
      y: 5,
      width: 20,
      height: 20,
      parentId: 'parent',
      rotation: 0.3,
      scaleX: -1,
    }),
  ]);
  await world.edit(
    api(),
    (editor) => editor.selectNodes([editor.getNodeById('box')]),
    'NEVER',
  );
  await world.frames();
  const [cx, cy] = mesh().read(Transform3D).translation;
  await world.pointer(api(), 'pointerdown', cx + 45, cy);
  expect(mesh().read(Selected3D).dragging).toBe(true);
  await world.pointer(api(), 'pointerup', cx + 65, cy);
  await world.frames(4);
  expect(wire().x).toBeCloseTo(5);
  expect(wire().y).toBeCloseTo(-5);
  expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(cx + 20);
  expect(mesh().read(Transform3D).translation[1]).toBeCloseTo(cy);
});

it('supports linked orthographic movement without borrowing another canvas camera', async () => {
  const camera = cameras.find(
    (e) => e.read(Canvas3DScope).canvas.read(Canvas).api === api(),
  )!;
  await world.edit(
    api(),
    () => {
      camera.write(Camera3D).projection = 'orthographic';
    },
    'NEVER',
  );
  await world.pointer(api(), 'pointerdown', 125, 80);
  expect(mesh().read(Selected3D).dragging).toBe(true);
  await world.pointer(api(), 'pointerup', 145, 80);
  expect(wire().x).toBeCloseTo(80);
});

it('resets omitted extrusion pose fields like a fresh load and restores them through undo', async () => {
  const options = {
    depth: 35,
    z: 70,
    rotation: [0.2, -0.3, 0.4] as [number, number, number],
  };
  await world.edit(api(), (editor) =>
    editor.updateNode(editor.getNodeById('box'), { extrude3d: options }),
  );
  await world.frames();
  const tilted = {
    translation: [...mesh().read(Transform3D).translation],
    rotation: [...mesh().read(Transform3D).rotation],
  };
  expect(mesh().read(Transform3D).translation[2]).toBeCloseTo(52.5);
  await world.edit(api(), (editor) =>
    editor.updateNode(editor.getNodeById('box'), { extrude3d: 50 }),
  );
  await world.frames();
  expect(source().read(Extrude3D).z).toBe(0);
  expect(mesh().read(Transform3D).rotation).toEqual([0, 0, 0]);
  expect(mesh().read(Transform3D).translation[2]).toBe(-25);
  await world.history(api(), 'undo');
  await world.frames();
  expect(mesh().read(Transform3D).translation).toEqual(tilted.translation);
  expect(mesh().read(Transform3D).rotation).toEqual(tilted.rotation);
});

it('clears extrusion layer selection on an empty-canvas press', async () => {
  await world.click(api(), 185, 10);
  expect(api().getAppState().layersSelected).toEqual([]);
  expect(mesh().has(Selected3D)).toBe(false);
});
