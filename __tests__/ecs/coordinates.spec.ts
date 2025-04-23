import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Canvas,
  Children,
  Circle,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultStateManagement,
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
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Coordinates', () => {
  it('should convert coordinates between canvas, client and viewport', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let api: API | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
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
            Circle,
            Visibility,
            Name,
          ).write,
      );

      initialize(): void {
        $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;

        api = new API(new DefaultStateManagement(), this.commands);

        api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });

        api.createCamera({
          zoom: 1,
        });
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    if (api) {
      {
        const { x, y } = api.viewport2Canvas({ x: 0, y: 0 });
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }
      {
        const { x, y } = api.viewport2Canvas({ x: 100, y: 100 });
        expect(x).toBeCloseTo(100);
        expect(y).toBeCloseTo(100);
      }

      {
        const { x, y } = api.canvas2Viewport({ x: 0, y: 0 });
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }
      {
        const { x, y } = api.canvas2Viewport({ x: 100, y: 100 });
        expect(x).toBeCloseTo(100);
        expect(y).toBeCloseTo(100);
      }

      {
        const { x, y } = api.client2Viewport({ x: 0, y: 0 });
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }
      {
        const { x, y } = api.client2Viewport({ x: 100, y: 100 });
        expect(x).toBeCloseTo(100);
        expect(y).toBeCloseTo(100);
      }

      {
        const { x, y } = api.viewport2Client({ x: 0, y: 0 });
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }
      {
        const { x, y } = api.viewport2Client({ x: 100, y: 100 });
        expect(x).toBeCloseTo(100);
        expect(y).toBeCloseTo(100);
      }

      // Move camera
      const camera = api.getCamera();
      camera.write(Transform).translation = { x: 100, y: 100 };

      await sleep(100);

      {
        const { x, y } = api.viewport2Canvas({ x: 0, y: 0 });
        expect(x).toBeCloseTo(100);
        expect(y).toBeCloseTo(100);
      }
      {
        const { x, y } = api.canvas2Viewport({ x: 100, y: 100 });
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }

      {
        const { x, y } = api.client2Viewport({ x: 0, y: 0 });
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }
      {
        const { x, y } = api.viewport2Client({ x: 0, y: 0 });
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }
    }

    await app.exit();
  });
});
