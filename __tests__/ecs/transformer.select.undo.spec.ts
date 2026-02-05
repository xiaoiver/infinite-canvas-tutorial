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

describe('Select and Undo', () => {
  it('should select and undo correctly', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement | undefined;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let api: API;
    let parent: RectSerializedNode;
    let child: RectSerializedNode;

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

        parent = {
          id: 'parent',
          type: 'rect',
          fill: 'red',
          x: 50,
          y: 50,
          width: 100,
          height: 100,
        };
        child = {
          id: 'child',
          parentId: 'parent',
          type: 'rect',
          fill: 'green',
          x: 0,
          y: 0,
          width: 50,
          height: 50,
        };
        api.setAppState({
          penbarSelected: Pen.SELECT,
        });
        api.updateNodes([parent, child]);
        api.selectNodes([parent]);
        api.record();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);
    api.selectNodes([child]);
    api.record();
    await sleep(300);

    api.undo();
    await sleep(300);

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'transformer-select-undo',
    );

    await app.exit();
  });
});
