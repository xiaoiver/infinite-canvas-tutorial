import _gl from 'gl';
import { mat3 } from 'gl-matrix';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Canvas,
  Children,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultStateManagement,
  Entity,
  FillLayers,
  StrokeLayers,
  Grid,
  Parent,
  Plugin,
  PreStartUp,
  Renderable,
  Stroke,
  System,
  Theme,
  Transform,
  Visibility,
  system,
  API,
  Name,
  Rect,
  DropShadow,
  ZIndex,
  ComputeZIndex,
  Selected,
  Pen,
  PathSerializedNode,
  Path,
  Opacity,
  ComputedBounds,
} from '../../packages/ecs/src';
import { decompose } from '../../packages/ecs/src/utils/math';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

function pathPoints(d: string): [number, number][] {
  const nums = d
    .replace(/[MLZ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

function bboxOf(pts: [number, number][]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

describe('Transformer resize with rotation', () => {
  it('keeps a rotated triangle path axis-aligned when resized', async () => {
    const app = new App();

    let api: API | undefined;
    let node: PathSerializedNode | undefined;
    let entity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.before(ComputeZIndex))(StartUpSystem);
    };

    class StartUpSystem extends System {
      private readonly commands = new Commands(this);

      q = this.query((q) =>
        q.using(
          Canvas,
          Theme,
          Grid,
          Camera,
          Parent,
          Children,
          Transform,
          Renderable,
          FillLayers,
          StrokeLayers,
          Stroke,
          Rect,
          Visibility,
          Name,
          DropShadow,
          ZIndex,
          Selected,
          Path,
          Opacity,
        ).write,
      );

      initialize(): void {
        const $canvas = DOMAdapter.get().createCanvas(
          200,
          200,
        ) as HTMLCanvasElement;
        api = new API(new DefaultStateManagement(), this.commands);
        api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });
        api.createCamera({ zoom: 1 });

        // Normalized triangle (apex centered at top), rotated by 30deg.
        node = {
          id: '1',
          type: 'path',
          d: 'M 43.3 0 L 86.6 75 L 0 75 Z',
          strokes: [{ type: 'solid', value: 'black', opacity: 1 }],
          strokeWidth: 0,
          fills: [{ type: 'solid', value: 'red', opacity: 1 }],
          visibility: 'visible',
          x: 56.7,
          y: 50,
          width: 86.6,
          height: 75,
          rotation: Math.PI / 6,
          zIndex: 0,
        } as PathSerializedNode;
        api.setAppState({ penbarSelected: Pen.SELECT });
        api.updateNodes([node]);
        api.selectNodes([node]);
        entity = api.getEntity(node)?.hold();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);
    await app.run();
    await sleep(300);

    // Replicate Select.fitSelected for a pure-resize that doubles the width.
    const sel = entity!.read(ComputedBounds).selectionOBB;
    const oldAttrs = {
      x: sel.x,
      y: sel.y,
      width: sel.width,
      height: sel.height,
      rotation: sel.rotation,
    };
    const newAttrs = { ...oldAttrs, width: oldAttrs.width * 2 };

    const baseSize = 10000000;
    const oldTr = mat3.create();
    mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
    mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
    mat3.scale(oldTr, oldTr, [
      oldAttrs.width / baseSize,
      oldAttrs.height / baseSize,
    ]);
    const newTr = mat3.create();
    mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
    mat3.rotate(newTr, newTr, newAttrs.rotation);
    mat3.scale(newTr, newTr, [
      newAttrs.width / baseSize,
      newAttrs.height / baseSize,
    ]);
    const delta = mat3.create();
    mat3.multiply(delta, newTr, mat3.invert(mat3.create(), oldTr));

    const oldNode = api!.getNodes().find((n) => n.id === '1') as PathSerializedNode;
    const localTransform = api!.getTransform({
      ...oldNode,
      scaleX: oldNode.scaleX ?? 1,
      scaleY: oldNode.scaleY ?? 1,
    });
    const newLocalTransform = mat3.create();
    mat3.multiply(newLocalTransform, delta, localTransform);
    const { scale } = decompose(newLocalTransform);

    const obb = {
      x: newLocalTransform[6],
      y: newLocalTransform[7],
      width: Math.max(Math.abs((oldNode.width ?? 0) * scale[0]), 0.01),
      height: Math.max(Math.abs((oldNode.height ?? 0) * scale[1]), 0.01),
      rotation: oldAttrs.rotation,
      scaleX: 1,
      scaleY: 1,
    };

    api!.updateNodeOBB(node!, obb, false, newLocalTransform, oldNode);

    const updated = api!
      .getNodes()
      .find((n) => n.id === '1') as PathSerializedNode;

    // The baked geometry must stay an axis-aligned, width-only scaled triangle:
    // width ~2x, height unchanged, apex centered at the top (no shear / double-rotation).
    const pts = pathPoints(updated.d);
    const { minX, minY, maxX, maxY } = bboxOf(pts);
    const w = maxX - minX;
    const h = maxY - minY;
    expect(w).toBeCloseTo(86.6 * 2, 0);
    expect(h).toBeCloseTo(75, 0);

    const apex = pts.find((p) => Math.abs(p[1] - minY) < 1)!;
    // Apex x is centered -> base stays horizontal (triangle not sheared).
    expect(apex[0] - minX).toBeCloseTo(w / 2, 0);
    // Rotation stays on the Transform, it must not have been baked twice.
    expect(updated.rotation).toBeCloseTo(Math.PI / 6, 5);

    await app.exit();
  });
});
