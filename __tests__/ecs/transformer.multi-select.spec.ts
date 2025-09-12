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
  Rect,
  DropShadow,
  ZIndex,
  ComputeZIndex,
  Selected,
  Pen,
  RectSerializedNode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Transformer', () => {
  it('should render transformer for multi-select correctly', async () => {
    const app = new App();

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
            FillSolid,
            Stroke,
            Rect,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
            Selected,
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

        const node1: RectSerializedNode = {
          id: '1',
          type: 'rect',
          stroke: 'black',
          strokeWidth: 10,
          fill: 'red',
          visibility: 'visible',
          x: 50,
          y: 50,
          width: 30,
          height: 30,
        };
        const node2: RectSerializedNode = {
          id: '2',
          type: 'rect',
          stroke: 'black',
          strokeWidth: 10,
          fill: 'red',
          visibility: 'visible',
          x: 150,
          y: 150,
          width: 30,
          height: 30,
        };
        api.setAppState({
          penbarSelected: Pen.SELECT,
        });
        api.updateNodes([node1, node2]);
        api.selectNodes([node1, node2]);
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    if (canvasEntity && cameraEntity) {
      const canvas = canvasEntity.read(Canvas);
      expect(canvas.devicePixelRatio).toBe(1);
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(200);
      expect(canvas.renderer).toBe('webgl');
      expect(canvas.cameras).toHaveLength(1);

      const camera = cameraEntity.read(Camera);
      expect(camera.canvas.isSame(canvasEntity)).toBeTruthy();
    }

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'transformer-multi-select',
    );

    await app.exit();
  });
});
