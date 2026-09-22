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
  Ellipse,
  ZIndex,
  ComputeZIndex,
  Pen,
  RectSerializedNode,
  Selected,
  Rect,
  Opacity,
  GlobalTransform,
} from '../../packages/ecs/src';
import { NodeJSAdapter, createMouseEvent } from '../utils';

// Advance frames explicitly so pointer events cannot overtake the render loop.
DOMAdapter.set({
  ...NodeJSAdapter,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

describe('Transformer', () => {
  it('should move rect correctly', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement | undefined;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let entity: Entity | undefined;

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

        const api = new API(new DefaultStateManagement(), this.commands);

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

        entity = api.getEntity(node)?.hold();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();
    try {
      await app.world.execute();
      await app.world.execute();

      if ($canvas) {
        $canvas.dispatchEvent(
          createMouseEvent('mousedown', { clientX: 100, clientY: 75 }),
        );
        await app.world.execute();
        $canvas.dispatchEvent(
          createMouseEvent('mousemove', { clientX: 100, clientY: 75 }),
        );
        await app.world.execute();
        $canvas.dispatchEvent(
          createMouseEvent('mousemove', { clientX: 100, clientY: 100 }),
        );
        await app.world.execute();
        $canvas.dispatchEvent(
          createMouseEvent('mouseup', { clientX: 100, clientY: 100 }),
        );
      }

      for (let frame = 0; frame < 6; frame++) await app.world.execute();

      expect(entity!.read(Transform).translation).toMatchObject({
        x: 50,
        y: 75,
      });
      const dir = `${__dirname}/snapshots`;
      await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        'transformer-move',
      );
    } finally {
      await app.exit();
    }
  });
});
