import _gl from 'gl';
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
  FractionalIndex,
  GlobalRenderOrder,
  UI,
  RectSerializedNode,
  Flex,
  Opacity,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

/**
 * Regression test for a bug where several `ZIndex` changes applied in the same
 * frame (e.g. two `sendToBack` calls, or undo/redo of a batched z-order change)
 * made `ComputeZIndex` compute a fractional key between two stale, out-of-order
 * neighbours. That threw inside `fractional-indexing` and left the render order
 * (driven by `FractionalIndex` -> `GlobalRenderOrder`) corrupted.
 */
describe('ZIndex multi-change undo/redo', () => {
  it('keeps render order consistent across batched reorders and undo/redo', async () => {
    const app = new App();

    let api: API | undefined;

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
          UI,
          Flex,
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

        const mk = (id: string, z: number): RectSerializedNode => ({
          id,
          type: 'rect',
          fills: [{ type: 'solid', value: 'red', opacity: 1 }],
          x: 10 * z,
          y: 10 * z,
          width: 100,
          height: 100,
          zIndex: z,
        });

        api.updateNodes([mk('1', 0), mk('2', 1), mk('3', 2), mk('4', 3)]);
        api.record();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);
    await app.run();
    await sleep(200);

    const renderOrder = () => {
      const rows = ['1', '2', '3', '4'].map((id) => {
        const e: Entity = api!.getEntity(api!.getNodeById(id)!);
        return {
          id,
          order: e.has(GlobalRenderOrder)
            ? e.read(GlobalRenderOrder).value
            : Number.NaN,
        };
      });
      return [...rows].sort((a, b) => a.order - b.order).map((r) => r.id).join('<');
    };

    expect(renderOrder()).toBe('1<2<3<4');

    // Two `sendToBack` calls in a SINGLE frame. With the old incremental
    // recompute this threw inside `ComputeZIndex` and corrupted the order.
    api!.sendToBack(api!.getNodeById('2')!); // 2 -> bottom
    api!.sendToBack(api!.getNodeById('3')!); // 3 -> below 2
    api!.record();
    await sleep(150);

    // 3 was sent to back last, so it ends up below 2.
    expect(renderOrder()).toBe('3<2<1<4');

    api!.undo();
    await sleep(150);
    expect(renderOrder()).toBe('1<2<3<4');

    api!.redo();
    await sleep(150);
    expect(renderOrder()).toBe('3<2<1<4');

    await app.exit();
  });
});
