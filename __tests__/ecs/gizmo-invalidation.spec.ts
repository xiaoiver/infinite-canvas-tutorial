import {
  Camera3D,
  Canvas,
  Canvas3DScope,
  CameraSync,
  ComputeBounds,
  ComputeCamera,
  EnsureExtrudeMeshes,
  EnsureMesh3DNodes,
  Extrude3D,
  Mesh3DNode,
  Pick3D,
  Select,
  PostUpdate,
  Last,
  Selected3D,
  SyncExtrude3D,
  SyncMesh3DNodes,
  System,
  Transform3D,
  system,
  type Entity,
  type SerializedNode,
} from '../../packages/ecs/src';
import { captureGizmoSource } from '../../packages/ecs/src/systems/pick3d/gizmo-source';
import { createSelectionWorld } from '../helpers/ecs-selection';
import { is3DGizmoDragging } from '../../packages/ecs/src/utils/pick3d-bridge';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let cameras: Entity[] = [];
const api = () => world.apis[0];
const camera = () =>
  cameras.find((e) => e.read(Canvas3DScope).canvas.read(Canvas).api === api())!;
const mesh = () => {
  const source = api().getEntity(api().getNodeById('model'));
  return source.has(Mesh3DNode)
    ? source.read(Mesh3DNode).meshEntity!
    : source.read(Extrude3D).meshEntity!;
};
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
      system((s) => s.after(Pick3D).before(Last))(ObserveCameras);
    },
  ]);
});
afterAll(async () => {
  await world?.dispose();
});

