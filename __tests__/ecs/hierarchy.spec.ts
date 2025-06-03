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
  Pen,
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
  ZIndex,
  ComputeZIndex,
  Ellipse,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Hierarchy', () => {
  it('should create a hierarchy', async () => {
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

        api.updateNodes([
          {
            id: '1',
            type: 'ellipse',
            fill: 'red',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            visibility: 'visible',
          },
          {
            id: '2',
            parentId: '1',
            type: 'ellipse',
            fill: 'green',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            stroke: 'black',
            strokeWidth: 10,
            strokeAlignment: 'center',
            strokeDasharray: '10 10',
            visibility: 'visible',
          },
        ]);

        parentEntity = api
          .getEntity({
            id: '1',
          })
          .hold();
        childEntity = api
          .getEntity({
            id: '2',
          })
          .hold();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    if (canvasEntity && cameraEntity && parentEntity && childEntity) {
      const canvas = canvasEntity.read(Canvas);
      expect(canvas.devicePixelRatio).toBe(1);
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(200);
      expect(canvas.renderer).toBe('webgl');
      expect(canvas.cameras).toHaveLength(1);

      const camera = cameraEntity.read(Camera);
      expect(camera.canvas.isSame(canvasEntity)).toBeTruthy();
      expect(cameraEntity.read(Parent).children).toHaveLength(1);
      expect(
        cameraEntity.read(Parent).children[0].isSame(parentEntity),
      ).toBeTruthy();

      const parent = parentEntity.read(Parent);
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0].isSame(childEntity)).toBeTruthy();

      const child = childEntity.read(Children);
      expect(child.parent.isSame(parentEntity)).toBeTruthy();
    }

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'hierarchy',
    );

    await app.exit();
  });
});
