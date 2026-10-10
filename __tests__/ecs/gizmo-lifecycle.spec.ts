import { is3DGizmoDragging } from '../../packages/ecs/src/utils/pick3d-bridge';
import {
  Pen,
  Camera3D,
  Canvas3DScope,
  Canvas,
  System,
  type Entity,
  CameraSync,
  ComputeBounds,
  ComputeCamera,
  EnsureMesh3DNodes,
  SyncMesh3DNodes,
  Pick3D,
  Select,
  PostUpdate,
  Last,
  system,
  Mesh3DNode,
  Transform3D,
  Selected3D,
  type API,
  type Mesh3DNodeSerializedNode,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

const node = (): Mesh3DNodeSerializedNode => ({
  id: 'model',
  type: 'mesh3d',
  zIndex: 0,
  x: 60,
  y: 60,
  width: 40,
  height: 40,
  scale3d: 20,
});
let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
let cameras: Entity[] = [];
beforeAll(async () => {
  class ObserveCameras extends System {
    cameras = this.query((q) => q.current.with(Camera3D));
    execute() {
      cameras = this.cameras.current.map((e) => e.hold());
    }
  }
  world = await createSelectionWorld(2, [
    () => {
      system((s) => s.after(Pick3D).before(Last))(ObserveCameras);
      system(PostUpdate)(EnsureMesh3DNodes);
      system((s) => s.after(ComputeBounds).before(ComputeCamera))(
        EnsureMesh3DNodes,
      );
      system(PostUpdate)(SyncMesh3DNodes);
      system((s) => s.after(EnsureMesh3DNodes).before(ComputeCamera))(
        SyncMesh3DNodes,
      );
      system((s) =>
        s.inAnyOrderWith(s.allSystems).after(CameraSync, Select).before(Last),
      )(Pick3D);
    },
  ]);
  [api] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
const mesh = () =>
  api.getEntity(api.getNodeById('model')).read(Mesh3DNode).meshEntity!;
beforeEach(async () => {
  for (const editor of world.apis) {
    await world.pointer(editor, 'pointercancel', 190, 190);
    await world.reset(editor, []);
    await world.edit(
      editor,
      (e) => {
        e.setAppState({ penbarSelected: Pen.SELECT });
        e.gotoLandmark({ x: 0, y: 0, zoom: 1, rotation: 0 }, { duration: 0 });
      },
      'NEVER',
    );
  }
  await world.edit(
    api,
    () => {
      for (const camera of cameras)
        camera.write(Camera3D).projection = 'perspective';
    },
    'NEVER',
  );
  await world.reset(api, [node()]);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById('model')]),
    'NEVER',
  );
  await world.frames();
  api.clearHistory();
});

it('drags the X arrow and commits the release position to document/history', async () => {
  await world.pointer(api, 'pointerdown', 125, 80);
  expect(mesh().read(Selected3D).activeAxis).toBe('x');
  expect(mesh().read(Selected3D).dragging).toBe(true);
  await world.pointer(api, 'pointermove', 135, 80);
  expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(90);
  await world.pointer(api, 'pointerup', 145, 80);
  expect(api.getNodeById('model').x).toBeCloseTo(80);
  await world.history(api, 'undo');
  await world.frames();
  expect(api.getNodeById('model').x).toBe(60);
  await world.history(api, 'redo');
  await world.frames();
  expect(api.getNodeById('model').x).toBeCloseTo(80);
});

it('cancels a Y-arrow preview without changing the document', async () => {
  await world.pointer(api, 'pointerdown', 80, 125);
  expect(mesh().read(Selected3D).dragging).toBe(true);
  await world.pointer(api, 'pointermove', 80, 145);
  expect(mesh().read(Transform3D).translation[1]).toBeCloseTo(100);
  await world.pointer(api, 'pointercancel', 80, 145);
  expect(mesh().read(Transform3D).translation[1]).toBeCloseTo(80);
  expect(mesh().read(Selected3D).dragging).toBe(false);
  expect(api.getNodeById('model').y).toBe(60);
});

