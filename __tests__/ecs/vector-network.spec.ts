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
  VectorNetwork,
  VectorNetworkSerializedNode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Rect', () => {
  it('should render rects correctly', async () => {
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
            VectorNetwork,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
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

        const vn: VectorNetworkSerializedNode = {
          type: 'vector-network',
          id: 'vn-1',
          zIndex: 3,
          stroke: 'black',
          strokeWidth: 10,
          fill: 'red',

          // The vertices of the triangle
          vertices: [
            { x: 100, y: 0 },
            { x: 200, y: 100 },
            { x: 300, y: 0 },
          ],

          // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
          segments: [
            {
              start: 0,
              tangentStart: { x: 0, y: 0 }, // optional
              end: 1,
              tangentEnd: { x: 0, y: 0 }, // optional
            },
            {
              start: 1,
              end: 2,
            },
            {
              start: 2,
              end: 0,
            },
          ],

          // The loop that forms the triangle. Each loop is a
          // sequence of indices into the segments array.
          regions: [{ fillRule: 'nonzero', loops: [[0, 1, 2]] }],
        };

        api.updateNodes([
          vn,
        ]);
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'vector-network',
    );

    await app.exit();
  });
});
