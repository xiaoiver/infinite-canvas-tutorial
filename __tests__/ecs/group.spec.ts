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
  UI,
  EllipseSerializedNode,
  Group,
  GSerializedNode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Group', () => {
  it('should render group correctly', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let parentEntity: Entity | undefined;
    let childEntity: Entity | undefined;

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
            Ellipse,
            Visibility,
            Name,
            ZIndex,
            Group,
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

        const g: GSerializedNode = {
          id: 'g-1',
          type: 'g',
          zIndex: 0,
          fill: 'red',
          stroke: 'black',
          strokeWidth: 10,
        };

        const node1: EllipseSerializedNode = {
          id: '1',
          parentId: 'g-1',
          type: 'ellipse',
          x: 0,
          y: 50,
          width: 50,
          height: 50,
          zIndex: 0,
        };
        const node2: EllipseSerializedNode = {
          id: '2',
          parentId: 'g-1',
          type: 'ellipse',
          x: 100,
          y: 50,
          width: 100,
          height: 50,
          zIndex: 0,
        };

        api.updateNodes([
          g,
          node1,
          node2,
        ]);

        parentEntity = api.getEntity(node1)?.hold();
        childEntity = api.getEntity(node2)?.hold();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'group',
    );

    await app.exit();
  });
});
