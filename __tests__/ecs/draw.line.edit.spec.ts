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
  Ellipse,
  ZIndex,
  ComputeZIndex,
  Pen,
  ToBeDeleted,
  PartialBinding,
  Binded,
  Binding,
  Editable,
  Opacity,
  GlobalTransform,
} from '../../packages/ecs/src';
import { createECSInteraction } from '../helpers/ecs-interaction';

describe('Draw line', () => {
  it('should render line correctly', async () => {
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
            Ellipse,
            Visibility,
            Binding,
            Binded,
            PartialBinding,
            ToBeDeleted,
            Name,
            ZIndex,
            Editable,
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
          penbarSelected: Pen.DRAW_LINE,
        });
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    const mouse = (type: string, x: number, y: number, time: number) =>
      interaction.mouse($canvas, type, x, y, time);

    try {
      await app.run();
      await frames();
      await mouse('mousedown', 50, 50, 1000);
      await mouse('mousemove', 50, 50, 1100);
      await mouse('mousemove', 100, 100, 1200);
      await mouse('mousemove', 150, 150, 1300);
      await mouse('mouseup', 150, 150, 1400);
      await frames(4);

      expect(api!.getNodes()).toHaveLength(1);
      expect(api!.getAppState().penbarSelected).toBe(Pen.SELECT);
      const line = api!.getEntity(api!.getNodes()[0]);
      const isEditing = () =>
        line.has(Editable) && line.read(Editable).isEditing;
      expect(isEditing()).toBe(false);

      // The first click is outside the drawing gesture's double-click window.
      await mouse('mousedown', 120, 120, 2000);
      await mouse('mouseup', 120, 120, 2020);
      expect(isEditing()).toBe(false);
      // The second click is 100ms after the first, regardless of runner load.
      await mouse('mousedown', 120, 120, 2100);
      await mouse('mouseup', 120, 120, 2120);
      await frames(4);
      expect(isEditing()).toBe(true);
      expect(api!.getNodes()[0].isEditing).toBe(true);

      const dir = `${__dirname}/snapshots`;
      await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        'draw-line-edit',
      );
    } finally {
      await interaction.dispose();
    }
  });
});
