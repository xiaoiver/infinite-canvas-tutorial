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
  FillSolid,
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
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep, createMouseEvent } from '../utils';

DOMAdapter.set(NodeJSAdapter);

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
            FillSolid,
            Stroke,
            Rect,
            Visibility,
            Name,
            ZIndex,
            Selected,
            Ellipse,
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
          stroke: 'black',
          strokeWidth: 10,
          fill: 'red',
          visibility: 'visible',
          x: 50,
          y: 50,
          width: 100,
          height: 50,
        };
        api.setAppState({
          penbarSelected: Pen.SELECT,
        });
        api.updateNodes([node]);
        api.selectNodes([node]);

        entity = api
          .getEntity({
            id: '1',
          })
          ?.hold();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    if ($canvas) {
      $canvas.dispatchEvent(
        createMouseEvent('mousedown', { clientX: 100, clientY: 75 }),
      );
      await sleep(10);
      $canvas.dispatchEvent(
        createMouseEvent('mousemove', { clientX: 100, clientY: 75 }),
      );
      await sleep(10);
      $canvas.dispatchEvent(
        createMouseEvent('mousemove', { clientX: 100, clientY: 100 }),
      );
      await sleep(10);
      $canvas.dispatchEvent(
        createMouseEvent('mouseup', { clientX: 100, clientY: 100 }),
      );
    }

    await sleep(300);

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'transformer-move',
    );

    await app.exit();
  });
});