it.each(['touch', 'pen'] as const)(
  'commits a %s drag with one undo step and can reload it',
  async (pointerType) => {
    const events: number[] = [];
    const unsubscribe = api.subscribe((_snapshot, changes) => {
      if (changes.nodesChanged) events.push(1);
    });
    try {
      await world.pointer(api, 'pointerdown', 80, 125, { pointerType });
      await world.pointer(api, 'pointermove', 80, 135, { pointerType });
      await world.pointer(api, 'pointermove', 80, 145, { pointerType });
      expect(api.getNodeById('model').y).toBe(60);
      expect(events).toHaveLength(0);
      await world.pointer(api, 'pointerup', 80, 155, { pointerType });
      expect(api.getNodeById('model').y).toBeCloseTo(90);
      expect(events).toHaveLength(1);
      const other = world.apis[1];
      await world.reset(other, structuredClone(api.getNodes()));
      await world.frames();
      const reloaded = other
        .getEntity(other.getNodeById('model'))
        .read(Mesh3DNode).meshEntity!;
      expect(reloaded.read(Transform3D).translation[1]).toBeCloseTo(110);
      await world.history(api, 'undo');
      await world.frames();
      expect(api.getNodeById('model').y).toBe(60);
      expect(api.getHistoryState().canUndo).toBe(false);
    } finally {
      unsubscribe();
    }
  },
);

it('handles down, move and up arriving before one ECS frame', async () => {
  world.dispatch(api, 'pointerdown', 80, 125);
  world.dispatch(api, 'pointermove', 80, 140);
  world.dispatch(api, 'pointerup', 80, 150);
  await world.frames();
  expect(api.getNodeById('model').y).toBeCloseTo(85);
  expect(mesh().read(Selected3D).dragging).toBe(false);
});

it('does not add history or change version for a handle click without movement', async () => {
  const before = structuredClone(api.getNodes());
  await world.click(api, 80, 125);
  expect(api.getNodes()).toEqual(before);
  expect(api.getHistoryState().canUndo).toBe(false);
});

it.each(['Escape', 'pointerleave', 'tool'] as const)(
  'rolls back on %s and ignores the old release',
  async (reason) => {
    const before = structuredClone(api.getNodes());
    await world.pointer(api, 'pointerdown', 80, 125);
    await world.pointer(api, 'pointermove', 80, 145);
    if (reason === 'Escape') await world.key(api, 'Escape');
    else if (reason === 'pointerleave')
      await world.pointer(api, 'pointerleave', 205, 145);
    else
      await world.edit(
        api,
        (editor) => editor.setAppState({ penbarSelected: Pen.HAND }),
        'NEVER',
      );
    expect(mesh().read(Transform3D).translation[1]).toBeCloseTo(80);
    if (mesh().has(Selected3D))
      expect(mesh().read(Selected3D).dragging).toBe(false);
    await world.pointer(api, 'pointerup', 80, 160);
    expect(api.getNodes()).toEqual(before);
  },
);

it('keeps a drag active while another canvas receives a click', async () => {
  const other = world.apis[1];
  await world.reset(other, [
    {
      id: 'rect',
      type: 'rect',
      zIndex: 0,
      x: 20,
      y: 20,
      width: 30,
      height: 30,
    },
  ]);
  await world.pointer(api, 'pointerdown', 80, 125);
  await world.pointer(api, 'pointermove', 80, 140);
  expect(is3DGizmoDragging(api.getCanvas())).toBe(true);
  expect(is3DGizmoDragging(other.getCanvas())).toBe(false);
  await world.click(other, 30, 30);
  expect(other.getAppState().layersSelected).toContain('rect');
  expect(is3DGizmoDragging(api.getCanvas())).toBe(true);
  await world.pointer(api, 'pointerup', 80, 155);
  expect(api.getNodeById('model').y).toBeCloseTo(90);
  expect(is3DGizmoDragging(api.getCanvas())).toBe(false);
});

it('drops a session when its source is deleted without resurrecting it', async () => {
  await world.pointer(api, 'pointerdown', 80, 125);
  await world.pointer(api, 'pointermove', 80, 145);
  await world.reset(api, []);
  await world.pointer(api, 'pointerup', 80, 155);
  expect(api.getNodes()).toEqual([]);
  expect(is3DGizmoDragging(api.getCanvas())).toBe(false);
});

