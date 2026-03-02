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
  UI,
  RectSerializedNode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('ZIndex', () => {
  it('should sendToBack correctly', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
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
            FillSolid,
            Stroke,
            Rect,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
            UI,
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

        const node1: RectSerializedNode = {
          id: '1',
          type: 'rect',
          fill: 'red',
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          zIndex: 0,
        };

        const node2: RectSerializedNode = {
          id: '2',
          type: 'rect',
          fill: 'green',
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          zIndex: 1,
        };

        api.updateNodes([
          node1,
          node2,
        ]);
        api.record();

        api.sendToBack(node2);
        api.record();
        api.undo();
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

      expect(api?.getNodeById('1')?.zIndex).toBe(0);
      expect(api?.getNodeById('2')?.zIndex).toBe(1);
    }

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'zindex-sendtoback-undo',
    );

    await app.exit();
  });
});
