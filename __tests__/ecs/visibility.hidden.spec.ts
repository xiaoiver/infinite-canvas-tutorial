import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Canvas,
  Children,
  Ellipse,
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
  ComputedVisibility,
  UI,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Visibility', () => {
  it('should hide children when parent is hidden', async () => {
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

      parentEntity.write(Visibility).value = 'hidden';

      await sleep(300);

      expect(parentEntity.read(ComputedVisibility).visible).toBeFalsy();
      expect(childEntity.read(ComputedVisibility).visible).toBeFalsy();

      const dir = `${__dirname}/snapshots`;
      await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        'visibility-hidden',
      );

      parentEntity.write(Visibility).value = 'visible';

      await sleep(300);

      expect(parentEntity.read(ComputedVisibility).visible).toBeTruthy();
      expect(childEntity.read(ComputedVisibility).visible).toBeTruthy();

      await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        'visibility-visible',
      );

      parentEntity.write(Visibility).value = 'hidden';
      childEntity.write(Visibility).value = 'visible';

      await sleep(300);

      expect(parentEntity.read(ComputedVisibility).visible).toBeFalsy();
      expect(childEntity.read(ComputedVisibility).visible).toBeTruthy();

      await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
        dir,
        'visibility-hidden-visible',
      );

      await app.exit();
    }
  });
});
