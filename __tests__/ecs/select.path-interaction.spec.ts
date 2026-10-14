import {
  Circle,
  GlobalTransform,
  Path,
  Pen,
  Transformable,
  type API,
  type PathSerializedNode,
} from '../../packages/ecs/src';
import {
  collectPathControlHandles,
  normalizePathCommands,
} from '../../packages/ecs/src/utils/path-edit';
import { createSelectionWorld } from '../helpers/ecs-selection';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
const originalHitTestProvider = Path.hitTestProvider;
beforeAll(async () => {
  // Node has no native Path2D. Body picking is outside this suite; transformer
  // control-circle picking, event dispatch, transforms and history remain real.
  Path.hitTestProvider = () => false;
  world = await createSelectionWorld();
  [api] = world.apis;
});
beforeEach(async () => {
  await world.pointer(api, 'pointercancel', 190, 190);
  await world.edit(
    api,
    (editor) =>
      editor.setAppState({
        penbarSelected: Pen.SELECT,
        snapToPixelGridEnabled: false,
        snapToObjectsEnabled: false,
      }),
    'NEVER',
  );
  await world.reset(api, []);
});
afterAll(async () => {
  try {
    await world?.dispose();
  } finally {
    Path.hitTestProvider = originalHitTestProvider;
  }
});

const cases: [string, string, number, number][] = [
  ['cubic first control', 'M 0 0 C 25 25 65 60 100 0', 1, 1],
  ['cubic second control', 'M 0 0 C 25 25 65 60 100 0', 2, 3],
  ['cubic endpoint', 'M 0 0 C 25 25 65 60 100 0', 3, 5],
  ['quadratic control', 'M 0 0 Q 60 70 100 0', 1, 1],
  ['quadratic endpoint', 'M 0 0 Q 60 70 100 0', 2, 3],
  ['arc endpoint', 'M 0 0 A 60 30 15 0 1 100 30', 1, 6],
];
for (const transformed of [false, true]) {
  it.each(cases)(
    `moves %s in one undoable edit (rotated and flipped=${transformed})`,
    async (_, d, handleIndex, coordOffset) => {
      await world.reset(api, [
        {
          id: 'path',
          type: 'path',
          zIndex: 0,
          version: 1,
          x: transformed ? 150 : 30,
          y: 50,
          width: 100,
          height: 100,
          d,
          fills: [],
          strokes: [{ type: 'solid', value: 'black' }],
          strokeWidth: 2,
          ...(transformed ? { rotation: 0.2, scaleX: -0.8, scaleY: 1.1 } : {}),
          isEditing: true,
        } as PathSerializedNode,
      ]);
      await world.edit(
        api,
        (editor) => {
          editor.selectNodes([editor.getNodeById('path')]);
          editor.updateNode(editor.getNodeById('path'), { isEditing: true });
        },
        'NEVER',
      );
      await world.frames();
      api.clearHistory();
      const node = () => api.getNodeById('path') as PathSerializedNode;
      const before = node().d;
      const beforeCommands = normalizePathCommands(before);
      const viewportHandles = (d: string) => {
        const matrix = api.getEntity(node()).read(GlobalTransform).matrix;
        return collectPathControlHandles(normalizePathCommands(d)).map(
          ({ x, y }) =>
            api.canvas2Viewport({
              x: matrix.m00 * x + matrix.m10 * y + matrix.m20,
              y: matrix.m01 * x + matrix.m11 * y + matrix.m21,
            }),
        );
      };
      const beforeHandles = viewportHandles(before);
      const controls = api.getCamera().read(Transformable);
      const circle = controls.controlPoints[handleIndex].read(Circle);
      const from = api.canvas2Viewport({ x: circle.cx, y: circle.cy });
      const target = { x: from.x + 12, y: from.y + 15 };
      await world.pointer(api, 'pointerdown', from.x, from.y);
      await world.pointer(api, 'pointermove', target.x, target.y);
      await world.pointer(api, 'pointerup', target.x, target.y);
      const after = node().d;
      expect(after).not.toEqual(before);
      const commands = normalizePathCommands(after);
      // Editing rebases the local bounds and path2String rounds to 0.01 units.
      // Compare every handle in viewport space, including unchanged endpoints.
      viewportHandles(after).forEach((point, index) => {
        const expected = index === handleIndex ? target : beforeHandles[index];
        expect(Math.abs(point.x - expected.x)).toBeLessThan(0.01);
        expect(Math.abs(point.y - expected.y)).toBeLessThan(0.01);
      });
      expect(commands.map((command) => command[0])).toEqual(
        beforeCommands.map((command) => command[0]),
      );
      if (coordOffset === 6) {
        // Arc radii, axis rotation and both flags must survive endpoint editing.
        expect(commands[1].slice(1, 6)).toEqual(beforeCommands[1].slice(1, 6));
      }
      await world.history(api, 'undo');
      expect(node().d).toBe(before);
      expect(api.isUndoStackEmpty()).toBe(true);
      await world.history(api, 'redo');
      expect(node().d).toBe(after);
      world.assertNoErrors();
    },
  );
}
