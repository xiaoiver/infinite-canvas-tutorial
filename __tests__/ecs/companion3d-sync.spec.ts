import {
  Camera3D,
  Canvas,
  Canvas3DScope,
  ComputeBounds,
  ComputeCamera,
  EnsureExtrudeMeshes,
  EnsureMesh3DNodes,
  Extrude3D,
  Extrude3DTarget,
  Material3D,
  Mesh3DNode,
  Mesh3D,
  PostUpdate,
  Selected3D,
  SyncExtrude3D,
  SyncMesh3DNodes,
  System,
  Transform,
  Transform3D,
  system,
  type API,
  type Entity,
  type Mesh3DNodeSerializedNode,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import * as geometry from '../../packages/ecs/src/utils/geometry3d';
import {
  consumeTransformerRefreshForCanvas,
  set3DMeshGizmoSelectedForCanvas,
} from '../../packages/ecs/src/utils/pick3d-bridge';
import { createDocumentWorld } from '../helpers/ecs-document';

const mesh = (
  patch: Partial<Mesh3DNodeSerializedNode> = {},
): Mesh3DNodeSerializedNode => ({
  id: 'model',
  type: 'mesh3d',
  zIndex: 0,
  x: 10,
  y: 20,
  width: 40,
  height: 60,
  z: 15,
  ...patch,
});
const rect = (patch: Partial<RectSerializedNode> = {}): RectSerializedNode => ({
  id: 'box',
  type: 'rect',
  zIndex: 0,
  x: 10,
  y: 20,
  width: 40,
  height: 60,
  fills: [{ type: 'solid', value: '#ff0000' }],
  extrude3d: 20,
  ...patch,
});
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let second: API;
let cameras: Entity[];
const writes = {
  pose: [] as number[],
  material: [] as number[],
  geometry: [] as number[],
  source: [] as number[],
  transform: [] as number[],
};
const clearWrites = () =>
  Object.values(writes).forEach((events) => events.splice(0));
beforeAll(async () => {
  cameras = [];
  class ObserveCameras extends System {
    cameras = this.query((q) => q.current.with(Camera3D).read);
    poses = this.query((q) => q.changed.with(Transform3D).trackWrites);
    materials = this.query((q) => q.changed.with(Material3D).trackWrites);
    meshes = this.query((q) => q.changed.with(Mesh3D).trackWrites);
    sources = this.query((q) => q.changed.with(Mesh3DNode).trackWrites);
    transforms = this.query((q) => q.changed.with(Transform).trackWrites);
    execute() {
      for (const [key, query] of [
        ['pose', this.poses],
        ['material', this.materials],
        ['geometry', this.meshes],
        ['source', this.sources],
        ['transform', this.transforms],
      ] as const)
        writes[key].push(...query.changed.map((e) => e.__id));
      cameras = this.cameras.current.map((e) => e.hold());
    }
  }
  world = await createDocumentWorld(2, false, [
    () => {
      // Run the real creation/sync stages without allocating a GPU renderer.
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
      system(PostUpdate)(ObserveCameras);
      system((s) => s.after(SyncMesh3DNodes).before(ComputeCamera))(
        ObserveCameras,
      );
    },
  ]);
  [api, second] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
beforeEach(async () => {
  await world.reset(api, []);
  await world.reset(second, []);
  await world.frame();
});
const source = (id = 'model', editor = api) =>
  editor.getEntity(editor.getNodeById(id));
const companion = (id = 'model', editor = api) => {
  const e = source(id, editor);
  return e.has(Mesh3DNode)
    ? e.read(Mesh3DNode).meshEntity!
    : e.read(Extrude3D).meshEntity!;
};

it('follows transform-only movement without a Mesh3DNode write', async () => {
  await world.reset(api, [mesh()]);
  // Let companion creation and its tracked writes settle before the change.
  await world.frame();
  await world.frame();
  const target = companion();
  expect(target.read(Transform3D).translation).toEqual([30, 50, 15]);
  await world.edit(
    api,
    () => {
      Object.assign(source().write(Transform).translation, { x: 70, y: 90 });
    },
    'NEVER',
  );
  expect(companion()).toBe(target);
  expect(target.read(Transform3D).translation).toEqual([90, 120, 15]);
});

it('copies gizmo transforms back to the source on consecutive drag frames', async () => {
  await world.reset(api, [mesh()]);
  // Let companion creation and its tracked writes settle before the change.
  await world.frame();
  await world.frame();
  const target = companion();
  for (const x of [100, 140, 180]) {
    await world.edit(
      api,
      () => {
        if (!target.has(Selected3D)) target.add(Selected3D, { dragging: true });
        Object.assign(target.write(Transform3D), {
          translation: [x, 200, 30],
          rotation: [0.2, 0.4, 0.6],
          scale: [2, 3, 4],
        });
      },
      'NEVER',
    );
    expect(source().read(Transform).translation.x).toBe(x - 20);
    expect(source().read(Transform).translation.y).toBe(170);
    expect(source().read(Mesh3DNode).z).toBe(30);
    expect(source().read(Mesh3DNode).rotation3d).toEqual([0.2, 0.4, 0.6]);
    expect(source().read(Mesh3DNode).scale3d).toEqual([2, 3, 4]);
  }
  await world.edit(
    api,
    () => {
      target.write(Selected3D).dragging = false;
    },
    'NEVER',
  );
  expect(target.read(Transform3D).translation).toEqual([180, 200, 30]);
  await world.edit(
    api,
    () => {
      source().write(Transform).translation.x = 210;
    },
    'NEVER',
  );
  expect(target.read(Transform3D).translation).toEqual([230, 200, 30]);
});

it('creates one scoped extrusion and camera per canvas, then synchronizes their fill and bounds', async () => {
  await world.reset(api, [rect()]);
  await world.reset(second, [
    rect({ fills: [{ type: 'solid', value: '#0000ff' }] }),
  ]);
  const left = companion('box');
  const right = companion('box', second);
  expect(left).not.toBe(right);
  expect(left.read(Canvas3DScope).canvas.read(Canvas).api).toBe(api);
  expect(right.read(Canvas3DScope).canvas.read(Canvas).api).toBe(second);
  expect(left.read(Transform3D).translation).toEqual([30, 50, -10]);
  expect(left.read(Transform3D).scale).toEqual([40, 60, 20]);
  expect(left.read(Material3D).baseColor).toEqual([1, 0, 0, 1]);
  expect(right.read(Material3D).baseColor).toEqual([0, 0, 1, 1]);
  await world.frame();
  await world.frame();
  expect(companion('box')).toBe(left);
  expect(companion('box', second)).toBe(right);
  expect(cameras).toHaveLength(2);
  expect(
    cameras.filter(
      (e) => e.read(Canvas3DScope).canvas.read(Canvas).api === api,
    ),
  ).toHaveLength(1);
});

it('deletes a replaced extrusion companion while preserving the replacement', async () => {
  await world.reset(api, [rect()]);
  const old = companion('box');
  await world.edit(
    api,
    () => {
      source('box').write(Extrude3D).meshEntity = undefined;
    },
    'NEVER',
  );
  const replacement = companion('box');
  expect(replacement).not.toBe(old);
  expect(old.alive).toBe(false);
  expect(replacement.alive).toBe(true);
  expect(replacement.read(Extrude3DTarget).source.isSame(source('box'))).toBe(
    true,
  );
});

it('updates material during a uniform gizmo drag without replacing its pose', async () => {
  await world.reset(api, [mesh()]);
  await world.frame();
  await world.frame();
  const target = companion();
  await world.edit(
    api,
    () => {
      target.add(Selected3D, { dragging: true });
      Object.assign(target.write(Transform3D), {
        translation: [80, 90, 25],
        scale: [3, 3, 3],
      });
    },
    'NEVER',
  );
  await world.edit(
    api,
    () => {
      source().write(Mesh3DNode).baseColor = [0, 1, 0, 0.5];
      target.write(Transform3D).translation = [120, 130, 35];
    },
    'NEVER',
  );
  expect(source().read(Mesh3DNode).scale3d).toBe(3);
  expect(source().read(Transform).translation.x).toBe(100);
  expect(target.read(Transform3D).translation).toEqual([120, 130, 35]);
  expect(target.read(Material3D).baseColor).toEqual([0, 1, 0, 0.5]);
});

it('keeps companion material governed by the source on ordinary frames', async () => {
  await world.reset(api, [
    mesh({ material3d: { baseColor: '#00ff00', map: 'texture.png' } }),
  ]);
  await world.frame();
  await world.frame();
  const target = companion();
  await world.edit(
    api,
    () => {
      Object.assign(target.write(Material3D), {
        baseColor: [1, 0, 0, 1],
        map: 'stale.png',
      });
    },
    'NEVER',
  );
  expect(target.read(Material3D).baseColor).toEqual([0, 1, 0, 1]);
  expect(target.read(Material3D).map).toBe('texture.png');
});

it('adds a gizmo to an existing selected mesh only on its own canvas', async () => {
  await world.reset(api, [mesh()]);
  await world.reset(second, [mesh()]);
  await world.frame();
  await world.frame();
  const left = companion();
  const right = companion('model', second);
  expect(left.has(Selected3D)).toBe(false);
  expect(right.has(Selected3D)).toBe(false);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById('model')]),
    'NEVER',
  );
  expect(left.has(Selected3D)).toBe(true);
  expect(left.read(Selected3D).dragging).toBe(false);
  expect(right.has(Selected3D)).toBe(false);
});

