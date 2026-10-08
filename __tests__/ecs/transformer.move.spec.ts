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
  RectSerializedNode,
  Selected,
  Rect,
  Opacity,
  GlobalTransform,
  Highlighted,
  Transformable,
  TransformableStatus,
} from '../../packages/ecs/src';
import { createECSInteraction } from '../helpers/ecs-interaction';

describe('Transformer', () => {
  it('should move rect correctly', async () => {
    const interaction = createECSInteraction();
    const { app, frames } = interaction;

    let $canvas: HTMLCanvasElement | undefined;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let entity: Entity | undefined;
    let api: API | undefined;

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
            Rect,
            Visibility,
            Name,
            ZIndex,
            Selected,
            Ellipse,
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

        const node: RectSerializedNode = {
          id: '1',
          type: 'rect',
          strokes: [{ type: 'solid', value: 'black', opacity: 1 }],
          strokeWidth: 10,
          fills: [{ type: 'solid', value: 'red', opacity: 1 }],
          visibility: 'visible',
          x: 50,
          y: 50,
          width: 100,
          height: 50,
          zIndex: 0,
        };
        api.setAppState({
          penbarSelected: Pen.SELECT,
        });
        api.updateNodes([node]);
        api.selectNodes([node]);
        api.record();

        entity = api.getEntity(node)?.hold();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    try {
      await app.run();
      await frames();

      if ($canvas) {
        await interaction.mouse($canvas!, 'mousedown', 100, 75);
        await interaction.mouse($canvas!, 'mousemove', 100, 75);
        await interaction.mouse($canvas!, 'mousemove', 100, 100);
        await interaction.mouse($canvas!, 'mouseup', 100, 100);
      }

      await frames(6);

      expect(entity!.read(Transform).translation).toMatchObject({
        x: 50,
        y: 75,
      });
      // Finish MOVE before release-time hover can switch to another handle's mode.
      // Once the frame catches up, the pointer is over its center handle and no
      // hover highlight remains. Completion records exactly one undoable change.
      expect(cameraEntity!.read(Transformable).status).toBe(
        TransformableStatus.MOVED,
      );
      expect(entity!.has(Highlighted)).toBe(false);
      expect(api!.isUndoStackEmpty()).toBe(false);
      const dir = `${__dirname}/snapshots`;
      await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        'transformer-move',
      );

      api!.undo();
      await frames(6);
      expect(entity!.read(Transform).translation).toMatchObject({
        x: 50,
        y: 50,
      });
      expect(api!.isUndoStackEmpty()).toBe(true);
      expect(api!.isRedoStackEmpty()).toBe(false);

      api!.redo();
      await frames(6);
      expect(entity!.read(Transform).translation).toMatchObject({
        x: 50,
        y: 75,
      });
      expect(api!.isRedoStackEmpty()).toBe(true);
    } finally {
      await interaction.dispose();
    }
  });
});
