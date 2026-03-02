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
  ClipMode,
  RectSerializedNode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('ClipMode', () => {
  it('should render clip path correctly', async () => {
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
            Rect,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
            ClipMode
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
          id: 'clip-parent',
          type: 'rect',
          fill: 'red',
          clipMode: 'clip',
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          zIndex: 0,
        };
        const node2: RectSerializedNode = {
          id: 'clip-child',
          parentId: 'clip-parent',
          type: 'rect',
          fill: 'green',
          x: 50,
          y: 50,
          width: 200,
          height: 200,
          zIndex: 0,
        };
        api.updateNodes([
          node1,
          node2,
        ]);

        parentEntity = api
          .getEntity(node1)?.hold();
        childEntity = api
          .getEntity(node2)?.hold();
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
      expect(
        cameraEntity.read(Parent).children.filter((c) => !c.has(UI)),
      ).toHaveLength(1);
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
      'clipmode-clip',
    );

    await app.exit();
  });
});