it('updates an extrusion after movement, resize, depth and fill changes', async () => {
  await world.reset(api, [rect()]);
  await world.frame();
  const target = companion('box');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('box'), {
      x: 30,
      y: 40,
      width: 80,
      height: 100,
      extrude3d: 50,
      fills: [{ type: 'solid', value: '#00ff00', opacity: 0.25 }],
    }),
  );
  expect(companion('box')).toBe(target);
  expect(target.read(Transform3D).translation).toEqual([70, 90, -25]);
  expect(target.read(Transform3D).scale).toEqual([80, 100, 50]);
  expect(target.read(Material3D).baseColor).toEqual([0, 1, 0, 0.25]);
});

it('keeps the last valid extrusion transform while its bounds are empty', async () => {
  await world.reset(api, [rect()]);
  const target = companion('box');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('box'), { width: 0, x: 100 }),
  );
  expect(target.read(Transform3D).translation).toEqual([30, 50, -10]);
  expect(target.read(Transform3D).scale).toEqual([40, 60, 20]);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('box'), { width: 80 }),
  );
  expect(target.read(Transform3D).translation).toEqual([140, 50, -10]);
  expect(target.read(Transform3D).scale).toEqual([80, 60, 20]);
});

it('supports a legacy extrusion companion in Y-up coordinates', async () => {
  await world.reset(api, [rect()]);
  const target = companion('box');
  await world.edit(
    api,
    () => {
      target.write(Extrude3DTarget).unifiedSpace = false;
    },
    'NEVER',
  );
  expect(target.read(Transform3D).translation).toEqual([30, -50, -10]);
});