for (const type of ['mesh3d', 'rect'] as const) {
  describe(type, () => {
    beforeEach(async () => {
      for (const editor of world.apis) {
        await world.pointer(editor, 'pointercancel', 190, 190);
        await world.reset(editor, []);
        await world.edit(
          editor,
          (e) => {
            e.gotoLandmark(
              { x: 0, y: 0, zoom: 1, rotation: 0 },
              { duration: 0 },
            );
            e.getCanvas().write(Canvas).width = 200;
          },
          'NEVER',
        );
      }
      const node: SerializedNode = {
        id: 'model',
        type,
        zIndex: 0,
        x: 60,
        y: 60,
        width: 40,
        height: 40,
        ...(type === 'mesh3d'
          ? { scale3d: 20 }
          : { extrude3d: { depth: 20, z: 10 } }),
        parentId: 'parent',
      };
      await world.reset(api(), [
        { id: 'parent', type: 'g', zIndex: 0, x: 0, y: 0 },
        node,
      ]);
      await world.edit(
        api(),
        (e) => {
          e.selectNodes([e.getNodeById('model')]);
          Object.assign(camera().write(Camera3D), {
            linked: true,
            projection: 'perspective',
            fovy: Math.PI / 4,
          });
        },
        'NEVER',
      );
      await world.frames();
      api().clearHistory();
    });
    async function drag() {
      await world.pointer(api(), 'pointerdown', 125, 80);
      expect(mesh().read(Selected3D).dragging).toBe(true);
      await world.pointer(api(), 'pointermove', 145, 80);
      expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(100);
      expect(api().getNodeById('model').x).toBe(60);
    }
    async function released() {
      await world.frames(3);
      expect(is3DGizmoDragging(api().getCanvas())).toBe(false);
      expect(mesh().read(Selected3D).dragging).toBe(false);
      const doc = structuredClone(api().getNodes());
      const pose = [...mesh().read(Transform3D).translation];
      await world.pointer(api(), 'pointerup', 175, 80);
      expect(api().getNodes()).toEqual(doc);
      expect(mesh().read(Transform3D).translation).toEqual(pose);
      expect(api().getHistoryState().canUndo).toBe(false);
    }

    it.each([
      'pan',
      'zoom',
      'rotation',
      'projection',
      'fovy',
      'viewport',
      'camera linkage',
    ])(
      'cancels a preview when %s changes and ignores its late release',
      async (reason) => {
        await drag();
        await world.edit(
          api(),
          (e) => {
            if (reason === 'projection')
              camera().write(Camera3D).projection = 'orthographic';
            else if (reason === 'fovy')
              camera().write(Camera3D).fovy = Math.PI / 3;
            else if (reason === 'viewport')
              e.getCanvas().write(Canvas).width = 300;
            else if (reason === 'camera linkage')
              camera().write(Camera3D).linked = false;
            else
              e.gotoLandmark(
                {
                  x: reason === 'pan' ? 10 : 0,
                  y: 0,
                  zoom: reason === 'zoom' ? 2 : 1,
                  rotation: reason === 'rotation' ? 0.3 : 0,
                },
                { duration: 0 },
              );
          },
          'NEVER',
        );
        await released();
        expect(mesh().read(Transform3D).translation).toEqual([80, 80, 0]);
      },
    );

    it.each(['source', 'parent', 'size', '3d pose'])(
      'preserves an external %s edit instead of publishing the old gesture',
      async (reason) => {
        await drag();
        await world.edit(
          api(),
          (e) =>
            e.updateNode(
              e.getNodeById(reason === 'parent' ? 'parent' : 'model'),
              reason === 'size'
                ? { width: 80 }
                : reason === '3d pose'
                ? type === 'mesh3d'
                  ? { z: 30, rotation3d: [0.2, 0, 0], scale3d: 25 }
                  : { extrude3d: { depth: 30, z: 45, rotation: [0.2, 0, 0] } }
                : { x: 30 },
            ),
          'NEVER',
        );
        await released();
        expect(mesh().read(Transform3D).translation[0]).toBeCloseTo(
          reason === 'source'
            ? 50
            : reason === 'parent'
            ? 110
            : reason === 'size'
            ? 100
            : 80,
        );
        expect(mesh().read(Transform3D).translation[2]).toBe(
          reason === '3d pose' ? 30 : 0,
        );
        if (reason === '3d pose')
          expect(mesh().read(Transform3D).rotation[0]).toBeCloseTo(0.2);
      },
    );

    it('restores a runtime-only source preview when no document is supplied', async () => {
      await world.edit(
        api(),
        () => {
          const binding = captureGizmoSource(mesh())!;
          const initial = mesh().read(Transform3D);
          const pose = {
            translation: [100, 80, 0] as [number, number, number],
            rotation: [...initial.rotation] as [number, number, number],
            scale: [...initial.scale] as [number, number, number],
          };
          expect(binding.preview(pose)).toBe(true);
          binding.restore();
        },
        'NEVER',
      );
      await world.frames();
      expect(mesh().read(Transform3D).translation).toEqual([80, 80, 0]);
      expect(api().getHistoryState().canUndo).toBe(false);
    });

    it('drops a gesture while its camera is absent and can restore that camera', async () => {
      await drag();
      const old = camera();
      await world.edit(api(), () => old.remove(Camera3D), 'NEVER');
      await released();
      await world.edit(
        api(),
        () =>
          old.add(
            Camera3D,
            new Camera3D({ linked: true, projection: 'perspective' }),
          ),
        'NEVER',
      );
      await world.frames();
      expect(mesh().read(Transform3D).translation).toEqual([80, 80, 0]);
    });

    it('cancels against the document restored by undo', async () => {
      await world.edit(api(), (e) =>
        e.updateNode(e.getNodeById('model'), { x: 70 }),
      );
      await world.frames();
      await world.pointer(api(), 'pointerdown', 135, 80);
      await world.pointer(api(), 'pointermove', 155, 80);
      expect(mesh().read(Selected3D).dragging).toBe(true);
      await world.history(api(), 'undo');
      await released();
      expect(api().getNodeById('model').x).toBe(60);
      expect(mesh().read(Transform3D).translation).toEqual([80, 80, 0]);
      expect(api().getHistoryState().canRedo).toBe(true);
    });

    it('merges an unrelated external edit and commits just one pose change', async () => {
      await drag();
      await world.edit(
        api(),
        (e) =>
          e.updateNode(e.getNodeById('model'), {
            name: 'renamed',
            ...(type === 'mesh3d'
              ? { material3d: { baseColor: '#ff0000' } }
              : { fills: [{ type: 'solid', value: '#ff0000' }] }),
          }),
        'NEVER',
      );
      await world.frames();
      expect(mesh().read(Selected3D).dragging).toBe(true);
      await world.pointer(api(), 'pointerup', 155, 80);
      expect(api().getNodeById('model').x).toBeCloseTo(90);
      expect(api().getNodeById('model').name).toBe('renamed');
      await world.history(api(), 'undo');
      await world.frames();
      expect(api().getNodeById('model').x).toBe(60);
      expect(api().getNodeById('model').name).toBe('renamed');
      expect(api().getHistoryState().canUndo).toBe(false);
    });

    it('keeps the gesture when an independent canvas camera changes', async () => {
      await drag();
      await world.edit(
        world.apis[1],
        (e) => e.gotoLandmark({ x: 20, zoom: 2 }, { duration: 0 }),
        'NEVER',
      );
      expect(mesh().read(Selected3D).dragging).toBe(true);
      await world.pointer(api(), 'pointerup', 155, 80);
      expect(api().getNodeById('model').x).toBeCloseTo(90);
    });
  });
}