it('uses an actual orthographic camera for the X-arrow drag', async () => {
  const camera = cameras.find(
    (e) => e.read(Canvas3DScope).canvas.read(Canvas).api === api,
  )!;
  await world.edit(
    api,
    () => {
      camera.write(Camera3D).projection = 'orthographic';
    },
    'NEVER',
  );
  expect(camera.read(Camera3D).projection).toBe('orthographic');
  await world.frames();
  await world.pointer(api, 'pointerdown', 125, 80);
  expect(mesh().read(Selected3D).dragging).toBe(true);
  await world.pointer(api, 'pointerup', 145, 80);
  expect(api.getNodeById('model').x).toBeCloseTo(80);
});

it('commits rotation and restores it through undo/redo', async () => {
  const radius = 100 * Math.tan(Math.PI / 8) * 1.5 * 0.825;
  await world.pointer(
    api,
    'pointerdown',
    80 + radius / Math.SQRT2,
    80 + radius / Math.SQRT2,
  );
  expect(mesh().read(Selected3D).activePartKind).toBe('rotate');
  expect(mesh().read(Selected3D).activeAxis).toBe('z');
  await world.pointer(api, 'pointerup', 80, 80 + radius);
  expect(
    (api.getNodeById('model') as Mesh3DNodeSerializedNode).rotation3d![2],
  ).toBeCloseTo(Math.PI / 4);
  await world.history(api, 'undo');
  await world.frames();
  expect(mesh().read(Transform3D).rotation[2]).toBeCloseTo(0);
  await world.history(api, 'redo');
  await world.frames();
  expect(mesh().read(Transform3D).rotation[2]).toBeCloseTo(Math.PI / 4);
});

it.each(['xy', 'xz', 'yz'] as const)(
  'picks and drags the displayed %s plane without snapping on press',
  async (axis) => {
    const z = 30;
    await world.reset(api, [{ ...node(), z }]);
    await world.edit(
      api,
      (editor) => editor.selectNodes([editor.getNodeById('model')]),
      'NEVER',
    );
    await world.frames();
    api.clearHistory();
    const size = 150 * Math.tan(Math.PI / 8);
    const eyeZ = 100 / Math.tan(Math.PI / 8);
    const project = ([x, y, depth]: number[]) => {
      const scale = 1 - depth / (eyeZ - z);
      const length = Math.hypot(0.5, 0.55);
      return [
        80 + x * scale + (depth * 0.5) / length,
        80 + y * scale + (depth * 0.55) / length,
      ];
    };
    const press = project(
      axis === 'xy'
        ? [size * 0.38, size * 0.26, 0]
        : axis === 'xz'
        ? [size * 0.325, 0, size * 0.325]
        : [0, size * 0.325, size * 0.325],
    );
    const delta =
      axis === 'xy' ? [10, 5, 0] : axis === 'xz' ? [10, 0, 5] : [0, 10, 5];
    const target = project(delta);
    await world.pointer(api, 'pointerdown', press[0], press[1]);
    expect(mesh().read(Selected3D).activeAxis).toBe(axis);
    expect(mesh().read(Selected3D).dragging).toBe(true);
    expect(mesh().read(Transform3D).translation).toEqual([80, 80, z]);
    await world.pointer(
      api,
      'pointerup',
      press[0] + target[0] - 80,
      press[1] + target[1] - 80,
    );
    const updated = api.getNodeById('model') as Mesh3DNodeSerializedNode;
    expect(updated.x).toBeCloseTo(60 + delta[0], 3);
    expect(updated.y).toBeCloseTo(60 + delta[1], 3);
    expect(updated.z).toBeCloseTo(z + delta[2], 3);
    await world.history(api, 'undo');
    await world.frames();
    expect(mesh().read(Transform3D).translation).toEqual([80, 80, z]);
  },
);