it('removes the extrusion mesh when the rect becomes two-dimensional again', async () => {
  await world.reset(api, [rect()]);
  const target = companion('box');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('box'), { extrude3d: false }),
  );
  expect(source('box').has(Extrude3D)).toBe(false);
  expect(target.alive).toBe(false);
});

for (const [kind, makeNode] of [
  ['mesh', mesh],
  ['extrusion', rect],
] as const) {
  it(`cleans up a deleted ${kind} without touching another canvas`, async () => {
    const node = makeNode();
    await world.reset(api, [node]);
    await world.reset(second, [makeNode()]);
    const target = companion(node.id);
    const other = companion(node.id, second);
    await world.reset(api, []);
    await world.frame();
    expect(target.alive).toBe(false);
    expect(other.alive).toBe(true);
    expect(companion(node.id, second)).toBe(other);
  });

  it(`recreates a deleted ${kind} companion exactly once`, async () => {
    const node = makeNode();
    await world.reset(api, [node]);
    const target = companion(node.id);
    await world.edit(
      api,
      () => {
        target.delete();
      },
      'NEVER',
    );
    const replacement = companion(node.id);
    expect(replacement).toBeDefined();
    expect(replacement).not.toBe(target);
    expect(replacement.alive).toBe(true);
    await world.frame();
    await world.frame();
    expect(companion(node.id)).toBe(replacement);
  });
}

it('cleans up a replaced mesh companion while keeping the new mesh alive', async () => {
  await world.reset(api, [mesh()]);
  const target = companion();
  await world.edit(
    api,
    () => {
      source().write(Mesh3DNode).meshEntity = undefined;
    },
    'NEVER',
  );
  const replacement = companion();
  expect(replacement).not.toBe(target);
  expect(target.alive).toBe(false);
  expect(replacement.alive).toBe(true);
});

