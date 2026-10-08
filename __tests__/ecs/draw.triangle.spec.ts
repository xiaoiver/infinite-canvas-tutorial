import _gl from 'gl';
import '../useSnapshotMatchers';
import {
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
import { createECSInteraction } from '../helpers/ecs-interaction';

describe('Draw triangle', () => {
  it('should render triangle correctly', async () => {
    const interaction = createECSInteraction();
    const { app, frames } = interaction;

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

    try {
      await app.run();
      await frames();
      await interaction.mouse($canvas!, 'mousedown', 50, 50);
      await interaction.mouse($canvas!, 'mousemove', 150, 150);
      await interaction.mouse($canvas!, 'mouseup', 150, 150);
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
      await interaction.dispose();
    }
  });
});
