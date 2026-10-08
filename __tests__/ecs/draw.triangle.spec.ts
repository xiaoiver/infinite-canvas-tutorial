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
  Path,
  ZIndex,
  ComputeZIndex,
  Pen,
  Opacity,
  GlobalTransform,
} from '../../packages/ecs/src';
import { NodeJSAdapter, createMouseEvent } from '../utils';

DOMAdapter.set({
  ...NodeJSAdapter,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

describe('Draw triangle', () => {
  it('should render triangle correctly', async () => {
    const app = new App();

    let api: API;
    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.before(ComputeZIndex))(StartUpSystem);
    };

    class StartUpSystem extends System {
      private readonly commands = new Commands(this);

      q = this.query(
        (q) =>
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
            Path,
            Visibility,
            Name,
            ZIndex,
            Opacity,
            GlobalTransform,
          ).write,
      );

      initialize(): void {
        $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;

        api = new API(new DefaultStateManagement(), this.commands);

        canvasEntity = api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });

        cameraEntity = api.createCamera({
          zoom: 1,
        });

        api.setAppState({
          penbarSelected: Pen.DRAW_TRIANGLE,
        });
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    const frames = async (count = 2) => {
      for (let i = 0; i < count; i++) await app.world.execute();
    };

    try {
      await app.run();
      await frames();
      $canvas!.dispatchEvent(
        createMouseEvent('mousedown', { clientX: 50, clientY: 50 }),
      );
      await frames();
      $canvas!.dispatchEvent(
        createMouseEvent('mousemove', { clientX: 150, clientY: 150 }),
      );
      await frames();
      $canvas!.dispatchEvent(
        createMouseEvent('mouseup', { clientX: 150, clientY: 150 }),
      );
      // Completing the drawing selects the new node and then refreshes its
      // transformer. A fixed 300ms delay can capture an earlier frame in CI.
      await frames(6);
      expect(api!.getNodes()).toHaveLength(1);
      expect(api!.getAppState().penbarSelected).toBe(Pen.SELECT);
      expect(api!.getAppState().layersSelected).toEqual([
        api!.getNodes()[0].id,
      ]);

      const dir = `${__dirname}/snapshots`;
      await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        'draw-triangle',
      );
    } finally {
      await app.exit();
      DOMAdapter.set(NodeJSAdapter);
    }
  });
});