for (const makeNode of [mesh, rect]) {
  it(`does not dirty an idle ${makeNode().type} companion`, async () => {
    const node = makeNode();
    await world.reset(api, [node]);
    await world.edit(
      api,
      (editor) => editor.selectNodes([editor.getNodeById(node.id)]),
      'NEVER',
    );
    for (let i = 0; i < 3; i++) await world.frame();
    const target = companion(node.id);
    clearWrites();
    for (let i = 0; i < 5; i++) await world.frame();
    for (const key of ['pose', 'material', 'geometry'] as const)
      expect(writes[key].filter((id) => id === target.__id)).toEqual([]);
  });

  it(`invalidates pose and material independently for ${
    makeNode().type
  }`, async () => {
    const node = makeNode();
    await world.reset(api, [node]);
    for (let i = 0; i < 3; i++) await world.frame();
    const target = companion(node.id);
    const positions = target.read(Mesh3D).positions;
    clearWrites();
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById(node.id), { x: 50 }),
    );
    await world.frame();
    expect(writes.pose).toContain(target.__id);
    expect(writes.material).not.toContain(target.__id);
    expect(writes.geometry).not.toContain(target.__id);
    clearWrites();
    await world.edit(api, (editor) =>
      editor.updateNode(
        editor.getNodeById(node.id),
        node.type === 'mesh3d'
          ? { material3d: { baseColor: '#00ff00', roughness: 0.3 } }
          : { fills: [{ type: 'solid', value: '#00ff00' }] },
      ),
    );
    await world.frame();
    expect(writes.material).toContain(target.__id);
    expect(writes.pose).not.toContain(target.__id);
    expect(writes.geometry).not.toContain(target.__id);
    expect(target.read(Mesh3D).positions).toBe(positions);
    expect(target.read(Material3D).baseColor).toEqual([0, 1, 0, 1]);
  });
}

it('does not rewrite a stationary drag preview after float32 conversion', async () => {
  await world.reset(api, [mesh()]);
  const target = companion();
  await world.edit(
    api,
    () => {
      target.add(Selected3D, { dragging: true });
      target.write(Transform3D).translation = [
        80.123456789, 90.123456789, 0.123456789,
      ];
    },
    'NEVER',
  );
  for (let i = 0; i < 3; i++) await world.frame();
  clearWrites();
  for (let i = 0; i < 5; i++) await world.frame();
  expect(writes.source).not.toContain(source().__id);
  expect(writes.transform).not.toContain(source().__id);
  expect(writes.geometry).not.toContain(target.__id);
});

it('reuses procedural geometry across pose/material edits and rebuilds on a geometry edit', async () => {
  await world.reset(api, [
    mesh({
      geometry: { type: 'sphere', segments: [32, 16] },
    }),
  ]);
  for (let i = 0; i < 3; i++) await world.frame();
  const target = companion();
  const positions = target.read(Mesh3D).positions;
  const create = jest.spyOn(geometry, 'createGeometry');
  try {
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('model'), {
        z: 25,
        rotation3d: [0.1, 0.2, 0.3],
      }),
    );
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('model'), {
        material3d: { roughness: 0.25 },
      }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(target.read(Mesh3D).positions).toBe(positions);
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('model'), { geometry: 'cube' }),
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(target.read(Mesh3D).positions).not.toBe(positions);
    await world.frame();
    expect(create).toHaveBeenCalledTimes(1);
  } finally {
    create.mockRestore();
  }
});

it('only requests transformer refresh when 3D selection changes', async () => {
  await world.edit(
    api,
    () => {
      const canvas = api.getCanvas();
      set3DMeshGizmoSelectedForCanvas(canvas, true);
      consumeTransformerRefreshForCanvas(canvas);
      set3DMeshGizmoSelectedForCanvas(canvas, true);
      expect(consumeTransformerRefreshForCanvas(canvas)).toBe(false);
      set3DMeshGizmoSelectedForCanvas(canvas, false);
      expect(consumeTransformerRefreshForCanvas(canvas)).toBe(true);
      expect(consumeTransformerRefreshForCanvas(canvas)).toBe(false);
    },
    'NEVER',
  );
});