it.each([
  { zoom: 1, rotation: 0, z: 0 },
  { zoom: 2, rotation: 0.3, z: 40 },
  { zoom: 0.75, rotation: -0.4, z: -30 },
])(
  'drags the displayed linked Z axis at $zoom zoom and depth $z',
  async ({ zoom, rotation, z }) => {
    await world.reset(api, [{ ...node(), z }]);
    await world.edit(
      api,
      (editor) => {
        editor.selectNodes([editor.getNodeById('model')]);
        editor.gotoLandmark({ x: 20, y: 15, zoom, rotation }, { duration: 0 });
      },
      'NEVER',
    );
    await world.frames();
    api.clearHistory();
    const center = api.canvas2Viewport({ x: 80, y: 80 });
    const length = Math.hypot(0.5, 0.55);
    const dx = 0.5 / length;
    const dy = 0.55 / length;
    // Independently use the visible arrow's default CSS size and direction.
    const distance = 150 * Math.tan(Math.PI / 8) * 0.6;
    const x = center.x + dx * distance;
    const y = center.y + dy * distance;
    await world.pointer(api, 'pointerdown', x, y);
    expect(mesh().read(Selected3D).activeAxis).toBe('z');
    expect(mesh().read(Selected3D).activePartKind).toBe('translate');
    expect(mesh().read(Selected3D).dragging).toBe(true);
    await world.pointer(api, 'pointermove', x + dx * 10, y + dy * 10);
    await world.pointer(api, 'pointerup', x + dx * 20, y + dy * 20);
    expect(
      (api.getNodeById('model') as Mesh3DNodeSerializedNode).z,
    ).toBeCloseTo(z + 20 / zoom, 2);
    expect(api.getNodeById('model').x).toBeCloseTo(60);
    expect(api.getNodeById('model').y).toBeCloseTo(60);
    await world.history(api, 'undo');
    await world.frames();
    expect(mesh().read(Transform3D).translation[2]).toBeCloseTo(z);
  },
);

it('converts movement through a rotated and flipped parent without drifting after release', async () => {
  await world.reset(api, [
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
    {
      ...node(),
      x: 5,
      y: 5,
      width: 20,
      height: 20,
      parentId: 'parent',
      rotation: 0.3,
      scaleX: -1,
    },
  ]);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById('model')]),
    'NEVER',
  );
  await world.frames();
  const [cx, cy] = mesh().read(Transform3D).translation;
  const start = api.canvas2Viewport({ x: cx + 45, y: cy });
  await world.pointer(api, 'pointerdown', start.x, start.y);
  expect(mesh().read(Selected3D).dragging).toBe(true);
  await world.pointer(api, 'pointermove', start.x + 20, start.y);
  await world.pointer(api, 'pointerup', start.x + 20, start.y);
  const updated = api.getNodeById('model');
  expect(updated.x).toBeCloseTo(5);
  expect(updated.y).toBeCloseTo(-5);
  await world.frames(4);
  expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(cx + 20);
  expect(mesh().read(Transform3D).translation[1]).toBeCloseTo(cy);
});

it('finishes one canvas gesture without clearing another canvas gesture', async () => {
  const other = world.apis[1];
  await world.reset(other, [node()]);
  await world.edit(
    other,
    (editor) => editor.selectNodes([editor.getNodeById('model')]),
    'NEVER',
  );
  await world.frames();
  await world.pointer(api, 'pointerdown', 80, 125);
  await world.pointer(other, 'pointerdown', 125, 80);
  expect(is3DGizmoDragging(api.getCanvas())).toBe(true);
  expect(is3DGizmoDragging(other.getCanvas())).toBe(true);
  await world.pointer(other, 'pointerup', 140, 80);
  expect(other.getNodeById('model').x).toBeCloseTo(75);
  expect(is3DGizmoDragging(other.getCanvas())).toBe(false);
  expect(is3DGizmoDragging(api.getCanvas())).toBe(true);
  await world.pointer(api, 'pointerup', 80, 145);
  expect(api.getNodeById('model').y).toBeCloseTo(80);
  expect(is3DGizmoDragging(api.getCanvas())).toBe(false);
});

it('leaves a model unchanged when its parent transform is singular', async () => {
  await world.reset(api, [
    { id: 'parent', type: 'g', zIndex: 0, x: 80, y: 80, scaleX: 0, scaleY: 0 },
    { ...node(), parentId: 'parent' },
  ]);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById('model')]),
    'NEVER',
  );
  await world.frames();
  const before = structuredClone(api.getNodes());
  await world.pointer(api, 'pointerdown', 125, 80);
  await world.pointer(api, 'pointerup', 145, 80);
  expect(api.getNodes()).toEqual(before);
  expect(mesh().read(Transform3D).translation).toEqual([80, 80, 0]);
});

it('does not begin a gizmo drag with the middle mouse button', async () => {
  const before = structuredClone(api.getNodes());
  await world.pointer(api, 'pointerdown', 80, 125, { button: 1 });
  expect(is3DGizmoDragging(api.getCanvas())).toBe(false);
  await world.pointer(api, 'pointerup', 80, 125, { button: 1 });
  expect(api.getNodes()).toEqual(before);
});
